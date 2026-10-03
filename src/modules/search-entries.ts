/**
 * Turns the loaded session into search entries for `SearchController`.
 *
 * The payload is a `PageState`, so a selected result goes through `setFocus`
 * like any other navigation and the panel, map and hash all follow.
 *
 * Both halves of the hierarchy are searchable from one box. Managed objects —
 * trackers and service alerts — come from the API lists and are bucketed ahead
 * of everything the zip carries, because they are what somebody opening this
 * app came to find. Entries are rebuilt per query, so nothing goes stale.
 */

import { VEHICLE_UNMATCHED_COLOR } from 'gtfs-zone-web-common/map/layer-manager';
import type { PageState } from '../types/page-state';
import type { FeedSession } from './feed-session';
import type { VehiclePosition } from '../map-controller';
import { vehicleLocation } from './vehicle-location';
import {
  vehicleDisplayName,
  vehicleRouteId,
} from 'gtfs-zone-web-common/gtfs/entity-render';
import {
  scheduleSearchEntries,
  searchHaystack,
} from 'gtfs-zone-web-common/gtfs/search-entries';
import {
  dotMarker,
  type SearchEntry,
} from 'gtfs-zone-web-common/ui/search-controller';
import { t } from '../i18n/messages';

// Alerts have no map feature and so no color of their own; amber reads as the
// warning it is against every basemap.
const ALERT_MARKER_COLOR = '#f59e0b';

export function buildSearchEntries(
  session: FeedSession
): SearchEntry<PageState>[] {
  const feed = session.scheduledFeed;
  // Managed objects first, then stations, routes, and plain stops.
  const entries: SearchEntry<PageState>[] = scheduleSearchEntries(feed, {
    station: 2,
    route: 3,
    stop: 4,
  });

  // Same color the map paints a vehicle: its trip's route, or unmatched grey.
  const vehicleRoute = (position: VehiclePosition | undefined) =>
    position ? vehicleRouteId(feed, position) : undefined;
  const vehicleColor = (routeId: string | undefined) =>
    (routeId ? feed?.routes.get(routeId)?.color : undefined) ??
    VEHICLE_UNMATCHED_COLOR;

  // A tracker is searched for as itself, whether or not it is reporting: the
  // list is the API's, not the live map's. A one-vehicle tracker is that
  // vehicle, so its fix colors and describes the row; a fleet is described as
  // a fleet, and each of its vehicles is an entry of its own.
  for (const tracker of session.trackers.values()) {
    const positions = session.vehiclesFor(tracker.id);
    const fleet = positions.length > 1;
    const [position] = positions;
    const routeId = fleet ? undefined : vehicleRoute(position);
    entries.push({
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
      priority: 0,
    });

    if (!fleet) {
      continue;
    }
    for (const vehicle of positions) {
      const vehicleRouteId = vehicleRoute(vehicle);
      entries.push({
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
        priority: 0,
      });
    }
  }

  for (const alert of session.serviceAlerts.values()) {
    entries.push({
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
      priority: 1,
    });
  }

  return entries;
}
