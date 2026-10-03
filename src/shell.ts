/**
 * Mounts the shared app shell. Imported first by `index.ts`, so the markup
 * exists before any other module is evaluated and looks up an element id.
 */

import { mountAppShell } from 'gtfs-zone-web-common/ui/app-shell';
import { t } from './i18n/messages';

// No dock: the panel is the whole of the mobile UI here.
mountAppShell({
  brandPrefix: 'manage',
  brandSuffix: '.rt.gtfs.zone',
  panelPlaceholder: t('shell.noFeed'),
});
