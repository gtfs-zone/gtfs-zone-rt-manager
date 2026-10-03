import type * as maplibregl from 'maplibre-gl';
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import { CONFIG } from './config';
import { vehicleLocation } from './modules/vehicle-location';
import type { VehiclePosition as RtVehiclePosition } from 'gtfs-zone-web-common/gtfs/rt-types';
import type { PageState } from './types/page-state';
import type { MapFocusTarget } from 'gtfs-zone-web-common/map/layer-manager';
import { RtMapController } from 'gtfs-zone-web-common/map/rt-map-controller';
import { STOP_FOCUS_HALO_LAYER } from 'gtfs-zone-web-common/map/stop-layer-style';
import { resolveThemeColor } from 'gtfs-zone-web-common/util/theme-color';

/**
 * gtfs-zone-web-common's vehicle, plus the tracker it is reporting under.
 *
 * `key` is the tracker's surrogate id plus the vehicle's own id (the
 * `vehicle:*` Redis key without its prefix), so it is unique even when one
 * tracker is carrying several concurrent vehicles, which is why `trackerId`
 * has to be carried beside it. It identifies the vehicle, not the trip it
 * happens to be on: a vehicle that finishes one trip and starts another keeps
 * the same key, and so the same map feature.
 */
export interface VehiclePosition extends RtVehiclePosition {
  /**
   * The surrogate `Tracker.id` this vehicle is reporting under. Several
   * vehicles can share one, which is the whole reason `key` is not it.
   */
  trackerId: string;
}

type TrackerExtra = { trackerId: string };

/** The trip overlay's own source and layers, owned here rather than by LayerManager. */
const TRIP_SOURCE = 'ym-trip-shape';
const TRIP_CASING_LAYER = 'ym-trip-shape-casing';
const TRIP_LINE_LAYER = 'ym-trip-shape-line';
const TRIP_LINE_WIDTH = 4;

/** Same token LayerManager paints selection in, resolved the same way. */
function tripAccent(): string {
  return resolveThemeColor('--color-primary', '#3b82f6');
}

/** Bounding box of a path, or null when there is nothing to frame. */
function boundsOf(
  path: [number, number][] | null
): [[number, number], [number, number]] | null {
  if (!path || path.length === 0) {
    return null;
  }
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  for (const [lon, lat] of path) {
    if (lon < west) {
      west = lon;
    }
    if (lon > east) {
      east = lon;
    }
    if (lat < south) {
      south = lat;
    }
    if (lat > north) {
      north = lat;
    }
  }
  return [
    [west, south],
    [east, north],
  ];
}

/**
 * A tracker's most recently reported vehicle, or undefined when it has none.
 *
 * Most recent rather than first: scan order is not the fleet's order, and a
 * tracker running several vehicles should be followed on the one that just
 * moved.
 */
function trackerVehicle(
  positions: VehiclePosition[],
  trackerId: string
): VehiclePosition | undefined {
  let best: VehiclePosition | undefined;
  for (const p of positions) {
    if (p.trackerId !== trackerId) {
      continue;
    }
    if (!best || (p.timestamp ?? 0) > (best.timestamp ?? 0)) {
      best = p;
    }
  }
  return best;
}

/**
 * The shared realtime map with gtfs-zone-rt-manager's focus kinds: a tracker
 * follows its newest vehicle, a vehicle follows its own key, and a trip draws
 * its geometry on a source this file owns.
 */
export class MapController extends RtMapController<
  PageState,
  VehiclePosition,
  TrackerExtra
> {
  /**
   * The drawn trip geometry, held so it can be re-added after a `setStyle`.
   * Empty when nothing is focused, or when nothing focused has a drawable path.
   *
   * A list rather than one path: a focused trip is one of these, and a selected
   * day in the assignments calendar is every trip assigned on it.
   */
  private tripShapes: [number, number][][] = [];

  /**
   * The trip ids `showTrips` last drew, so a re-draw with the same set leaves
   * the camera alone. The calendar re-reads its window after every write, and
   * refitting on each one would fight whoever is looking at the map.
   */
  private drawnTripKey = '';

  constructor() {
    super(
      {
        viewKey: CONFIG.MAP_VIEW_KEY,
        appearanceKey: CONFIG.MAP_APPEARANCE_KEY,
        workerUrl: maplibreWorkerUrl,
        // `trackerId` rides on the feature so a click still resolves the
        // tracker after its vehicle has dropped out of `positions`.
        vehicleExtra: {
          properties: (v) => ({ tracker_id: v.trackerId }),
          target: (props) => ({ trackerId: String(props.tracker_id ?? '') }),
        },
      },
      { type: 'home' }
    );
  }

  protected targetState(
    target: MapFocusTarget<TrackerExtra>
  ): PageState | null {
    switch (target.kind) {
      case 'stop':
        return { type: 'stop', stop_id: target.id };
      case 'route':
        return { type: 'route', route_id: target.id };
      case 'vehicle': {
        // `target.id` is the feature key, never a tracker id. A vehicle whose
        // record has just gone falls back to its tracker.
        const vehicle = this.positions.find((p) => p.key === target.id);
        if (vehicle) {
          return vehicleLocation(this.positions, vehicle);
        }
        return target.trackerId
          ? { type: 'tracker', tracker_id: target.trackerId }
          : null;
      }
    }
  }

  protected onStyleRebuilt(): void {
    // setStyle dropped the trip source along with LayerManager's, so it has
    // to be re-added and re-filled here too.
    this.drawTripShape();
  }

  clearScheduledFeed(): void {
    super.clearScheduledFeed();
    this.tripShapes = [];
    this.drawnTripKey = '';
    this.whenLoaded(() => this.drawTripShape());
  }

  refreshAccentColor(): void {
    super.refreshAccentColor();
    if (this.map?.getLayer(TRIP_LINE_LAYER)) {
      this.map.setPaintProperty(TRIP_LINE_LAYER, 'line-color', tripAccent());
    }
  }

  protected applyFocus(state: PageState): void {
    if (state.type !== 'trip') {
      this.clearTrip();
    }

    switch (state.type) {
      case 'home':
        this.focusHome();
        return;

      case 'alert':
        // A managed alert has no geometry of its own. Nothing to highlight or
        // fly to; the camera stays where the reader left it.
        this.focusNone();
        return;

      case 'trip': {
        const path = this.tripPath(state.trip_id);
        this.tripShapes = path ? [path] : [];
        this.drawnTripKey = '';
        this.drawTripShape();
        // No route-wide spotlight here: dimming every stop but the route's
        // would leave only whichever of them fall in the trip's own tight
        // bounds looking highlighted, which reads as one stop lit at random.
        this.focusNone();
        this.fitFocusBounds(boundsOf(path));
        return;
      }

      case 'route':
        this.focusRoute(state.route_id);
        return;

      case 'stop':
        this.focusStop(state.stop_id);
        return;

      case 'tracker':
        // The layer is keyed by `key`, so a tracker running several vehicles
        // spotlights its most recent one; the panel lists all of them.
        this.focusVehicle((positions) =>
          trackerVehicle(positions, state.tracker_id)
        );
        return;

      case 'vehicle':
        this.focusVehicle((positions) =>
          positions.find((p) => p.key === state.vehicle_key)
        );
        return;
    }
  }

  // ── Trip geometry ──────────────────────────────────────────────────────────

  /**
   * The path to draw for a trip: its `shapes.txt` polyline where the feed has
   * one, and otherwise the straight line through its stops in `stop_sequence`
   * order.
   */
  private tripPath(tripId: string): [number, number][] | null {
    const feed = this.feed;
    const trip = feed?.trips.get(tripId);
    if (!feed || !trip) {
      return null;
    }

    const shape = trip.shape_id ? feed.shapes.get(trip.shape_id) : undefined;
    if (shape && shape.length > 1) {
      return shape;
    }

    const points: [number, number][] = [];
    for (const time of feed.stopTimesByTrip.get(tripId) ?? []) {
      const stop = feed.stops.get(time.stop_id);
      if (stop) {
        points.push([stop.lon, stop.lat]);
      }
    }
    return points.length > 1 ? points : null;
  }

  private clearTrip(): void {
    this.drawnTripKey = '';
    if (this.tripShapes.length === 0) {
      return;
    }
    this.tripShapes = [];
    this.drawTripShape();
  }

  /**
   * Draw a set of trips at once: the assignments calendar's selected day.
   *
   * Called after `focus`, which has already cleared whatever the previous page
   * drew, and again whenever the expansion is re-read. The camera moves only
   * when the set itself changes, so a refresh that finds the same trips does
   * not yank the view back.
   */
  showTrips(tripIds: string[]): void {
    const key = tripIds.join('\u0000');
    this.whenLoaded(() => {
      const changed = key !== this.drawnTripKey;
      this.drawnTripKey = key;
      this.tripShapes = tripIds
        .map((id) => this.tripPath(id))
        .filter((path): path is [number, number][] => path !== null);
      this.drawTripShape();
      if (changed) {
        this.fitFocusBounds(boundsOf(this.tripShapes.flat()));
      }
    });
  }

  /** Add the trip source and layers if missing, then publish the current path. */
  private drawTripShape(): void {
    if (!this.ready) {
      return;
    }

    if (!this.map.getSource(TRIP_SOURCE)) {
      this.map.addSource(TRIP_SOURCE, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      // Under the stop and vehicle layers, over the route lines: the trip is a
      // path through the network, not a thing sitting on top of it.
      const before = this.map.getLayer(STOP_FOCUS_HALO_LAYER)
        ? STOP_FOCUS_HALO_LAYER
        : undefined;
      this.map.addLayer(
        {
          id: TRIP_CASING_LAYER,
          type: 'line',
          source: TRIP_SOURCE,
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: {
            'line-color': '#000000',
            'line-opacity': 0.35,
            'line-width': TRIP_LINE_WIDTH + 4,
          },
        },
        before
      );
      this.map.addLayer(
        {
          id: TRIP_LINE_LAYER,
          type: 'line',
          source: TRIP_SOURCE,
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': tripAccent(), 'line-width': TRIP_LINE_WIDTH },
        },
        before
      );
    }

    const source = this.map.getSource(TRIP_SOURCE) as maplibregl.GeoJSONSource;
    source.setData({
      type: 'FeatureCollection',
      features: this.tripShapes.map((path) => ({
        type: 'Feature',
        properties: {},
        geometry: { type: 'LineString', coordinates: path },
      })),
    });
  }
}
