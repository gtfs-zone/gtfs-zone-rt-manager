/**
 * Choosing a schedule zip: the drop zone, the preview under it, and the
 * new-feed dialog.
 *
 * The preview is the feature rather than decoration — the counts and the
 * service dates are how somebody notices they picked last year's export
 * before they upload it, and gtfs-zone-rt-api cannot tell them that because gtfs-zone-rt-api
 * only sees the file after it has been sent.
 *
 * A new feed is created with no schedule at all: `POST /feeds` makes a hosted
 * feed with nothing uploaded, and the feed page it lands on is where a zip is
 * uploaded or a URL is linked.
 */

import { CONFIG } from '../config';
import type { Feed, GtfsUpload } from '../types/api';
import { createFeed, uploadSchedule } from './api-client';
import { formatBytes } from 'gtfs-zone-web-common/gtfs/feed-download';
import type { FormField } from './entity-form';
import { showEntityForm } from './entity-form';
import { previewGtfsZip } from './gtfs-zip-preview';
import { escHtml } from 'gtfs-zone-web-common/gtfs/entity-render';
import { t } from '../i18n/messages';

/** Mirrors gtfs-zone-rt-api's `_FEED_NAME_RE`, so the refusal happens before the request. */
const FEED_NAME_RE = /^[a-z][a-z0-9_-]{2,63}$/;

/**
 * Render one preview result into the slot under a drop zone.
 *
 * A rejection is shown in the same place and the same shape as a server-side
 * 422 would be, so the two are not two different experiences of the same
 * refusal.
 */
// Which parse a slot is waiting for. Choosing a second file while the first is
// still parsing is ordinary — a big zip takes seconds — and without this the
// slower answer would land last and describe the wrong file.
const pending = new WeakMap<HTMLElement, symbol>();

function renderPreview(slot: HTMLElement, file: File): void {
  const token = Symbol('preview');
  pending.set(slot, token);
  slot.innerHTML = `<span class="text-xs opacity-60">
    <span class="loading loading-spinner loading-xs align-middle"></span>
    ${t('upload.reading', { name: escHtml(file.name) })}
  </span>`;

  void previewGtfsZip(file).then((preview) => {
    if (pending.get(slot) !== token || !slot.isConnected) {
      return;
    }
    if (!preview.ok) {
      slot.innerHTML = `<div class="alert alert-error alert-sm text-xs">
        <span>${escHtml(preview.reason)}</span>
      </div>`;
      return;
    }

    const s = preview.summary;
    const dates =
      s.serviceStart && s.serviceEnd
        ? t('upload.range', { start: s.serviceStart, end: s.serviceEnd })
        : t('upload.noService');
    const agencies = s.agencies.length
      ? s.agencies.join(', ')
      : t('upload.noAgency');
    slot.innerHTML = `<div class="rounded-lg bg-base-200 px-3 py-2 space-y-1 text-xs">
      <div class="font-semibold">${escHtml(agencies)}</div>
      <div class="opacity-70">${t('upload.counts', {
        routes: s.routes,
        stops: s.stops,
        trips: s.trips,
      })}</div>
      <div class="opacity-70">${t('upload.service', {
        dates: escHtml(dates),
        size: escHtml(formatBytes(s.sizeBytes)),
      })}</div>
    </div>`;
  });
}

/**
 * The drop zone field, with the parse wired to it.
 *
 * `visibleWhen` is left to the caller: the create form shows it only for a
 * hosted feed, and the replace form has nothing to hide it behind.
 */
export function scheduleZipField(
  overrides: Partial<FormField> = {}
): FormField {
  return {
    name: 'file',
    label: t('upload.zip'),
    type: 'file',
    accept: '.zip,application/zip',
    tooltip: t('upload.zipTooltip', {
      mb: Math.round(CONFIG.UPLOAD_MAX_BYTES / (1 << 20)),
    }),
    onFile: (file, slot) => {
      if (file) {
        renderPreview(slot, file);
      }
    },
    ...overrides,
  };
}

/** What gtfs-zone-rt-api's `AnyHttpUrl` accepts: an absolute http or https URL. */
export function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/** Upload a zip, reporting a rejected one under the drop zone rather than in a toast. */
export async function putSchedule(
  feedId: number,
  file: File
): Promise<GtfsUpload> {
  return uploadSchedule(feedId, file);
}

/**
 * The new-feed dialog: a name, nothing else.
 *
 * The feed is created hosted, with no schedule at all — the two buttons on
 * the feed page it lands on give it one. Resolves to the created feed, or
 * null if the dialog was closed.
 */
export async function showNewFeedForm(): Promise<Feed | null> {
  return showEntityForm<Feed>({
    title: t('upload.newTitle'),
    conflictField: 'feed_name',
    submitLabel: t('upload.create'),
    fields: [
      {
        name: 'feed_name',
        label: t('upload.name'),
        autofocus: true,
        placeholder: 'my-agency',
        tooltip: t('upload.nameTooltip'),
      },
    ],
    validate: (values): Record<string, string> | null => {
      if (!FEED_NAME_RE.test(values.feed_name.trim())) {
        return {
          feed_name: t('upload.nameInvalid'),
        };
      }
      return null;
    },
    submit: (values) =>
      createFeed({
        feed_name: values.feed_name.trim(),
        source_kind: 'hosted',
      }),
  });
}
