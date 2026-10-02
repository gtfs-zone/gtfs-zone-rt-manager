/**
 * The stop page: `gtfs-zone-web-common`'s stop and station page, linking
 * vehicles to their trackers and departures to their trip pages, plus the
 * service calendar of the trips calling here.
 */

import type { Trip } from 'gtfs-zone-web-common/gtfs/scheduled';
import type { PageState } from '../../types/page-state';
import { renderStopPage as renderSharedStopPage } from 'gtfs-zone-web-common/gtfs/stop-page';
import {
  cappedNote,
  entityRow,
  entityRowList,
  rowSection,
} from 'gtfs-zone-web-common/gtfs/entity-row';
import { servicesForTrips, weekdaysLabel } from '../service-catalog';
import { CONFIG } from '../../config';
import type { RenderContext, RtIndex } from '../render-context';
import { RT_PAGE_HOOKS } from '../render-context';

/**
 * When anything calls here, as the waterfall.
 *
 * Over every trip that stops here rather than over the departures board: the
 * board is one day's worth, and this is the question of which days there is a
 * service at all. A station aggregates over its platforms, exactly as its
 * routes and departures do. A service is not an object this app browses, so a
 * row is a fact rather than a link.
 */
function renderServices(ctx: RenderContext, stopIds: string[]): string {
  const feed = ctx.session.scheduledFeed!;
  const trips: Trip[] = [];
  for (const stopId of stopIds) {
    for (const tripId of feed.stopTrips.get(stopId) ?? []) {
      const trip = feed.trips.get(tripId);
      if (trip) {
        trips.push(trip);
      }
    }
  }

  const services = servicesForTrips(feed, trips);
  if (services.length === 0) {
    return '';
  }

  const shown = services.slice(0, CONFIG.SERVICE_LIST_MAX);
  const rows = shown.map((service) =>
    entityRow(ctx, {
      label: service.id,
      sublabel: weekdaysLabel(service.days),
      ...(service.start && service.end
        ? { badge: `${service.start} to ${service.end}` }
        : {}),
    })
  );

  return rowSection(
    'Service calendar',
    services.length,
    `${entityRowList(rows, '')}${cappedNote(services.length, shown.length)}`
  );
}

export function renderStopPage(
  ctx: RenderContext,
  rt: RtIndex,
  state: Extract<PageState, { type: 'stop' }>
): string {
  return renderSharedStopPage(ctx, rt, state.stop_id, {
    ...RT_PAGE_HOOKS,
    tripLink: (trip_id, route_id): PageState => ({
      type: 'trip',
      trip_id,
      route_id,
    }),
    stopExtra: (_stop, serviceIds) => renderServices(ctx, serviceIds),
  });
}
