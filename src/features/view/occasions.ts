import { hijriMonthDay } from '@/core/time';
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
  | 'occEidAdha';

const BY_MONTH_DAY: Readonly<Record<string, OccasionKey>> = {
  '1-1': 'occHijriNewYear',
  '1-10': 'occAshura',
  '3-12': 'occMawlid',
  '7-27': 'occIsra',
  '9-1': 'occRamadan',
  '10-1': 'occEidFitr',
  '12-9': 'occArafah',
  '12-10': 'occEidAdha',
};

/**
 * The Islamic occasion a day falls on, from its Umm al-Qura date; `undefined` for an ordinary day.
 * Computed, never stored: it may differ by a day from the local moon-sighting announcement.
 */
export function islamicOccasion(date: PlainDate): OccasionKey | undefined {
  const hijri = hijriMonthDay(date);
  return hijri ? BY_MONTH_DAY[`${hijri.month}-${hijri.day}`] : undefined;
}
