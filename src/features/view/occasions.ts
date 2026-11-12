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
