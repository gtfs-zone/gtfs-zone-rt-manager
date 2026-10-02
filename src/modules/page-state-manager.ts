import { PageStateManager } from 'gtfs-zone-web-common/ui/page-state-manager';
import { createPageStateCodec } from 'gtfs-zone-web-common/ui/page-state-schema';
import type { BreadcrumbItem } from 'gtfs-zone-web-common/ui/breadcrumb-trail';
import type { ModalState, PageLocation, PageState } from '../types/page-state';

/**
 * The hash names the page with an explicit `type` param. An unknown type, such
 * as a retired list page, falls back to home.
 */
const pageStateCodec = createPageStateCodec<PageLocation, ModalState>({
  typeParam: 'type',
  pages: {
    tracker: { tracker_id: 'tracker' },
    vehicle: { tracker_id: 'tracker', vehicle_key: 'vehicle' },
    alert: { alert_id: 'alert' },
    route: { route_id: 'route' },
    stop: { stop_id: 'stop' },
    trip: {
      trip_id: 'trip',
      route_id: { param: 'route', optional: true },
    },
  },
  modals: {
    alerts: {},
    help: { page: { param: 'modal_page', optional: true } },
  },
});

export type AppPageStateManager = PageStateManager<
  PageState,
  BreadcrumbItem<PageState>
>;

/** The one manager AppState owns, synced to the hash. */
export function createPageStateManager(): AppPageStateManager {
  return new PageStateManager({ codec: pageStateCodec, enableUrlSync: true });
}
