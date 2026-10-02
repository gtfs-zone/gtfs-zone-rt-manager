/**
 * The alert page: the managed alert this app owns, falling back to
 * `gtfs-zone-web-common`'s decoded GTFS-RT alert page.
 *
 * Two objects share this file and this `PageState` variant, which is worth
 * being explicit about. The *managed* alert is a row in gtfs-zone-rt-api with a numeric
 * id, and it is what this app creates, browses and publishes. The `AlertRecord`
 * is what a consumer decoding the published feed sees. Here they are the same
 * disruption seen from two ends, so `alert_id` is `String(Alert.id)` and the
 * managed row is what the page shows.
 *
 * The one trap: gtfs-zone-rt-api numbers the entities in the published GTFS-RT feed
 * positionally (`entity.id = str(i)`), so an `AlertRecord.id` is *not* an
 * `Alert.id`. Nothing fills `session.alerts` yet; whatever does has to key it
 * by the managed id, or the links the route and stop pages emit will point at
 * the wrong alert.
 */

import type { Alert, InformedEntity } from '../../types/api';
import type { PageState } from '../../types/page-state';
import {
  ALERT_LEVEL_LABELS,
  selectorLevel,
} from 'gtfs-zone-web-common/gtfs/alerts';
import { renderAlertPage as renderRtAlertPage } from 'gtfs-zone-web-common/gtfs/alert-page';
import type { RenderContext } from '../render-context';
import {
  emptyState,
  entityRow,
  entityRowList,
  rowSection,
} from 'gtfs-zone-web-common/gtfs/entity-row';
import { actionButton, formatIso } from '../managed-render';
import {
  escHtml,
  prop,
  propList,
  section,
} from 'gtfs-zone-web-common/gtfs/entity-render';

/** The managed alert's own window, which is one period rather than a list. */
function renderManagedWindow(alert: Alert): string {
  if (!alert.active_period_start && !alert.active_period_end) {
    return `<p class="text-xs opacity-60">No window set — the alert is published for as long as it exists.</p>`;
  }
  return propList([
    prop(
      'From',
      escHtml(
        alert.active_period_start
          ? formatIso(alert.active_period_start)
          : 'always'
      )
    ),
    prop(
      'Until',
      escHtml(
        alert.active_period_end
          ? formatIso(alert.active_period_end)
          : 'open-ended'
      )
    ),
  ]);
}

/**
 * One informed entity from the API, as a row pointing at what it names.
 *
 * The API's row is flat where GTFS-RT nests the trip descriptor, so the trip
 * half is `trip_id` / `trip_route_id` / `trip_start_date` rather than a `trip`
 * object. Everything it names is a string the feed's own author typed, and none
 * of it is validated against the zip, so an id that resolves becomes a link to
 * its page and one that does not is still shown as what was entered.
 *
 * The row links the most specific object it names — a trip over a route over a
 * stop — and everything else it says becomes the second line. That is the back
 * reference: the route page lists the alert, and this lists the route.
 */
function renderAffectedEntity(ctx: RenderContext, e: InformedEntity): string {
  // `alertId:entityId`: an entity is addressable only through its own alert,
  // which is how the server scopes the delete too.
  const arg = `${e.service_alert_id}:${e.id}`;
  const feed = ctx.session.scheduledFeed;

  const trip = e.trip_id ? feed?.trips.get(e.trip_id) : undefined;
  const route = e.route_id ? feed?.routes.get(e.route_id) : undefined;
  const stop = e.stop_id ? feed?.stops.get(e.stop_id) : undefined;

  let state: PageState | undefined;
  let label: string;
  if (trip) {
    state = { type: 'trip', trip_id: trip.trip_id, route_id: trip.route_id };
    label = trip.raw.trip_short_name?.trim() || trip.headsign || trip.trip_id;
  } else if (route) {
    state = { type: 'route', route_id: route.id };
    label = route.short_name || route.long_name || route.id;
  } else if (stop) {
    state = { type: 'stop', stop_id: stop.id };
    label = stop.name || stop.id;
  } else {
    label =
      e.trip_id ??
      e.route_id ??
      e.stop_id ??
      e.agency_id ??
      'The whole feed — this entity names nothing';
  }

  // Everything the row did not spend on its label, so a selector that names a
  // route *and* a direction still says both.
  const rest: string[] = [];
  if (e.agency_id && label !== e.agency_id) {
    rest.push(`agency ${e.agency_id}`);
  }
  if (e.route_type !== null) {
    rest.push(`route_type ${e.route_type}`);
  }
  if (route && !trip) {
    rest.push(`route_id ${route.id}`);
  }
  if (stop && (trip || route)) {
    rest.push(`stop ${stop.name || stop.id}`);
  }
  if (e.direction_id !== null) {
    rest.push(`direction ${e.direction_id}`);
  }
  if (trip && route) {
    rest.push(`on ${route.short_name || route.long_name || route.id}`);
  }
  if (e.trip_route_id && !route) {
    rest.push(`trip route ${e.trip_route_id}`);
  }
  if (e.trip_start_date) {
    rest.push(e.trip_start_date);
  }
  if (e.trip_start_time) {
    rest.push(e.trip_start_time);
  }

  // How broadly the entity applies, scored on the same selector rule the
  // decoded feed is scored on, so the two ends agree about a row's reach.
  const level = selectorLevel({
    ...(e.agency_id ? { agencyId: e.agency_id } : {}),
    ...(e.route_id ? { routeId: e.route_id } : {}),
    ...(e.route_type !== null ? { routeType: e.route_type } : {}),
    ...(e.stop_id ? { stopId: e.stop_id } : {}),
    ...(e.trip_id ? { trip: { tripId: e.trip_id } } : {}),
  });

  return entityRow(ctx, {
    ...(state ? { state } : {}),
    label,
    ...(rest.length ? { sublabel: rest.join(' - ') } : {}),
    badge: ALERT_LEVEL_LABELS[level],
    actionsHtml: actionButton('entity:delete', arg, 'Remove', 'btn-ghost'),
  });
}

/** What the alert informs, or the count while the detail request is in flight. */
function renderAffects(ctx: RenderContext, alert: Alert): string {
  const detail = ctx.session.alertDetails.get(String(alert.id));
  const empty = 'Nothing named — the alert applies to the whole feed.';
  if (!detail) {
    return alert.entity_count === 0
      ? emptyState(empty)
      : `<p class="text-xs opacity-60">Loading ${escHtml(String(alert.entity_count))} informed entit${
          alert.entity_count === 1 ? 'y' : 'ies'
        }…</p>`;
  }
  return entityRowList(
    detail.entities.map((e) => renderAffectedEntity(ctx, e)),
    empty
  );
}

/** Whether the managed alert's window contains this moment. */
function managedIsActive(alert: Alert, now = Date.now()): boolean {
  const start = alert.active_period_start
    ? Date.parse(alert.active_period_start)
    : null;
  const end = alert.active_period_end
    ? Date.parse(alert.active_period_end)
    : null;
  if (start !== null && now < start) {
    return false;
  }
  if (end !== null && now > end) {
    return false;
  }
  return true;
}

/** The managed alert: the row this app owns and publishes. */
function renderManagedAlertPage(ctx: RenderContext, alert: Alert): string {
  const active = managedIsActive(alert);
  return `
    <div class="space-y-4">
      <div class="space-y-2">
        <div class="flex items-center gap-2">
          ${
            active
              ? '<span class="badge badge-warning badge-xs">active</span>'
              : '<span class="badge badge-ghost badge-xs">not active</span>'
          }
        </div>
        <h2 class="text-lg font-semibold leading-tight">${escHtml(alert.header_text)}</h2>
        <div class="flex flex-wrap gap-2">
          ${actionButton('alert:edit', String(alert.id), 'Edit')}
          ${actionButton('alert:delete', String(alert.id), 'Delete', 'btn-outline btn-error')}
        </div>
        ${
          alert.description_text
            ? `<p class="text-sm whitespace-pre-wrap">${escHtml(alert.description_text)}</p>`
            : ''
        }
        ${
          alert.url
            ? `<p class="text-xs"><a href="${escHtml(alert.url)}" target="_blank" rel="noopener"
                 class="link break-all">${escHtml(alert.url)}</a></p>`
            : ''
        }
      </div>

      ${section(
        'Properties',
        propList([
          prop('Cause', escHtml(alert.cause ?? '—')),
          prop('Effect', escHtml(alert.effect ?? '—')),
          prop('Severity', escHtml(alert.severity_level ?? '—')),
        ])
      )}

      ${section('Active window', renderManagedWindow(alert))}
      ${rowSection(
        'Affects',
        alert.entity_count,
        `<div class="space-y-2">
          ${renderAffects(ctx, alert)}
          ${actionButton('entity:add', String(alert.id), 'Add entity')}
        </div>`
      )}
    </div>`;
}

export function renderAlertPage(
  ctx: RenderContext,
  state: Extract<PageState, { type: 'alert' }>
): string {
  const managed = ctx.session.serviceAlerts.get(state.alert_id);
  if (managed) {
    return renderManagedAlertPage(ctx, managed);
  }

  // Not one of this feed's rows. It may still be in the live payload, which is
  // a different object with its own id space.
  return renderRtAlertPage(ctx, state.alert_id);
}
