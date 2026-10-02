/**
 * The right panel's object pages: one dispatcher over `PageState`.
 *
 * The host, the realtime index, the live relative times and the route-strip
 * hover are `gtfs-zone-web-common`'s `RtPanel`. `home` is the feed itself, so
 * the panel always has a page to render, and pages emit `data-action` buttons
 * whose writes `actions.ts` owns.
 */

import type { PageState } from '../types/page-state';
import { RtPanel } from 'gtfs-zone-web-common/gtfs/rt-panel';
import type { VehiclePosition } from '../map-controller';
import type { FeedSession } from './feed-session';
import type { RenderContext, RtIndex } from './render-context';
import { renderAlertPage } from './pages/alert-page';
import { renderRoutePage } from './pages/route-page';
import { renderStopPage } from './pages/stop-page';
import { renderTrackerPage } from './pages/tracker-page';
import { renderVehiclePage } from './pages/vehicle-page';
import { renderFeedPage } from './pages/feed-page';
import { renderTripPage } from './pages/trip-page';

export interface PanelRendererHooks {
  /** Navigate to a page, as if the user had clicked it on the map. */
  navigate: (state: PageState) => void;
  /** The full hash for a page, so links are real links. */
  href: (state: PageState) => string;
  /** Light a stop on the map while its route-strip row is hovered. */
  hoverStop: (stop_id: string | null) => void;
  /** Run a write, named by the button that asked for it. */
  action: (action: string, arg: string) => void;
}

// `change` covers every managed update, `vehicles` the live fleet,
// `assignments` an expanded calendar window and `scheduleloaded` the parsed
// zip. `vehicles` is separate from `change` because it fires per pushed fix,
// which the map wants and most of the rest of the app does not.
const SESSION_EVENTS = [
  'change',
  'vehicles',
  'assignments',
  'scheduleloaded',
] as const;

export class PanelRenderer extends RtPanel<PageState, VehiclePosition> {
  constructor(
    host: HTMLElement,
    session: FeedSession,
    hooks: PanelRendererHooks
  ) {
    super(host, session, SESSION_EVENTS, {
      ...hooks,
      renderPage: (state, index) =>
        renderPage({ session, href: hooks.href }, index, state),
    });
  }
}

function renderPage(
  ctx: RenderContext,
  index: RtIndex,
  state: PageState
): string {
  switch (state.type) {
    case 'home':
      return renderFeedPage(ctx);
    case 'route':
      return renderRoutePage(ctx, index, state);
    case 'stop':
      return renderStopPage(ctx, index, state);
    case 'trip':
      return renderTripPage(ctx, index, state);
    case 'alert':
      return renderAlertPage(ctx, state);
    case 'tracker':
      return renderTrackerPage(ctx, state);
    case 'vehicle':
      return renderVehiclePage(ctx, state);
  }
}
