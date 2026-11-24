/**
 * The trip page: one trip's schedule, stop by stop, with whatever the live feed
 * predicts for it laid alongside, and the trackers assigned to run it.
 *
 * The service lines and the stop times table are web-common's; the trackers
 * and the assignment rules are this app's.
 *
 * Every clock time is rendered straight from the `stop_times` string. GTFS
 * times run past 24:00 on an overnight trip, so a `Date` round-trip would
 * silently rewrite 25:10:00 as 01:10 the wrong day.
 */

import type { Trip } from 'gtfs-zone-web-common/gtfs/scheduled';
import type { PageState } from '../../types/page-state';
import { alertsForTrip } from 'gtfs-zone-web-common/gtfs/alerts';
import {
  entityRow,
  entityRowList,
  rowSection,
} from 'gtfs-zone-web-common/gtfs/entity-row';
import { vehicleLocation } from '../vehicle-location';
import {
  actionButton,
  describeRecurrence,
  formatWindow,
} from '../managed-render';
import { serviceSection } from 'gtfs-zone-web-common/gtfs/service-days';
import { tripStopTimesTable } from 'gtfs-zone-web-common/gtfs/trip-page';
import { CONFIG } from '../../config';
import type { RtIndex } from '../render-context';
import type { RenderContext } from '../render-context';
import {
  entityLink,
  escHtml,
  missing,
  prop,
  propList,
  renderRawFields,
  routeBadge,
  section,
  vehicleDisplayName,
} from 'gtfs-zone-web-common/gtfs/entity-render';
import { renderAlertList } from 'gtfs-zone-web-common/gtfs/alert-page';
import { t } from '../../i18n/messages';

function renderService(ctx: RenderContext, trip: Trip): string {
  const service = serviceSection(
    ctx.session.scheduledFeed!,
    trip.service_id,
    CONFIG.WEEK_START
  );
  return section(service.title!, service.body!);
}

function renderSchedule(ctx: RenderContext, rt: RtIndex, trip: Trip): string {
  return section(
    t('trip.schedule'),
    tripStopTimesTable(
      ctx,
      ctx.session.scheduledFeed!,
      trip,
      rt.predictionsByTrip.get(trip.trip_id) ?? []
    )
  );
}

// ─── Trackers ─────────────────────────────────────────────────────────────────

/** Trackers reporting this trip right now, as opposed to assigned to it. */
function renderTrackers(ctx: RenderContext, rt: RtIndex, trip: Trip): string {
  const vehicles = rt.vehiclesByTrip.get(trip.trip_id) ?? [];
  if (vehicles.length === 0) {
    return '';
  }
  return rowSection(
    t('trip.reporting'),
    vehicles.length,
    entityRowList(
      vehicles.map((v) => {
        // A one-vehicle tracker opens the tracker; a fleet's vehicle opens its
        // own page and is named as itself, since the trip's name is the same
        // for every vehicle running it.
        const state = vehicleLocation(ctx.session.vehicles.values(), v);
        return entityRow(ctx, {
          state,
          label:
            state.type === 'vehicle'
              ? v.label || v.vehicleId
              : vehicleDisplayName(ctx.session.scheduledFeed, v),
        });
      }),
      t('trip.nobodyReporting')
    )
  );
}

/**
 * Who is assigned to run this trip, and the way to assign somebody.
 *
 * Rules rather than expanded days: this is the standing arrangement, and which
 * particular dates it covers is the calendar's question. The section renders
 * even with nothing in it, because "nothing is assigned to this trip" is the
 * answer somebody opened the page for.
 */
function renderAssignments(ctx: RenderContext, trip: Trip): string {
  const session = ctx.session;
  if (!session.rules) {
    return section(
      t('trip.assignments'),
      `<p class="text-xs opacity-60">${t('common.loading')}</p>`
    );
  }

  const rules = session.rulesForTrip(trip.trip_id);
  const rows = rules.map((rule) => {
    const tracker = session.trackers.get(rule.tracker_id);
    return entityRow(ctx, {
      ...(tracker
        ? { state: { type: 'tracker' as const, tracker_id: tracker.id } }
        : {}),
      label: tracker ? tracker.nickname : rule.tracker_id,
      sublabel: `${describeRecurrence(rule)} - ${formatWindow(rule.start_time, rule.end_time)}`,
      actionsHtml: `${actionButton('assign:edit', String(rule.id), t('common.edit'))}
        ${actionButton('assign:delete', String(rule.id), t('common.delete'), 'btn-outline btn-error')}`,
    });
  });

  return rowSection(
    t('trip.assignments'),
    rules.length,
    `${entityRowList(rows, t('trip.noAssignments'))}
     <div class="mt-2">${actionButton(
       'assign:new-for-trip',
       trip.trip_id,
       t('trip.assign')
     )}</div>`
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function renderTripPage(
  ctx: RenderContext,
  rt: RtIndex,
  state: Extract<PageState, { type: 'trip' }>
): string {
  const feed = ctx.session.scheduledFeed;
  const trip = feed?.trips.get(state.trip_id);
  if (!feed || !trip) {
    return missing(t('trip.missing', { id: state.trip_id }));
  }

  const route = feed.routes.get(trip.route_id);
  const shape = feed.shapes.get(trip.shape_id);
  const shortName = trip.raw.trip_short_name?.trim();

  return `
    <div class="space-y-4">
      <div class="space-y-1">
        ${route ? `<div class="flex items-center gap-2">${routeBadge(ctx, route)}</div>` : ''}
        <h2 class="text-lg font-semibold leading-tight">${escHtml(
          shortName || trip.headsign || trip.trip_id
        )}</h2>
        ${
          shortName && trip.headsign
            ? `<p class="text-xs opacity-60">${escHtml(trip.headsign)}</p>`
            : ''
        }
        <p class="text-xs opacity-60 font-mono">${escHtml(trip.trip_id)}</p>
      </div>

      ${renderAlertList(ctx, alertsForTrip(ctx.session, trip.trip_id, trip.route_id), t('trip.alerts'))}
      ${renderTrackers(ctx, rt, trip)}
      ${renderSchedule(ctx, rt, trip)}
      ${renderService(ctx, trip)}
      ${renderAssignments(ctx, trip)}

      ${section(
        t('alert.properties'),
        propList([
          prop(
            t('trip.route'),
            route
              ? entityLink(
                  ctx,
                  { type: 'route', route_id: route.id },
                  route.short_name || route.long_name || route.id
                )
              : escHtml(trip.route_id)
          ),
          prop('direction_id', escHtml(trip.direction_id || t('trip.none'))),
          prop(
            t('trip.shape'),
            trip.shape_id
              ? escHtml(
                  t('trip.shapePoints', {
                    id: trip.shape_id,
                    count: shape?.length ?? 0,
                  })
                )
              : `<span class="opacity-40">${t('trip.noShape')}</span>`
          ),
        ])
      )}
      ${renderRawFields('trips.txt', trip.raw)}
    </div>`;
}
