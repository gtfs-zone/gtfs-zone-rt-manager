# gtfs-zone-rt-manager - Claude Guide

## Project Overview

Map-first manager for gtfs.zone feeds, trackers and tracker assignments, served
at `manage.rt.gtfs.zone`. A static Vite/TS/daisyUI SPA against rt-api's
authenticated JSON API. Replaces rt-api's SQLAdmin admin interface.

## Commands

```bash
pnpm install
pnpm dev          # watch build into dist/; there is no vite dev server
pnpm typecheck    # the gate before any commit
pnpm build
pnpm vendor:check # diff vendored files against rt-viewer
pnpm check-rt-spec     # diff src/gtfs-rt-spec against reference/
pnpm check-alert-enums # hold the alert enums to rt-api's alert_enums.py
pnpm check             # typecheck plus both of the above

git config core.hooksPath .githooks   # once per clone; runs both checks pre-commit

# Behind the real oauth2-proxy, at dev-stack's http://localhost:4180. That
# stack bind-mounts this dist/, so a rebuild is the whole deploy step.
VITE_RT_BASE=http://localhost:8000 pnpm build --watch
```

## Architecture

```
Keycloak (brokers GitHub / Google / GitLab)
  └─> oauth2-proxy (ForwardAuth, auth.gtfs.zone)
        └─> Traefik, host manage.rt.gtfs.zone
              ├─> /        nginx serving this SPA
              └─> /api/*   rt-api admin app (FastAPI)
```

Same host on purpose. Same origin means no CORS, no preflight on writes, and
the existing `X-Auth-Request-*` headers reach the API untouched.

The static GTFS feed is downloaded and parsed **in the browser**, the same way
rt-viewer does it, but from `GET /api/feeds/{id}/schedule.zip` rather than
from the feed's `static_feed_url` directly: same origin for both source kinds,
so there is no CORS refusal on a linked feed's zip and no stale prod URL for a
hosted one. The API serves the managed objects (feeds, trackers, rules, alerts,
members) and never the schedule otherwise.

A feed's schedule is set by one of two buttons on the feed page, *Upload GTFS
schedule* and *Load schedule from URL*, never by a `source_kind` field in a
form; whichever is used decides what the feed is.

## Shared modules (`gtfs-zone-web-common`)

A third of `src/` is no longer in this repo. The files that have moved out of
the apps live in the `gtfs-zone-web-common` package, a git dependency shipping raw
TypeScript with no build step. The scheduled feed parser is one of them, as
`gtfs-zone-web-common/gtfs/scheduled`, along with the feed clock, the calendar input,
the spec description renderer, which `src/index.ts` points at the realtime
reference, and the realtime half: the payload types, the live index, the alert
lookups and the page furniture the pages render through, and the app shell:
its markup (mounted by `src/shell.ts`, which `index.ts` must import first), its
stylesheet (`@import`ed by `src/styles/main.css`), the page-state manager, the
focus controller and the panel host. Import them as `gtfs-zone-web-common/ui/...`,
`gtfs-zone-web-common/gtfs/...`, `gtfs-zone-web-common/map/...` and `gtfs-zone-web-common/util/...`;
`tsconfig.json` `paths` and a `resolve.alias` in `vite.config.ts` both point at
`node_modules/gtfs-zone-web-common/src`.

A shared change is a commit in gtfs-zone-web-common, a tag, and a bump in each of the
three consumers. It is not edited here and `vendor:check` does not cover it.

Restart the dev server after a bump. The alias resolves through a pnpm symlink
into the store, and Vite does not watch `node_modules`, so files whose transform
is still cached keep importing the old store path: the page then holds two
copies of a shared module, each with its own module-level state. gtfs-zone-web-common's
`util/module-state` keeps that from corrupting anything and logs `loaded twice`.

What is still hand-copied is in `VENDORED.md`, and for that half rt-viewer is
still the upstream.

## Rules

- Do NOT use Playwright or any browser automation. The user does visual
  verification themselves. Stop at `pnpm typecheck` / `pnpm build` and hand off.
- `Tracker.device_key` is the Traccar provisioning credential. It must never
  appear in the URL hash, in a log line, or in anything shareable. It is served
  by `GET /api/trackers/{id}` alone and belongs in the properties panel only.
  `Tracker.id` is a surrogate and carries nothing: it is the right thing to put
  in navigation state, in the map feature key and in a request body.
- Every write sends the `X-RT-Manager` CSRF header. A fetch helper owns this;
  never call `fetch` for a mutation directly.
- A 302 or non-JSON response to an XHR means the oauth2-proxy session expired.
  Do a full page reload so the browser can follow the redirect chain. Never
  parse it as an error payload.
- Vendored files carry their banner and a `VENDORED.md` row, and rt-viewer is
  the upstream for all of them. Do not edit a `verbatim` file: change it
  upstream and re-vendor, promote it to `modified` with an `@changes` list, or
  promote it to `adopted` if this repo has taken it over for good.
- A file taken out of rt-viewer's tree keeps rt-viewer's own banner underneath
  ours. `vendor-check` strips the banner on the local side only, so deleting the
  inner one reports DRIFT.
- A tracker with a fix is a `VehiclePosition` in `FeedSession.vehicles`, keyed by
  `Tracker.id`, on the one vehicle map layer. There is no separate tracker layer:
  an unassigned tracker draws in `CONFIG.VEHICLE_UNMATCHED_COLOR` and is counted
  in `issues.vehiclesUnmatched`. Nickname is the label the map shows, unique
  within a feed but never the key.
- All magic numbers live in `src/config.ts`.
- The calendar's month grid (`src/modules/calendar-modal.ts`) is vendored from
  gtfs-zone-editor at `modified`: the cell shape and its scrolling chip stack are
  gtfs-zone-editor's, the chips themselves, the `FeedSession` data source and the
  timeline half are this repo's own. See `VENDORED.md`.
- dev-stack's `:4180` is the only local door: there is no vite dev server
  and no dev proxy, and `pnpm dev` is a watch build into the `dist/` that stack
  bind-mounts. Session expiry, the cookie, the CSRF header on a write, SSE
  through the proxy and signing out only exist behind the real oauth2-proxy,
  and a server forging the headers cannot fail the way production does.
- Signing out is a full navigation to `CONFIG.SIGN_OUT_URL`
  (`/oauth2/sign_out`), never a fetch: the endpoint answers with a redirect
  chain ending in HTML, which `api-client.ts` reads as an expired session.
- UI conventions live in gtfs-zone-web-common's `CLAUDE.md`: no `cursor-help`, `toggle` not `checkbox` for on/off settings, `SELECTED_ROW_CLASS` for picked list rows.

## Related Repos

| Repo | Description | URL |
|---|---|---|
| rt-api | GTFS-RT HTTP API serving real-time feeds, and this app's API | https://github.com/gtfs-zone/gtfs-zone-rt-api |
| rt-traccar-receiver | Worker that tracks and posts vehicle positions | https://github.com/gtfs-zone/gtfs-zone-rt-traccar-receiver |
| rt-delay-estimator | Worker that generates trip update predictions | https://github.com/gtfs-zone/gtfs-zone-rt-delay-estimator |
| static-importer | Worker that ingests and processes GTFS schedule data | https://github.com/gtfs-zone/gtfs-zone-static-importer |
| gtfs-zone-db-models | Shared Python library for GTFS types and utilities | https://github.com/gtfs-zone/gtfs-zone-db-models |
| dev-stack | Orchestration repo for deployments and infra | https://github.com/gtfs-zone/gtfs-zone-dev-stack |
| homepage | Static marketing/status site | https://github.com/gtfs-zone/gtfs-zone-homepage |
| rt-viewer | GTFS-RT visualizer, and upstream for the files still in `VENDORED.md` | https://github.com/gtfs-zone/gtfs-zone-rt-viewer |
| gtfs-zone-editor | GTFS editor, where most of the hand-copied modules were born; reached through rt-viewer, never copied from directly | https://github.com/gtfs-zone/gtfs-zone-editor |
| gtfs-zone-web-common | Shared UI/GTFS library, upstream for everything it holds; edited there, not here | https://github.com/gtfs-zone/gtfs-zone-web-common |
