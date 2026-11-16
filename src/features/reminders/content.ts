import { datePart, formatDate, formatTime, fromInstantMs } from '@/core/time';
import type { TimeFormatOptions, TimeZoneId } from '@/core/time';
import type { PlannedReminder } from './plan';

// What the phone shows and under which number it files a reminder (D-161).

/** A reminder as the native scheduler takes it. */
export interface ScheduledReminder {
  readonly id: number;
  readonly atMs: number;
  readonly title: string;
  readonly body: string;
}

export interface ReminderLabels {
  readonly untitled: string;
  readonly allDay: string;
}

/** FNV-1a, folded to a positive 31-bit number: Android notification ids are 32-bit integers. */
function hash31(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h & 0x7fffffff || 1;
}

/**
 * Turns the plan into what the phone is given: the same reminder always gets the same number, and
 * two different reminders never share one (a clash moves on to the next free number).
 */
export function toScheduled(
  planned: readonly PlannedReminder[],
  zone: TimeZoneId,
  fmt: TimeFormatOptions,
  labels: ReminderLabels,
): ScheduledReminder[] {
  const used = new Set<number>();
  return planned.map((r) => {
    let id = hash31(r.key);
    while (used.has(id)) id = id >= 0x7fffffff ? 1 : id + 1;
    used.add(id);
    const local = fromInstantMs(r.startMs, zone);
    const when = r.allDay ? labels.allDay : formatTime(local, fmt);
    return {
      id,
      atMs: r.atMs,
      title: r.title === '' ? labels.untitled : r.title,
      body: `${formatDate(datePart(local), fmt, 'medium')} · ${when}`,
    };
  });
}
