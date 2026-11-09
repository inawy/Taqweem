import { addDays, addMinutes, isValidDate, parseInstantMs } from '@/core/time';
import type { TimeZoneId } from '@/core/time';
import { APP_ID } from './envelope';
import { parseEvent } from './validate';

// The «تقويم» (Taqweem) app keeps one day per event, a time as `HH:MM` text and four fixed
// categories, and writes `app: "nawy-today"` with `schemaVersion: 1` and NO `calendars`. This turns
// such a file into our envelope shape (D-125). The result still goes through parseEnvelopeValue,
// so nothing reaches the database that the normal gate would refuse.

type Rec = Record<string, unknown>;

const CATEGORIES = {
  personal: { name: 'شخصي', color: 'blue', hex: '#3D7BFF' },
  work: { name: 'عمل', color: 'purple', hex: '#A56ADB' },
  family: { name: 'عائلة', color: 'amber', hex: '#E79A5A' },
  health: { name: 'صحة', color: 'green', hex: '#4B9B7A' },
} as const;
type Category = keyof typeof CATEGORIES;

const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v);

/** True for a file written by «تقويم»: our app id, a list of events with a `date`, no calendars. */
export function isTaqweemBackup(raw: unknown): boolean {
  if (!isRec(raw) || raw['app'] !== APP_ID || raw['calendars'] !== undefined) return false;
  const events = raw['events'];
  return Array.isArray(events) && events.some((e) => isRec(e) && typeof e['date'] === 'string');
}

const calendarId = (c: Category): string => `taqweem-${c}`;
const isCategory = (v: unknown): v is Category =>
  typeof v === 'string' && Object.hasOwn(CATEGORIES, v);

/**
 * `timeZone` is the person's zone: «تقويم» stores bare wall-clock times, which we read as local.
 * Events that cannot be converted are left out (the count is returned).
 */
export function convertTaqweemBackup(
  raw: unknown,
  timeZone: TimeZoneId,
  fallbackNow: number,
): { envelope: Rec; skipped: number } {
  const source = isRec(raw) ? raw : {};
  const exportedText = source['exportedAt'];
  const exportedAt =
    (typeof exportedText === 'string' ? parseInstantMs(exportedText) : undefined) ?? fallbackNow;
  const list = Array.isArray(source['events']) ? source['events'] : [];

  const events: Rec[] = [];
  const used = new Set<Category>();
  let skipped = 0;

  for (const item of list) {
    const converted = isRec(item) ? convertEvent(item, timeZone) : undefined;
    if (!converted || !parseEvent(converted.event).ok) {
      skipped += 1;
      continue;
    }
    used.add(converted.category);
    events.push(converted.event);
  }

  const calendars = (Object.keys(CATEGORIES) as Category[])
    .filter((c) => used.has(c))
    .map((c) => ({
      id: calendarId(c),
      name: CATEGORIES[c].name,
      color: CATEGORIES[c].color,
      visible: true,
      createdAt: exportedAt,
      updatedAt: exportedAt,
    }));

  return {
    envelope: { app: APP_ID, schemaVersion: 1, exportedAt, calendars, events },
    skipped,
  };
}

function convertEvent(
  e: Rec,
  timeZone: TimeZoneId,
): { event: Rec; category: Category } | undefined {
  const { id, title, date, startTime, endTime, description, color, createdAt, updatedAt } = e;
  const category = e['category'];
  if (typeof id !== 'string' || typeof title !== 'string' || typeof date !== 'string') {
    return undefined;
  }
  if (!isCategory(category) || !isValidDate(date)) return undefined;

  // Taqweem allows "no time" without ticking all-day: that is an all-day event here.
  const timed = e['allDay'] !== true && typeof startTime === 'string' && startTime !== '';
  let start: string = date;
  let end: string = addDays(date, 1);
  let tzid: string | undefined;
  if (timed) {
    start = `${date}T${startTime}`;
    end =
      typeof endTime === 'string' && endTime !== ''
        ? `${date}T${endTime}`
        : addMinutes(`${date}T${startTime}`, 60, timeZone);
    tzid = timeZone;
  }

  const note =
    typeof description === 'string' && description.trim() !== '' ? description : undefined;
  // Only a colour the person chose themselves is kept; the category's own is its calendar's.
  const own =
    typeof color === 'string' && color.toUpperCase() !== CATEGORIES[category].hex
      ? color
      : undefined;

  return {
    category,
    event: {
      id,
      calendarId: calendarId(category),
      title,
      ...(note === undefined ? {} : { notes: note }),
      allDay: !timed,
      start,
      end,
      ...(tzid === undefined ? {} : { tzid }),
      ...(own === undefined ? {} : { color: own }),
      createdAt,
      updatedAt,
    },
  };
}
