import type { CalEvent, Id } from '@/core/model';
import { expandEvents } from '@/core/recurrence';
import { addDays, datePart, nowLocal, toInstantMs } from '@/core/time';
import type { TimeZoneId } from '@/core/time';

// Which reminders a phone should have scheduled right now (D-161, phase 1). Pure: the native shell
// (a later phase) takes this list and hands it to the system. The phone's scheduler has limits, so
// we plan a short window and a bounded count, and plan again whenever the app opens or events change.

export const MAX_REMINDER_MINUTES = 7 * 24 * 60;
export const DEFAULT_WINDOW_DAYS = 14;
export const DEFAULT_REMINDER_LIMIT = 50;

export interface PlannedReminder {
  /** Stable for the same occurrence and offset: the native layer derives its notification id from it. */
  readonly key: string;
  readonly eventId: Id;
  readonly title: string;
  /** When to ring (epoch ms). */
  readonly atMs: number;
  /** When the event starts (epoch ms; for an all-day event, its 09:00). */
  readonly startMs: number;
  readonly minutesBefore: number;
  readonly allDay: boolean;
}

export interface PlanOptions {
  readonly nowMs: number;
  /** The person's own zone: the window is theirs and all-day events count from 09:00 in it. */
  readonly localZone: TimeZoneId;
  /** Minutes before the start, or `undefined` for an event with no reminder. */
  readonly minutesBefore: (event: CalEvent) => number | undefined;
  readonly windowDays?: number;
  readonly limit?: number;
}

const validOffset = (m: number | undefined): m is number =>
  m !== undefined && Number.isInteger(m) && m >= 0 && m <= MAX_REMINDER_MINUTES;

/** The reminders due inside the next `windowDays`, soonest first, at most `limit` of them. */
export function planReminders(
  events: readonly CalEvent[],
  options: PlanOptions,
): PlannedReminder[] {
  const { nowMs, localZone } = options;
  const windowDays = options.windowDays ?? DEFAULT_WINDOW_DAYS;
  const limit = options.limit ?? DEFAULT_REMINDER_LIMIT;
  if (limit <= 0 || windowDays <= 0) return [];

  const windowEndMs = nowMs + windowDays * 86_400_000;
  const today = datePart(nowLocal(localZone, nowMs));
  // A reminder rings before the start, so an event up to a week past the window can still ring in it.
  const to = addDays(today, windowDays + 9);

  const out: PlannedReminder[] = [];
  for (const o of expandEvents(events, today, to).occurrences) {
    const minutes = options.minutesBefore(o.event);
    if (!validOffset(minutes)) continue;
    const allDay = o.event.allDay;
    const startMs = allDay
      ? // No clock time: counts from 09:00 on that day, as in the ICS file (D-159).
        toInstantMs(`${o.start.slice(0, 10)}T09:00`, localZone)
      : toInstantMs(o.start, o.event.tzid ?? localZone);
    const atMs = startMs - minutes * 60_000;
    if (atMs <= nowMs || atMs > windowEndMs) continue;
    out.push({
      key: `${o.key}@${minutes}`,
      eventId: o.event.id,
      title: o.event.title.trim(),
      atMs,
      startMs,
      minutesBefore: minutes,
      allDay,
    });
  }
  out.sort((a, b) => a.atMs - b.atMs || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  return out.slice(0, limit);
}

/**
 * The reminder an occurrence rings with: its own, and for a changed occurrence of a series with
 * none of its own, the series'. (One occurrence cannot be made silent while the series rings.)
 */
export function reminderOf(events: readonly CalEvent[]): (event: CalEvent) => number | undefined {
  const byId = new Map(events.map((e) => [e.id, e]));
  return (event) =>
    event.reminderMinutes ??
    (event.seriesId === undefined ? undefined : byId.get(event.seriesId)?.reminderMinutes);
}
