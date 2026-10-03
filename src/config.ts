/**
 * Application-wide configuration constants.
 * All magic numbers live here, import CONFIG rather than inlining literals.
 *
 * The map and realtime blocks are the constants `gtfs-zone-web-common`'s map stack and
 * the vendored realtime files read. They came across with those files (see
 * VENDORED.md) and are kept in the same order as gtfs-zone-rt-viewer's so the two are
 * diffable.
 */
export const CONFIG = {
  // Same-origin in every environment. In production Traefik routes
  // manage.rt.gtfs.zone/api/* to gtfs-zone-rt-api's admin app; in dev vite proxies it
  // to localhost:8001 with forged oauth2-proxy headers. Never an absolute URL:
  // a cross-origin API would need CORS and credentialed preflights that
  // production deliberately does not have.
  API_BASE: '/api',

  // Header that makes a write ineligible for a cross-site form post. A simple
  // request cannot carry it, so its presence proves the caller ran our JS.
  CSRF_HEADER: 'X-RT-Manager',

  // oauth2-proxy's sign-out endpoint, same origin like everything else.
  // Relative on purpose, the way gtfs-zone-rt-api's `oauth2_proxy_logout_url` is.
  // Reached by a full navigation and never by fetch: it answers with a
  // redirect chain and then HTML, which api-client reads as an expired
  // session.
  SIGN_OUT_URL: '/oauth2/sign_out',

  // localStorage keys. Per-device preferences, deliberately not in the URL.
  MAP_VIEW_KEY: 'ym.map.view',
  MAP_APPEARANCE_KEY: 'ym.map.appearance',
  SELECTED_FEED_KEY: 'ym.feed',

  // Trips listed on a route page before the list is capped. A busy route has
  // thousands; the page says how many it left out.
  ROUTE_TRIP_LIST_MAX: 200,

  // Rules listed on the assignments page before the list is capped.
  RULE_LIST_MAX: 200,

  // Routes listed in the feed page's Routes scrollbox before it is capped. The
  // panel rebuilds every row on each realtime poll, so a feed with thousands of
  // routes is capped and points at the search box.
  ROUTE_LIST_MAX: 200,

  // Places listed on the stops page before it is capped. The only list page
  // that caps: a large feed has tens of thousands of stops, and the panel
  // rebuilds every row on each realtime poll.
  STOP_LIST_MAX: 1000,

  // Services drawn on the services page before the chart is capped. A chart
  // row is a whole table row of cells, so a feed with thousands of one-day
  // services would render hundreds of thousands of them.
  SERVICE_LIST_MAX: 200,

  // The first day of a displayed week, in `Date.getUTCDay()` numbering, so 0
  // is Sunday. Display only: `WEEKDAY_KEYS` stays Monday-first because it
  // names the rule columns the API writes.
  WEEK_START: 0,

  // Weeks listed on the assignments page, and so the window its expansion is
  // fetched over. Six is a month and a half of planning without asking the
  // server for a year of occurrences nobody is looking at.
  ASSIGNMENT_WEEKS: 6,

  // The timeline chart. One fixed-width cell per column, so a row is a set of
  // equal boxes rather than a measured bar: nothing here needs a layout pass.
  // Week cells are narrow because a three-year range is ~157 of them; a day
  // cell has to hold a weekday header and a tracker nickname, so it is wider.
  TIMELINE_WEEK_CELL_PX: 20,
  TIMELINE_DAY_CELL_PX: 64,
  TIMELINE_ROW_PX: 28,

  // The sticky label column, clamped off the longest row label at roughly one
  // character per this many pixels plus room for the dot.
  TIMELINE_LABEL_MIN_PX: 80,
  TIMELINE_LABEL_MAX_PX: 300,
  TIMELINE_LABEL_CHAR_PX: 7,
  TIMELINE_LABEL_PAD_PX: 32,

  // How much of a range the chart will draw before it truncates and says so. A
  // feed with a stray year-3000 calendar row would otherwise render a hundred
  // thousand cells and hang the panel.
  TIMELINE_MAX_DAYS: 1096,

  // How far past today an open-ended rule is drawn on the calendar's timeline.
  // A rule with no end_date runs forever; a chart has to stop somewhere.
  CALENDAR_OPEN_END_DAYS: 180,

  // Realtime poll interval, read by the vendored poller. Per-device, so it is
  // deliberately not in the hash.
  RT_INTERVAL_KEY: 'ym.rt.interval',
  RT_INTERVAL_DEFAULT_MS: 15000,
  RT_INTERVAL_OPTIONS_MS: [5000, 10000, 15000, 30000, 60000],

  // Tracker liveness. Positions carry a 60s TTL in Redis, so anything older
  // than that is not "stale", it is gone.
  TRACKER_STALE_MS: 60_000,

  // How often the client checks for vehicles that have aged past that. An
  // expiry is not an event, so nothing pushes one; without this sweep a
  // tracker that stopped reporting would sit on the map forever, in its last
  // known place, looking exactly like one that is still moving. Well under the
  // TTL, so the dot goes within a few seconds of the fix being gone server-side.
  TRACKER_PRUNE_MS: 5_000,

  // The feed event stream. A browser reconnects a *dropped* stream by itself;
  // these govern the case it will not retry, which is a response that was not
  // an event stream at all. That is almost always an expired oauth2-proxy
  // session answering with a login page, and the only fix for one is a full
  // page load, so the retries are capped rather than endless.
  SSE_RETRY_BASE_MS: 1000,
  SSE_RETRY_MAX_MS: 15_000,
  SSE_MAX_RETRIES: 4,

  // Where a path-only feed URL resolves to. Dev is gtfs-zone-dev-stack's
  // gtfs-zone-rt-api (`docker-compose.yml`, service `api`); prod is the deployed feed
  // server. Read by `gtfs-zone-web-common`'s `feed-url-resolve.ts`, which all three
  // apps share and so cannot hardcode either.
  //
  // The DEV flag alone is not enough: the copy served behind the local
  // oauth2-proxy is a production build, so it would resolve against the real
  // feed server while everything else it talks to is local. VITE_RT_BASE is
  // how that build says otherwise.
  //
  // Read through `?.` because `scripts/` imports modules that reach this file
  // under tsx, where there is no vite env to read at all.
  RT_BASE:
    import.meta.env?.VITE_RT_BASE ??
    (import.meta.env?.DEV ? 'http://localhost:8000' : 'https://rt.gtfs.zone'),

  // The cap gtfs-zone-rt-api enforces on an uploaded schedule zip
  // (`max_gtfs_zip_bytes`, which is also gtfs-zone-static-importer's download cap).
  // Mirrored so the drop zone refuses an oversized file before spending a
  // minute sending it; the server still enforces it, this only saves the wait.
  UPLOAD_MAX_BYTES: 31_457_280,

  // Uploads the feed page lists before the rest are left to the server's own
  // retention. Matches gtfs-zone-rt-api's `keep_uploads`, so a full history fits.
  UPLOAD_HISTORY_MAX: 10,

  // Trips a `<select>` may offer before the field falls back to the searchable
  // combo. A scoped list is usually a route's day of service; past this it is
  // a feed, and a dropdown is the wrong shape for one.
  TRIP_SELECT_MAX: 200,

  // Rows an id combo lists at once. The popup is a shortlist to pick from, not
  // a way to page through a feed's fifty thousand stops: a query that matches
  // more than this means "type more". Same number the trip options use.
  COMBO_RESULT_LIMIT: 50,

  // Prod URLs of the sibling apps, for deep links out of a properties page.
  VIZ_BASE: 'https://viz.rt.gtfs.zone',
  EDITOR_BASE: 'https://edit.gtfs.zone',
} as const;
