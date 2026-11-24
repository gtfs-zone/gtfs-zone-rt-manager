/**
 * This app's keyboard commands: the shared map set plus the feed switcher.
 * There is no load modal to open, so `Ctrl+O` reaches the feed switcher, which
 * is what picking a feed means here.
 *
 * Writes are deliberately unbound. Every one of them is a form behind a button
 * on the object it changes, and a key that creates an alert or provisions a
 * tracker from anywhere is a key pressed by accident.
 */

import type { ShortcutCommand } from 'gtfs-zone-web-common/ui/keyboard-shortcuts';
import {
  mapShortcuts,
  type MapShortcutHost,
} from 'gtfs-zone-web-common/ui/shortcut-list';
import { t } from '../i18n/messages';

interface ShortcutHost extends MapShortcutHost {
  /** Open the feed switcher and select whatever it returns. */
  openFeedSwitcher: () => Promise<void>;
}

export function managerShortcuts(host: ShortcutHost): ShortcutCommand[] {
  return mapShortcuts(host, [
    {
      keys: 'ctrl+o',
      description: t('shortcut.openSwitcher'),
      handler: (e) => {
        e?.preventDefault();
        return host.openFeedSwitcher();
      },
    },
  ]);
}
