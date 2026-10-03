/**
 * The help page registry: what pages exist, their grouping, and their copy.
 *
 * Rendering lives in `help-modal.ts`. This module is data only.
 */

import {
  renderExternalLink as link,
  renderSection,
  type AboutApp,
} from 'gtfs-zone-web-common/ui/about-links';
import {
  aboutPage,
  shortcutsPage,
  type HelpPage,
} from 'gtfs-zone-web-common/ui/help-pages';
import { t } from '../i18n/messages';

const ABOUT_APP: AboutApp = {
  name: 'manage.rt.gtfs.zone',
  blurb: [t('help.about.blurb'), t('help.about.blurb2')],
  highlights: [
    t('help.about.feeds'),
    t('help.about.trackers'),
    t('help.about.alerts'),
    t('help.about.managers'),
  ],
  blurbFooter: t('help.about.footer'),
  contactSubject: t('help.about.subject'),
  repo: 'gtfs-zone-rt-manager',
  sibling: {
    name: 'viz.rt.gtfs.zone',
    href: 'https://viz.rt.gtfs.zone',
    note: t('help.about.sibling'),
  },
};

/** The Project block, with this app as the one that is not linked. */
const PROJECT_SECTION = renderSection(t('help.about.project'), [
  `${link('https://gtfs.zone', 'gtfs.zone')}: ${t('help.about.site')}`,
  `${link(ABOUT_APP.sibling.href, ABOUT_APP.sibling.name)}: ${ABOUT_APP.sibling.note}`,
  `${link('https://edit.gtfs.zone', 'edit.gtfs.zone')}: ${t('help.about.editor')}`,
]);

/** The Resources block: the two specs a feed here is written against. */
const RESOURCES_SECTION = renderSection(t('help.about.resources'), [
  `${link('https://gtfs.org/documentation/schedule/reference/', 'GTFS Schedule Reference')}: ${t('help.about.schedule')}`,
  `${link('https://gtfs.org/documentation/realtime/reference/', 'GTFS Realtime Reference')}: ${t('help.about.realtime')}`,
]);

export const HELP_PAGES: HelpPage[] = [
  aboutPage(ABOUT_APP, [PROJECT_SECTION, RESOURCES_SECTION]),
  shortcutsPage,
];
