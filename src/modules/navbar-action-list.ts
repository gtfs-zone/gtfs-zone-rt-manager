import { renderNavIcon } from 'gtfs-zone-web-common/ui/nav-icons';
import {
  realtimeNavbarActions,
  renderOutlineIcon,
} from 'gtfs-zone-web-common/ui/navbar-action-list';
import { t } from '../i18n/messages';

/**
 * This app's navbar action row. Element ids are the contract with the click
 * wiring and the badge writers in `src/index.ts`.
 */

const SHARE_PATH =
  'M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0 0a2.25 2.25 0 1 0 3.935 2.186 2.25 2.25 0 0 0-3.935-2.186Zm0-12.814a2.25 2.25 0 1 0 3.933-2.185 2.25 2.25 0 0 0-3.933 2.185Z';
const USER_PATH =
  'M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z';

export const NAVBAR_ACTIONS = realtimeNavbarActions({
  repo: 'gtfs-zone-rt-manager',
  leading: [
    {
      kind: 'icon',
      id: 'calendar-btn',
      // The month a feed runs, and who is covering it. The badge counts today's
      // assignments once they are loaded.
      label: t('nav.calendar'),
      icon: renderNavIcon('calendar'),
      badgeId: 'calendar-count',
      badgeClass: 'badge-primary',
    },
    {
      kind: 'icon',
      id: 'share-btn',
      // Who manages this feed, and who has been invited.
      label: t('nav.share'),
      icon: renderOutlineIcon(SHARE_PATH),
    },
  ],
  trailing: [
    {
      kind: 'labeled',
      id: 'user-btn',
      // The signed-in person, labelled with their own name or address at boot.
      // Starts hidden and opens the account modal, which holds the link out to
      // Keycloak's Account Console and sign-out.
      label: t('nav.account'),
      labelId: 'user-label',
      icon: renderOutlineIcon(USER_PATH, 'h-4 w-4'),
      btnClass: 'btn-ghost',
    },
    {
      kind: 'labeled',
      id: 'feed-switcher-btn',
      // Your feeds only, plus New feed. Last, and the only primary button.
      label: t('nav.selectFeed'),
      labelId: 'feed-switcher-label',
      icon: renderNavIcon('load', { sizeClass: 'h-4 w-4' }),
      btnClass: 'btn-primary',
    },
  ],
});
