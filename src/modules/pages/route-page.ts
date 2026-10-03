/**
 * The route page: `gtfs-zone-web-common`'s route strip, linking vehicles to
 * their trackers, plus each direction's trips with their assigned tracker and
 * the route's service calendar.
 */

import { CONFIG } from '../../config';
import type { Route } from 'gtfs-zone-web-common/gtfs/scheduled';
import type { PageState } from '../../types/page-state';
import { renderRoutePage as renderSharedRoutePage } from 'gtfs-zone-web-common/gtfs/route-page';
import {
  cappedNote,
  countBadge,
  entityRow,
  entityRowList,
  rowSection,
} from 'gtfs-zone-web-common/gtfs/entity-row';
import {
  assignmentCounts,
  servicesForTrips,
  weekdaysLabel,
} from '../service-catalog';
import {
  escHtml,
  formatScheduledTime,
} from 'gtfs-zone-web-common/gtfs/entity-render';
import type { RenderContext, RtIndex } from '../render-context';
import { RT_PAGE_HOOKS } from '../render-context';
import { t } from '../../i18n/messages';

// --- Trips --------------------------------------------------------------------

/**
 * Which tracker each trip is assigned to, by trip id.
 *
 * Built once for the direction rather than asked per row: `rulesForTrip` walks
 * every rule in the feed, and a busy route lists two hundred trips.
 */
function assignedTrackers(ctx: RenderContext): Map<string, string> {
  const session = ctx.session;
  const byTrip = new Map<string, string>();
  for (const rule of session.rules?.values() ?? []) {
    const tracker = session.trackers.get(rule.tracker_id);
    if (!tracker || byTrip.has(rule.trip_id)) {
      continue;
    }
    byTrip.set(rule.trip_id, tracker.nickname);
  }
  return byTrip;
}

/** `Unassigned`, in the same style a badge from the API would render in. */
const UNASSIGNED_BADGE = `<span class="badge badge-ghost badge-xs opacity-60">${t('page.unassigned')}</span>`;

/**
 * The route's trips in this direction, ordered by first departure, so the tree
 * can be walked down to a trip page. A busy route has thousands of them, so the
 * list scrolls in place, is capped, and says how many it left out.
 */
function renderTrips(
  ctx: RenderContext,
  routeId: string,
  directionId: string
): string {
  const feed = ctx.session.scheduledFeed!;
  const trips = (feed.tripsByRoute.get(routeId) ?? []).filter(
    (t) => (t.direction_id ?? '') === directionId
  );
  if (trips.length === 0) {
    return '';
  }

  // Sorted on the raw clock string: GTFS times are zero-padded and may run past
  // 24:00, so lexicographic order is departure order and a Date would break it.
  const departure = (trip_id: string): string =>
    feed.stopTimesByTrip.get(trip_id)?.[0]?.departure_time ?? '';
  const ordered = [...trips].sort((a, b) =>
    departure(a.trip_id).localeCompare(departure(b.trip_id))
  );
  const shown = ordered.slice(0, CONFIG.ROUTE_TRIP_LIST_MAX);

  // The departure moves to the second line so the badge can carry the assigned
  // tracker: which tracker runs a trip is what this app is for, and the clock
  // time is already the order the rows are in.
  const assigned = assignedTrackers(ctx);
  const rows = shown.map((trip) =>
    entityRow(ctx, {
      state: { type: 'trip', trip_id: trip.trip_id, route_id: routeId },
      label: trip.raw.trip_short_name?.trim() || trip.headsign || trip.trip_id,
      sublabel: formatScheduledTime(
        departure(trip.trip_id) || undefined,
        false
      ),
      ...(assigned.has(trip.trip_id)
        ? { badge: assigned.get(trip.trip_id)! }
        : { badgeHtml: UNASSIGNED_BADGE }),
    })
  );

  const more =
    ordered.length > shown.length
      ? `<p class="text-xs opacity-50">${escHtml(
          t('page.moreTrips', { count: ordered.length - shown.length })
        )}</p>`
      : '';

  const counts = assignmentCounts(
    ctx.session,
    ordered.map((trip) => trip.trip_id)
  );
  const unassigned = counts ? counts.total - counts.assigned : null;

  return rowSection(
    t('page.trips'),
    ordered.length,
    `<div class="max-h-96 overflow-y-auto overflow-x-hidden px-2">${entityRowList(
      rows,
      t('page.noTrips')
    )}</div>${more}`,
    unassigned === null
      ? countBadge('—')
      : unassigned > 0
        ? countBadge(t('page.unassignedCount', { count: unassigned }))
        : ''
  );
}

/**
 * When this route runs: one row per service, in cascade order.
 *
 * Outside the direction sections: a route's calendar is a property of the route
 * and splitting it by direction would say the same thing twice. A service is
 * not an object this app browses, so a row is a fact rather than a link.
 */
function renderServices(ctx: RenderContext, route: Route): string {
  const feed = ctx.session.scheduledFeed!;
  const services = servicesForTrips(
    feed,
    feed.tripsByRoute.get(route.id) ?? []
  );
  if (services.length === 0) {
    return '';
  }

  const shown = services.slice(0, CONFIG.SERVICE_LIST_MAX);
  const rows = shown.map((service) =>
    entityRow(ctx, {
      label: service.id,
      sublabel: weekdaysLabel(service.days),
      ...(service.start && service.end
        ? {
            badge: t('days.range', { start: service.start, end: service.end }),
          }
        : {}),
    })
  );

  return rowSection(
    t('page.serviceCalendar'),
    services.length,
    `${entityRowList(rows, '')}${cappedNote(services.length, shown.length)}`
  );
}

// --- Page ---------------------------------------------------------------------

export function renderRoutePage(
  ctx: RenderContext,
  rt: RtIndex,
  state: Extract<PageState, { type: 'route' }>
): string {
  return renderSharedRoutePage(ctx, rt, state.route_id, {
    ...RT_PAGE_HOOKS,
    directionExtra: (routeId, directionId) =>
      renderTrips(ctx, routeId, directionId),
    routeExtra: (route) => renderServices(ctx, route),
    vehicleCountLabel: t('page.trackersWithFix'),
  });
}
