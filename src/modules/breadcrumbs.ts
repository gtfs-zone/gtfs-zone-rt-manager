/**
 * Synchronous breadcrumb building and focus validation against the session.
 *
 * Our whole model is in memory — parsed GTFS plus the API objects the session
 * holds — so both of these are plain reads rather than the async, database
 * backed lookups gtfs-zone-editor needs.
 */

import type { PageState } from '../types/page-state';
import type { BreadcrumbItem } from 'gtfs-zone-web-common/ui/breadcrumb-trail';
import type { StopPageRef } from 'gtfs-zone-web-common/gtfs/breadcrumbs';
import {
  alertParentCrumb,
  routeCrumb,
  rtAlertHeader,
  rtAlertParent,
  stopCrumbs,
  truncateCrumb,
} from 'gtfs-zone-web-common/gtfs/breadcrumbs';
import type { RoutePageRef } from 'gtfs-zone-web-common/gtfs/entity-render';
import type { FeedSession } from './feed-session';
import { t } from '../i18n/messages';

function home(session: FeedSession): BreadcrumbItem<PageState> {
  return {
    typeLabel: t('crumb.feed'),
    label: truncateCrumb(session.feed?.feed_name ?? t('crumb.feed')),
    pageState: { type: 'home' },
  };
}

export function tripLabel(session: FeedSession, tripId: string): string {
  const trip = session.scheduledFeed?.trips.get(tripId);
  return trip?.headsign || tripId;
}

/** Nickname is the label a tracker shows; the surrogate is the fallback. */
export function trackerLabel(session: FeedSession, trackerId: string): string {
  return session.trackers.get(trackerId)?.nickname || trackerId;
}

/** A live vehicle's own label; an expired one has nothing left to name it by. */
export function vehicleLabel(session: FeedSession, key: string): string {
  const vehicle = session.vehicles.get(key);
  return vehicle?.label || vehicle?.vehicleId || t('crumb.vehicle');
}

export function alertLabel(session: FeedSession, alertId: string): string {
  const managed = session.serviceAlerts.get(alertId);
  if (managed) {
    return managed.header_text || t('alerts.fallback', { id: alertId });
  }
  return (
    rtAlertHeader(session.alerts, alertId) ??
    t('alerts.fallback', { id: alertId })
  );
}

/** The route a trip belongs to, from the state or from the parsed feed. */
function tripRouteId(session: FeedSession, state: PageState): string | null {
  if (state.type !== 'trip') {
    return null;
  }
  return (
    state.route_id ??
    session.scheduledFeed?.trips.get(state.trip_id)?.route_id ??
    null
  );
}

/** The first entity an alert names that we have a page for. */
function alertParent(
  session: FeedSession,
  alertId: string
): RoutePageRef | StopPageRef | null {
  // The managed detail is the authority when it has been fetched; the entity
  // list only exists on the detail, so a summary alone names no parent.
  for (const entity of session.alertDetails.get(alertId)?.entities ?? []) {
    if (entity.route_id) {
      return { type: 'route', route_id: entity.route_id };
    }
    if (entity.stop_id) {
      return { type: 'stop', stop_id: entity.stop_id };
    }
  }

  return rtAlertParent(session.alerts, alertId);
}

export function buildBreadcrumbs(
  session: FeedSession,
  state: PageState
): BreadcrumbItem<PageState>[] {
  const feed = session.scheduledFeed;
  switch (state.type) {
    case 'home':
      return [];

    case 'tracker':
      return [
        home(session),
        {
          typeLabel: t('crumb.tracker'),
          label: truncateCrumb(trackerLabel(session, state.tracker_id)),
          pageState: state,
        },
      ];

    case 'vehicle':
      return [
        home(session),
        {
          typeLabel: t('crumb.tracker'),
          label: truncateCrumb(trackerLabel(session, state.tracker_id)),
          pageState: { type: 'tracker', tracker_id: state.tracker_id },
        },
        {
          typeLabel: t('crumb.vehicle'),
          label: truncateCrumb(vehicleLabel(session, state.vehicle_key)),
          pageState: state,
        },
      ];

    case 'route':
      return [home(session), routeCrumb(feed, state.route_id)];

    case 'stop':
      return [home(session), ...stopCrumbs(feed, state.stop_id)];

    case 'trip': {
      const routeId = tripRouteId(session, state);
      return [
        home(session),
        ...(routeId ? [routeCrumb(feed, routeId)] : []),
        {
          typeLabel: t('crumb.trip'),
          label: truncateCrumb(tripLabel(session, state.trip_id)),
          pageState: state,
        },
      ];
    }

    case 'alert': {
      const parent = alertParent(session, state.alert_id);
      return [
        home(session),
        ...(parent ? [alertParentCrumb(feed, parent)] : []),
        {
          typeLabel: t('crumb.alert'),
          label: truncateCrumb(alertLabel(session, state.alert_id)),
          pageState: state,
        },
      ];
    }
  }
}

/**
 * Whether a focus still names something the session can render.
 *
 * The GTFS variants are checked against the parsed feed, so they answer false
 * until the zip has finished — which is why the caller re-checks on
 * `scheduleloaded` rather than dropping a pending focus on the first miss.
 *
 * A tracker or alert is checked against the API list once it has arrived, and
 * accepted while it is empty: an empty map is "not fetched yet" as often as it
 * is "no such object", and a good link should not be discarded by a slow
 * request.
 */
export function validateState(session: FeedSession, state: PageState): boolean {
  switch (state.type) {
    case 'home':
      return true;
    case 'route':
      return session.scheduledFeed?.routes.has(state.route_id) ?? false;
    case 'stop':
      return session.scheduledFeed?.stops.has(state.stop_id) ?? false;
    case 'trip':
      return session.scheduledFeed?.trips.has(state.trip_id) ?? false;
    case 'tracker':
    case 'vehicle':
      return (
        session.trackers.size === 0 || session.trackers.has(state.tracker_id)
      );
    case 'alert':
      if (session.serviceAlerts.has(state.alert_id)) {
        return true;
      }
      return session.serviceAlerts.size === 0 && session.alerts.size === 0;
  }
}
