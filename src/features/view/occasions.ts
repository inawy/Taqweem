import { addDays, hijriMonthDay } from '@/core/time';
import type { PlainDate } from '@/core/time';

/** The Islamic occasions we mark, by the message that names them (D-107). */
export type OccasionKey =
  | 'occHijriNewYear'
  | 'occAshura'
  | 'occMawlid'
  | 'occIsra'
  | 'occRamadan'
  | 'occEidFitr'
  | 'occArafah'
  | 'occEidAdha'
  | 'occTashreeq';

const BY_MONTH_DAY: Readonly<Record<string, OccasionKey>> = {
  '1-1': 'occHijriNewYear',
  '1-10': 'occAshura',
  '3-12': 'occMawlid',
  '7-27': 'occIsra',
  '9-1': 'occRamadan',
  '10-1': 'occEidFitr',
  '10-2': 'occEidFitr',
  '10-3': 'occEidFitr',
  '12-9': 'occArafah',
  '12-10': 'occEidAdha',
  '12-11': 'occTashreeq',
  '12-12': 'occTashreeq',
  '12-13': 'occTashreeq',
};

/**
 * The Islamic occasion a day falls on, from its Umm al-Qura date; `undefined` for an ordinary day.
 * Computed, never stored: it may differ by a day from the local moon-sighting announcement, which
 * `adjust` (days, D-150) moves the Hijri date to follow. The Eid days are all three marked as the
 * Eid, and the three days after Eid al-Adha as the days of Tashreeq (D-150).
 */
export function islamicOccasion(date: PlainDate, adjust = 0): OccasionKey | undefined {
  const hijri = hijriMonthDay(adjust === 0 ? date : addDays(date, adjust));
  return hijri ? BY_MONTH_DAY[`${hijri.month}-${hijri.day}`] : undefined;
}

export interface UpcomingOccasion {
  readonly key: OccasionKey;
  /** First and last day of it (the same for a one-day occasion). */
  readonly start: PlainDate;
  readonly end: PlainDate;
}

/** How far ahead to look: a Hijri year is about 354 days, so every occasion shows up once. */
const LOOK_AHEAD_DAYS = 400;

/**
 * The Islamic occasions from `from` on, in order, with the days of one (the three days of Eid) put
 * together as a range (D-151). `adjust` is the Hijri correction (D-150); `limit` caps the list.
 */
export function upcomingOccasions(from: PlainDate, adjust = 0, limit = 12): UpcomingOccasion[] {
  const out: UpcomingOccasion[] = [];
  for (let i = 0; i < LOOK_AHEAD_DAYS && out.length < limit; i += 1) {
    const day = addDays(from, i);
    const key = islamicOccasion(day, adjust);
    if (!key) continue;
    const last = out[out.length - 1];
    if (last && last.key === key && addDays(last.end, 1) === day) {
      out[out.length - 1] = { ...last, end: day };
    } else {
      out.push({ key, start: day, end: day });
    }
  }
  return out;
}
