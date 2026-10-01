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

const ABOUT_APP: AboutApp = {
  name: 'manage.rt.gtfs.zone',
  blurb: [
    'manage.rt.gtfs.zone runs a GTFS Realtime feed: the schedule behind it, the trackers reporting positions, what each tracker is running today, and the alerts riders see.',
    'A feed here is published at rt.gtfs.zone for anybody to consume. What you set up on this map is what the world reads:',
  ],
  highlights: [
    'Feeds, with a schedule you link by URL or upload',
    'Trackers, and the trips they are assigned to',
    'Service alerts, written against the loaded schedule',
    'Managers, and who owns the feed',
  ],
  blurbFooter:
    'The schedule is parsed in your browser, so browsing a feed uploads nothing. Uploading a schedule is the exception and is the point of it: that zip is stored and served publicly at the permanent gtfs.zip URL of that feed.',
  contactSubject: 'manage.rt.gtfs.zone feedback',
  repo: 'gtfs-zone-rt-manager',
  sibling: {
    name: 'viz.rt.gtfs.zone',
    href: 'https://viz.rt.gtfs.zone',
    note: 'watch a realtime feed on a live map',
  },
};

/** The Project block, with this app as the one that is not linked. */
const PROJECT_SECTION = renderSection('Project', [
  `${link('https://gtfs.zone', 'gtfs.zone')}: the project these tools belong to`,
  `${link(ABOUT_APP.sibling.href, ABOUT_APP.sibling.name)}: ${ABOUT_APP.sibling.note}`,
  `${link('https://edit.gtfs.zone', 'edit.gtfs.zone')}: build and edit a GTFS schedule feed in the browser`,
]);

/** The Resources block: the two specs a feed here is written against. */
const RESOURCES_SECTION = renderSection('Resources', [
  `${link('https://gtfs.org/documentation/schedule/reference/', 'GTFS Schedule Reference')}: the file format behind a schedule`,
  `${link('https://gtfs.org/documentation/realtime/reference/', 'GTFS Realtime Reference')}: the field reference behind every alert and trip update here`,
]);

export const HELP_PAGES: HelpPage[] = [
  aboutPage(ABOUT_APP, [PROJECT_SECTION, RESOURCES_SECTION]),
  shortcutsPage,
];
