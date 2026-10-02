import type { WithModal } from 'gtfs-zone-web-common/ui/page-state-schema';

/**
 * Union of every page gtfs-zone-rt-manager can display. Each variant carries the minimal
 * set of object keys needed to identify and restore the page.
 *
 * `home` is the no-feed-selected state. Everything else is scoped to the
 * feed named by the hash's `feed` param, which is not part of PageState: the
 * feed is selection, not focus, and `PageStateManager.setFeedParams()` owns it.
 *
 * `tracker` is keyed by `Tracker.id`, never the `device_key` credential.
 * `vehicle` is one live vehicle of a tracker carrying several, keyed by
 * `VehiclePosition.key`. `trip` carries `route_id` so its breadcrumb renders
 * before the zip has finished parsing.
 */
export type PageLocation =
  | { type: 'home' }
  | { type: 'tracker'; tracker_id: string }
  | { type: 'vehicle'; tracker_id: string; vehicle_key: string }
  | { type: 'alert'; alert_id: string }
  | { type: 'route'; route_id: string }
  | { type: 'stop'; stop_id: string }
  | { type: 'trip'; trip_id: string; route_id?: string };

/**
 * The modals that live in the URL hash. The calendar, sharing and the feed
 * switcher are deliberately absent: the first two hold state the hash does not
 * carry, and the third edits the feed selection, which is in the hash already.
 *
 * A modal is orthogonal to the page beneath it: closing one returns to that
 * page rather than to a separate page state.
 */
export type ModalState = { type: 'alerts' } | { type: 'help'; page?: string };

export type PageState = WithModal<PageLocation, ModalState>;
