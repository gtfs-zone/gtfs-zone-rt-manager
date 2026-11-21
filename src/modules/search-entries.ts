/**
 * Turns the loaded session into search groups for `SearchController`.
 *
 * The payload is a `PageState`, so a selected result goes through `setFocus`
 * like any other navigation and the panel, map and hash all follow.
 *
 * Both halves of the hierarchy are searchable from one box. Managed objects -
 * trackers and service alerts - come from the API lists and are grouped ahead
 * of everything the zip carries, because they are what somebody opening this
 * app came to find. They are rebuilt per query, so nothing goes stale; stops
 * and routes are built once per scheduled feed, so the controller's haystack
 * cache hits on every keystroke.
 */

import { VEHICLE_UNMATCHED_COLOR } from 'gtfs-zone-web-common/map/layer-manager';
import type { GTFSScheduled } from 'gtfs-zone-web-common/gtfs/scheduled';
import type { PageState } from '../types/page-state';
import type { FeedSession } from './feed-session';
import type { VehiclePosition } from '../map-controller';
import { vehicleLocation } from './vehicle-location';
import {
  vehicleDisplayName,
  vehicleRouteId,
} from 'gtfs-zone-web-common/gtfs/entity-render';
import {
  scheduleSearchGroups,
  searchHaystack,
  type ScheduleSearchGroups,
} from 'gtfs-zone-web-common/gtfs/search-entries';
import {
  dotMarker,
  type SearchEntry,
  type SearchGroup,
} from 'gtfs-zone-web-common/ui/search-controller';
import { t } from '../i18n/messages';

// Alerts have no map feature and so no color of their own; amber reads as the
// warning it is against every basemap.
const ALERT_MARKER_COLOR = '#f59e0b';

let memo: {
  feed: GTFSScheduled | null;
  groups: ScheduleSearchGroups;
} | null = null;

/** Stops and routes of `feed`, rebuilt only when the scheduled feed changes. */
function scheduleGroups(feed: GTFSScheduled | null): ScheduleSearchGroups {
  if (memo?.feed !== feed) {
    console.log('[SearchEntries] building schedule search groups');
    memo = { feed, groups: scheduleSearchGroups(feed) };
  }
  return memo.groups;
}

export function buildSearchGroups(
  session: FeedSession
): SearchGroup<PageState>[] {
  const feed = session.scheduledFeed;
  const { stops, routes } = scheduleGroups(feed);
  const trackers: SearchEntry<PageState>[] = [];
  const vehicles: SearchEntry<PageState>[] = [];
  const alerts: SearchEntry<PageState>[] = [];

  // Same color the map paints a vehicle: its trip's route, or unmatched grey.
  const vehicleRoute = (position: VehiclePosition | undefined) =>
    position ? vehicleRouteId(feed, position) : undefined;
  const vehicleColor = (routeId: string | undefined) =>
    (routeId ? feed?.routes.get(routeId)?.color : undefined) ??
    VEHICLE_UNMATCHED_COLOR;

  // A tracker is searched for as itself, whether or not it is reporting: the
  // list is the API's, not the live map's. A one-vehicle tracker is that
  // vehicle, so its fix colors and describes the row; a fleet is described as
  // a fleet, and each of its vehicles is an entry in the vehicles group.
  for (const tracker of session.trackers.values()) {
    const positions = session.vehiclesFor(tracker.id);
    const fleet = positions.length > 1;
    const [position] = positions;
    const routeId = fleet ? undefined : vehicleRoute(position);
    trackers.push({
      payload: { type: 'tracker', tracker_id: tracker.id },
      icon: dotMarker(vehicleColor(routeId)),
      primary: tracker.nickname,
      secondary: fleet
        ? t('search.vehicles', { count: positions.length })
        : position
          ? vehicleDisplayName(feed, position)
          : t('search.noFix'),
      haystack: fleet
        ? searchHaystack(tracker.nickname)
        : searchHaystack(
            tracker.nickname,
            position?.label,
            position?.tripId,
            routeId
          ),
    });

    if (!fleet) {
      continue;
    }
    for (const vehicle of positions) {
      const vehicleRouteId = vehicleRoute(vehicle);
      vehicles.push({
        payload: vehicleLocation(positions, vehicle),
        icon: dotMarker(vehicleColor(vehicleRouteId)),
        primary: vehicle.label || vehicle.vehicleId,
        secondary: [
          tracker.nickname,
          vehicle.tripId
            ? feed?.trips.get(vehicle.tripId)?.headsign
            : undefined,
        ]
          .filter(Boolean)
          .join(' - '),
        haystack: searchHaystack(
          vehicle.label,
          vehicle.vehicleId,
          vehicle.tripId,
          vehicleRouteId
        ),
      });
    }
  }

  for (const alert of session.serviceAlerts.values()) {
    alerts.push({
      payload: { type: 'alert', alert_id: String(alert.id) },
      icon: dotMarker(ALERT_MARKER_COLOR),
      primary: alert.header_text || t('search.alert', { id: alert.id }),
      secondary: alert.effect ?? alert.cause ?? undefined,
      haystack: searchHaystack(
        alert.header_text,
        alert.description_text,
        alert.cause ?? undefined,
        alert.effect ?? undefined
      ),
    });
  }

  return [
    { label: t('search.groupTrackers'), entries: trackers },
    { label: t('search.groupVehicles'), entries: vehicles },
    { label: t('search.groupAlerts'), entries: alerts },
    stops,
    routes,
  ];
}
