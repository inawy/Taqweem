import type { CalEvent, Calendar } from '@/core/model';
import { parseCalendar, parseEvent } from '@/core/model';

export interface PreparedData {
  readonly calendars: Map<string, Calendar>;
  /** Valid events of visible calendars, ready to expand. */
  readonly events: CalEvent[];
  /** Stored records that failed validation (or point at no calendar) and were left out. */
  readonly skipped: number;
}

/**
 * Stored records are UNTRUSTED at render time: every one passes the same validation gate used
 * on import. A damaged record is skipped and counted, never allowed to throw into a view.
 * Events of hidden calendars are left out without counting as damage.
 */
function prepareUncached(
  rawCalendars: readonly unknown[],
  rawEvents: readonly unknown[],
): PreparedData {
  let skipped = 0;
  const calendars = new Map<string, Calendar>();
  for (const raw of rawCalendars) {
    const parsed = parseCalendar(raw);
    if (parsed.ok) calendars.set(parsed.value.id, parsed.value);
    else skipped += 1;
  }

  const events: CalEvent[] = [];
  for (const raw of rawEvents) {
    const parsed = parseEvent(raw);
    const calendar = parsed.ok ? calendars.get(parsed.value.calendarId) : undefined;
    if (!parsed.ok || !calendar) {
      skipped += 1;
      continue;
    }
    if (calendar.visible) events.push(parsed.value);
  }
  return { calendars, events, skipped };
}

/** The colour token or `#rrggbb` an occurrence is drawn with: its own, else its calendar's. */
export function colorOf(event: CalEvent, calendars: ReadonlyMap<string, Calendar>): string {
  return event.color ?? calendars.get(event.calendarId)?.color ?? 'gray';
}

// Validating thousands of records is the same work on every month/week/day move while the data
// has not changed, so the result is remembered per (calendars, events) pair of arrays (D-090).
// The arrays come from state and are replaced, never edited in place, when data changes.
const cache = new WeakMap<readonly unknown[], WeakMap<readonly unknown[], PreparedData>>();

export function prepareData(
  rawCalendars: readonly unknown[],
  rawEvents: readonly unknown[],
): PreparedData {
  const byEvents = cache.get(rawCalendars) ?? new WeakMap<readonly unknown[], PreparedData>();
  cache.set(rawCalendars, byEvents);
  const hit = byEvents.get(rawEvents);
  if (hit) return hit;
  const fresh = prepareUncached(rawCalendars, rawEvents);
  byEvents.set(rawEvents, fresh);
  return fresh;
}
