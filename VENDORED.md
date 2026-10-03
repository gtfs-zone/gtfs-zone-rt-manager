# Vendored files

## The shared half is mostly a dependency now

The files that have moved out of the apps live in **`gtfs-zone-web-common`**, a
git dependency shipping raw TypeScript with no build step. They are imported as
`gtfs-zone-web-common/ui/...`, `gtfs-zone-web-common/gtfs/...`, `gtfs-zone-web-common/map/...` and
`gtfs-zone-web-common/util/...`, resolved by `tsconfig.json` `paths` and a
`resolve.alias` in `vite.config.ts`, both pointing at
`node_modules/gtfs-zone-web-common/src`.

They are **not in the table below and not checked by `vendor:check`**: a package
version is the contract. A shared change there is a commit in gtfs-zone-web-common, a
tag, and a bump in each of the three consumers. It is not edited here.

## What is still vendored

Everything below is still a hand-copied file, marked with a banner as the very
first lines of the file:

```ts
/* @vendored-from gtfs-zone-rt-viewer:src/modules/breadcrumbs.ts
   @sha d169427
   @status modified */
```

`@status` is one of:
- `verbatim`: byte-identical apart from the banner. Re-sync = overwrite + re-add banner.
- `modified`: adapted. Must be followed by an `@changes` line listing what diverged,
  one bullet per change, so a re-sync knows what to re-apply.
- `adopted`: gtfs-zone-rt-manager's file now. The banner records where it came from and
  nothing is checked, neither drift nor staleness. A file moves here when feature
  work has taken it over far enough that re-syncing has stopped being meaningful,
  here or upstream.
- `origin`: not vendored at all, but the canonical copy another repo vendors
  *from*. Carries no banner, no source repo and no SHA; listed so the table is
  the whole map of what is shared.

`adopted` exists so `verbatim` stays a contract that is actually enforced. Files
the features own will drift by design: promote one to `adopted` rather than
contorting the feature to keep a row green. What is left under `verbatim` is then
a real guarantee about the files nobody has taken over.

The four statuses and the six columns are the same here and in gtfs-zone-rt-viewer's own
`VENDORED.md`, which adopted this form along with `scripts/vendor-check.ts`.

**gtfs-zone-rt-viewer is the upstream** for what is left. Everything here resolves
against it, with the exceptions noted below. The rule no longer covers the
shared half that moved to `gtfs-zone-web-common`, which is edited there and reaches all
three repos as a version bump; neither gtfs-zone-rt-viewer nor gtfs-zone-editor is its
upstream any more. The earlier two-upstream plan, gtfs-zone-editor for the shell
and gtfs-zone-rt-viewer for the realtime modules, did not survive the import graph:
gtfs-zone-rt-viewer has already adapted gtfs-zone-editor's map and panel modules from the
editor model to the `GTFSScheduled` model gtfs-zone-rt-manager shares, so re-deriving them
from gtfs-zone-editor would reproduce gtfs-zone-rt-viewer's files by hand. Where gtfs-zone-rt-viewer
carries a gtfs-zone-editor file verbatim the bytes are identical either way, so
those rows resolve against gtfs-zone-rt-viewer too and the gtfs-zone-editor origin is
recorded in the note. Nothing ever flows the other way: a change wanted upstream
is made upstream and re-vendored.

The exceptions all name gtfs-zone-editor, and there are two left now that
`modal-utils.ts`, `tooltip-position.ts`, `breadcrumb-trail.ts` and
`calendar-modal.ts` are package modules. `spec-markup.ts` is one, for the same underlying reason as the RT spec
below — spec-driven form labels are a gtfs-zone-editor idea that gtfs-zone-rt-viewer has no
counterpart to, because gtfs-zone-rt-viewer edits nothing. `calendar-input.ts` is the
second, and the only one gtfs-zone-rt-viewer does not have at all: it edits nothing, so
it has no date to pick. It is also not in the package's first cut for exactly
that reason, and its row stays until a second wave takes it.

`src/modules/pages/feed-page.ts`, `src/modules/pages/tracker-page.ts`,
`src/modules/pages/trip-page.ts`, `src/modules/share-modal.ts`,
`src/modules/alerts-modal.ts`,
`src/modules/managed-render.ts`, `src/modules/service-date.ts`,
`src/modules/trip-picker.ts` and `src/shell.ts`
(this app's options to the shared shell markup: its brand and no dock) are in neither
tier and deliberately absent from the table: they are gtfs-zone-rt-manager's own files
with no upstream at all. gtfs-zone-rt-viewer browses route, stop, vehicle and alert, and
shows a feed status page when nothing is focused; this repo's hierarchy runs
Feed -> Route -> Trip, its home page is the feed itself with the trackers and
routes hanging off it as scrollboxes rather than as pages, and the managed half
of that hierarchy — feeds, trackers, assignments, alerts and members — has no
counterpart upstream at all, because gtfs-zone-rt-viewer owns none of those objects.
Sharing and the alert list are navbar modals for the same reason: nothing
upstream has an object to put in them. `navbar-action-list.ts`
and `shortcut-list.ts` are in neither tier for a third reason: they are the two
descriptor lists the shared renderers are parameterized over, and a list of this
app's own actions and keys is the app itself, not a copy of anything.

`src/gtfs-rt-spec/` is not vendored and is not in the table. Its *shape* is
gtfs-zone-editor's `src/gtfs-spec/` — the same `types.ts` / `files/*.ts` /
`index.ts` split, the same verbatim-description discipline, the same
reference-snapshot-plus-checker arrangement — but not one line of its content
comes from a sibling, because gtfs-zone-editor describes the schedule spec and this
describes the realtime one. There is nothing to re-sync and nothing to diff, so
`vendor-check` is told about none of it. What holds it honest instead is
`scripts/check-rt-spec.ts` against `reference/gtfs-realtime-reference.md`, and
`scripts/check-alert-enums.ts` against gtfs-zone-rt-api's `alert_enums.py`. Both run
from `pnpm check`, which the pre-commit hook runs.

Run `pnpm vendor:check` to diff every `verbatim` entry against its recorded SHA
in the repo its `Source repo` column names, and to report every `verbatim` and
`modified` entry whose source has moved since (rows whose sibling is not checked
out are skipped, so CI is never blocked by it). `adopted` and `origin` rows are
listed and then left alone. `--strict` makes staleness fatal; the pre-commit hook runs
without it on purpose, so a sibling's commit cannot break a commit here.

| Local path | Source repo | Source path | SHA | Status | Note |
|---|---|---|---|---|---|
| `scripts/vendor-check.ts` | — | — | — | origin | Not vendored: written here, and the one file the flow runs backwards for. gtfs-zone-rt-viewer adopted this table's `Source repo`-aware form in its Phase 1 and vendors the script from here `modified` at `5dc61ef`, differing only in its doc comment. Listed so the table is the whole map of what is shared |
