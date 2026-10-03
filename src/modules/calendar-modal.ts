/**
 * The calendar: one month of the feed at a time, and the same waterfall the
 * rest of the app draws.
 *
 * Two questions are asked of a feed's calendar and
 * they have different shapes: "does this run today" is a month grid, and "who
 * is covering it over the next few weeks" is the timeline chart. Both are here,
 * as two tabs over one set of data, because the answer to either is the other
 * half of the same plan.
 *
 * It lives off the navbar rather than in the panel, so it can be opened from
 * any page without losing the object the reader was on. That is also why every
 * link inside it is delegated here rather than by `PanelRenderer`: the modal is
 * mounted on `document.body`, outside the panel host, so the panel's `data-nav`
 * handler never sees these clicks. The markup is the same — a real `<a href>`
 * carrying the target hash — so middle-click and copy-link-address still work;
 * a plain click closes the modal first and then navigates, since the page
 * behind it is about to change.
 *
 * Rows and chips are read-only. A tracker chip is the way to the object that
 * owns the rule, which is where a write to it lives.
 */

import { CONFIG } from '../config';
import type { Assignment, TrackerRule } from '../types/api';
import type { PageState } from '../types/page-state';
import type { FeedSession } from './feed-session';
import { ISO_DATE_CODEC } from 'gtfs-zone-web-common/ui/calendar-input';
import {
  renderMonthGrid,
  showCalendarModal as showSharedCalendarModal,
} from 'gtfs-zone-web-common/ui/calendar-modal';
import { formatWindow } from './managed-render';
import type { RenderContext } from './render-context';
import { escHtml, section } from 'gtfs-zone-web-common/gtfs/entity-render';
import {
  serviceCatalog,
  serviceRunsOn,
  sortByCascade,
  type ServiceSummary,
} from './service-catalog';
import {
  addDays,
  addMonths,
  startOfMonth,
  today,
  type ServiceDate,
} from './service-date';
import { assignmentCounts } from './service-catalog';
import {
  renderTimelineChart,
  weekdayFlags,
  type TimelineRow,
} from './timeline-chart';
import { tripName } from './trip-picker';
import { t } from '../i18n/messages';

export interface CalendarModalHooks {
  ctx: RenderContext;
  /** Navigate the panel. Called after the modal has closed. */
  navigate: (state: PageState) => void;
  /** Expand the rules over a window, widening whatever is held. */
  ensureAssignments: (from: ServiceDate, to: ServiceDate) => Promise<void>;
  /** Load the feed's rules if they are not already in the session. */
  ensureRules: () => Promise<void>;
}

/**
 * What the navbar badge says: the assignments running today.
 *
 * Null when the answer is not known yet — no feed, or an expansion window that
 * does not reach today — because a badge showing 0 would claim nothing is
 * running when nothing has been asked.
 */
export function calendarBadgeCount(session: FeedSession): number | null {
  if (!session.feed) {
    return null;
  }
  const range = session.assignmentsRange;
  const date = today();
  if (!range || range.from > date || range.to < date) {
    return null;
  }
  return session.assignmentsOn(date).length;
}

// ─── The month grid ───────────────────────────────────────────────────────────

/** A link inside the modal: a real anchor, navigated by the modal's own handler. */
function chipLink(
  ctx: RenderContext,
  state: PageState,
  label: string,
  className: string,
  style = '',
  title = label
): string {
  return `<a href="${escHtml(ctx.href(state))}" data-nav="${escHtml(JSON.stringify(state))}"
    class="${className}" style="${style}" title="${escHtml(title)}">${escHtml(label)}</a>`;
}

const CHIP_CLASS =
  'block truncate rounded px-1 text-[10px] leading-4 hover:brightness-110';

/**
 * One service running that day, in the accent.
 *
 * A chip rather than a link: a service is not an object this app browses, so
 * the id is a fact about the day and nothing more.
 */
function serviceChip(service: ServiceSummary): string {
  return `<span class="${CHIP_CLASS} bg-primary/15 text-primary font-mono"
    title="${escHtml(t('cal.service', { id: service.id }))}">${escHtml(service.id)}</span>`;
}

/**
 * One tracker running one trip that day.
 *
 * Coloured by the trip's route where the zip has it, so the chips agree with
 * the map and with every chart in the app. The label is the nickname, which is
 * what the map draws, and the title carries the trip and the window.
 */
function assignmentChip(ctx: RenderContext, assignment: Assignment): string {
  const feed = ctx.session.scheduledFeed;
  const trip = feed?.trips.get(assignment.trip_id);
  const route = trip ? feed?.routes.get(trip.route_id) : undefined;
  const style = route
    ? `background:color-mix(in srgb, ${escHtml(route.color)} 22%, transparent)`
    : '';
  return chipLink(
    ctx,
    { type: 'tracker', tracker_id: assignment.tracker_id },
    assignment.tracker_nickname,
    `${CHIP_CLASS} ${route ? '' : 'bg-base-content/10'}`,
    style,
    `${assignment.tracker_nickname} - ${trip ? tripName(trip) : assignment.trip_id} - ${formatWindow(
      assignment.start_time,
      assignment.end_time
    )}`
  );
}

function renderGrid(ctx: RenderContext, month: ServiceDate): string {
  const feed = ctx.session.scheduledFeed;
  const services = feed
    ? sortByCascade([...serviceCatalog(feed).values()])
    : [];

  return `
    <div class="space-y-1">
      ${renderMonthGrid(month, {
        codec: ISO_DATE_CODEC,
        weekStart: CONFIG.WEEK_START,
        today,
        renderDay: ({ date }) => ({
          chips: [
            ...services
              .filter((service) => serviceRunsOn(service, date))
              .map((service) => serviceChip(service)),
            ...ctx.session
              .assignmentsOn(date)
              .map((assignment) => assignmentChip(ctx, assignment)),
          ].join(''),
        }),
      })}
      <p class="text-xs opacity-50">${t('cal.gridNote')}</p>
    </div>`;
}

// ─── The timeline ─────────────────────────────────────────────────────────────

/**
 * One rule as a chart row: its own date range as the span, its weekdays as the
 * dots, and its exceptions as the ticks over the top.
 *
 * An open-ended rule is drawn to `CONFIG.CALENDAR_OPEN_END_DAYS` past today
 * rather than forever, and says so in its tooltip. Nothing in the chart is
 * infinite; a span has to name a last date.
 */
function ruleRow(
  ctx: RenderContext,
  rule: TrackerRule,
  openEnd: ServiceDate
): TimelineRow {
  const feed = ctx.session.scheduledFeed;
  const trip = feed?.trips.get(rule.trip_id);
  const route = trip ? feed?.routes.get(trip.route_id) : undefined;
  const nickname =
    ctx.session.trackers.get(rule.tracker_id)?.nickname ?? rule.tracker_id;
  const label = `${nickname} - ${trip ? tripName(trip) : rule.trip_id}`;
  const end = rule.end_date ?? openEnd;

  return {
    key: String(rule.id),
    label,
    labelHtml: chipLink(
      ctx,
      { type: 'tracker', tracker_id: rule.tracker_id },
      label,
      'link link-hover truncate'
    ),
    ...(route ? { color: route.color } : { color: 'var(--color-primary)' }),
    spans:
      rule.start_date <= end
        ? [
            {
              from: rule.start_date,
              to: end,
              tooltip: `${label} - ${formatWindow(rule.start_time, rule.end_time)} - ${
                rule.end_date
                  ? t('days.range', {
                      start: rule.start_date,
                      end: rule.end_date,
                    })
                  : t('cal.noEnd', { date: rule.start_date })
              }`,
            },
          ]
        : [],
    weekdays: weekdayFlags(rule),
    ticks: rule.exceptions.map((exception) => ({
      date: exception.date,
      kind: exception.exception_type,
    })),
    title: label,
  };
}

function renderRuleChart(ctx: RenderContext, month: ServiceDate): string {
  const rules = [...(ctx.session.rules?.values() ?? [])];
  if (ctx.session.rules === null) {
    return `<p class="text-xs opacity-60">${t('cal.loadingRules')}</p>`;
  }

  // Far enough past today that an open-ended rule reads as continuing, and at
  // least to the end of the month being shown.
  const monthEnd = addDays(addMonths(startOfMonth(month), 1), -1);
  const openEndDefault = addDays(today(), CONFIG.CALENDAR_OPEN_END_DAYS);
  const openEnd = monthEnd > openEndDefault ? monthEnd : openEndDefault;

  rules.sort((a, b) => a.start_date.localeCompare(b.start_date) || a.id - b.id);

  return renderTimelineChart(
    rules.map((rule) => ruleRow(ctx, rule, openEnd)),
    { emptyMessage: t('cal.noRules') }
  );
}

function unassignedLine(ctx: RenderContext): string {
  const feed = ctx.session.scheduledFeed;
  if (!feed) {
    return '';
  }
  const counts = assignmentCounts(ctx.session, feed.trips.keys());
  if (!counts) {
    return '';
  }
  const unassigned = counts.total - counts.assigned;
  if (unassigned === 0) {
    return '';
  }
  return `<p class="text-xs opacity-50">${t('cal.unassigned', { count: unassigned, total: counts.total })}</p>`;
}

function renderTimeline(ctx: RenderContext, month: ServiceDate): string {
  return `
    <div class="space-y-4">
      ${section(
        t('trip.assignments'),
        `${renderRuleChart(ctx, month)}
         <p class="text-xs opacity-50">${t('cal.timelineNote', {
           added: `<span class="text-success">${t('cal.added')}</span>`,
           removed: `<span class="text-error">${t('cal.removed')}</span>`,
         })}</p>
         ${unassignedLine(ctx)}`
      )}
    </div>`;
}

// ─── The modal ────────────────────────────────────────────────────────────────

/** Whether the session already holds the expansion the grid is drawing. */
function covers(
  session: FeedSession,
  from: ServiceDate,
  to: ServiceDate
): boolean {
  const range = session.assignmentsRange;
  return range !== null && range.from <= from && range.to >= to;
}

const NO_FEED = `<p class="text-sm opacity-60">${t('common.noFeed')}</p>`;

/**
 * Open the calendar.
 *
 * The modal owns its own re-rendering: it redraws on the session events that
 * can change what it says, exactly as the panel does, so an expansion that
 * arrives after it opened fills the grid in place rather than leaving it empty
 * until the reader clicks something.
 */
export async function showCalendarModal(
  hooks: CalendarModalHooks
): Promise<void> {
  const { ctx } = hooks;
  const session = ctx.session;
  let redraw = (): void => {};

  const onSessionChange = (): void => redraw();
  for (const event of ['change', 'assignments', 'scheduleloaded'] as const) {
    session.addEventListener(event, onSessionChange);
  }

  await showSharedCalendarModal({
    title: t('cal.title'),
    codec: ISO_DATE_CODEC,
    weekStart: CONFIG.WEEK_START,
    today,
    initialTab: 'timeline',
    tabs: [
      {
        key: 'grid',
        label: t('cal.grid'),
        render: (month) => (session.feed ? renderGrid(ctx, month) : NO_FEED),
      },
      {
        key: 'timeline',
        label: t('cal.timeline'),
        render: (month) =>
          session.feed ? renderTimeline(ctx, month) : NO_FEED,
      },
    ],
    statusHtml: (from, to) =>
      session.feed && !covers(session, from, to)
        ? `<p class="text-xs opacity-60">${t('cal.loadingMonth')}</p>`
        : '',
    // The month on screen, and the rules behind both tabs.
    onMonth: (from, to) => {
      if (!session.feed) {
        return;
      }
      void hooks.ensureAssignments(from, to);
      void hooks.ensureRules();
    },
    onMount: (handle) => {
      redraw = handle.redraw;

      // A link: the panel's delegation cannot see it from here, so the modal
      // closes itself and hands the page over.
      handle.root.addEventListener('click', (event) => {
        const link = (event.target as HTMLElement | null)?.closest<HTMLElement>(
          '[data-nav]'
        );
        if (
          !link ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.button !== 0
        ) {
          return;
        }
        event.preventDefault();
        const state = JSON.parse(link.dataset.nav!) as PageState;
        handle.close();
        hooks.navigate(state);
      });
    },
  });

  for (const event of ['change', 'assignments', 'scheduleloaded'] as const) {
    session.removeEventListener(event, onSessionChange);
  }
}
