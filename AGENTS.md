# AGENTS.md

Map-first manager for gtfs.zone feeds, trackers and tracker assignments, at
`manage.rt.gtfs.zone`. A static SPA against rt-api's authenticated JSON API,
replacing rt-api's SQLAdmin. A `v*` tag builds and deploys the image.

## Commands

```bash
pnpm check             # typecheck + check-rt-spec + check-alert-enums
VITE_RT_BASE=http://localhost:8000 pnpm build --watch   # into dev-stack's :4180
```

## Architecture

Keycloak -> oauth2-proxy (`auth.gtfs.zone`) -> Traefik on `manage.rt.gtfs.zone`:
`/` is nginx serving this SPA, `/api/*` is rt-api's admin app. Same origin on
purpose: no CORS, no preflight, and the `X-Auth-Request-*` headers reach the API.

- **One local door**: dev-stack's `:4180`, behind the real oauth2-proxy. There is
  no vite dev server and no dev proxy; `pnpm dev` is a watch build into the
  bind-mounted `dist/`. See [README.md](README.md#one-local-door).
- **Schedule in the browser**: fetched from `GET /api/feeds/{id}/schedule.zip`,
  never the feed's `static_feed_url`. It is set by the *Upload GTFS schedule* or
  *Load schedule from URL* button, never a `source_kind` form field.
- **`Tracker.device_key` is a credential**: never in the URL hash, a log line, or
  anything shareable. Only `GET /api/trackers/{id}` serves it, for the properties
  panel. Use the surrogate `Tracker.id` in navigation state, map keys and bodies.
- **Writes** go through the fetch helper, which sends the `X-RT-Manager` CSRF
  header. Never call `fetch` for a mutation directly.
- **Session expiry**: a 302 or non-JSON XHR response means the session expired.
  Do a full page reload; never parse it as an error. Signing out is a full
  navigation to `CONFIG.SIGN_OUT_URL`, never a fetch.
- **Trackers are vehicles**: a tracker with a fix is a `VehiclePosition` in
  `FeedSession.vehicles`, keyed by `Tracker.id`, on the one vehicle layer.
  Unassigned ones draw in `CONFIG.VEHICLE_UNMATCHED_COLOR`. Nickname is the label,
  never the key.
- All magic numbers live in `src/config.ts`.

### Shared modules (`gtfs-zone-web-common`)

The feed parser, realtime types, page furniture and app shell come from the
`gtfs-zone-web-common` git dependency (raw TypeScript), aliased in
`tsconfig.json` and `vite.config.ts`. `src/shell.ts` mounts the shell and
`index.ts` must import it first. A shared change is a commit, tag and bump
there, never an edit here. Restart the watch build after a bump (a stale copy
logs `loaded twice`).

## Conventions

- **Commits**: Conventional Commits, enforced by the `commit-msg` hook. Setup and
  release are in [CONTRIBUTING.md](CONTRIBUTING.md).
- **Verification**: no Playwright or other browser automation. Stop at
  `pnpm typecheck` / `pnpm build` and hand off; the user checks in the browser.
- **UI**: conventions live in gtfs-zone-web-common's `AGENTS.md`.
- **Plans**: write plans to `CURRENT_PLAN.md` at the repo root as a
  checklist (`- [ ]`), ticked off as work lands. It is neither tracked nor
  gitignored: never stage or commit it.
