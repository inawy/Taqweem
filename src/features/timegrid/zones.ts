import { fromInstantMs, toInstantMs } from '@/core/time';
import type { PlainDate, PlainDateTime, TimeZoneId } from '@/core/time';

/** Zones offered for the second clock in the day and week views (D-122): a short, honest list. */
export const SECOND_ZONES: readonly TimeZoneId[] = [
  'Asia/Riyadh',
  'Africa/Cairo',
  'Asia/Dubai',
  'Europe/Istanbul',
  'Europe/London',
  'Europe/Paris',
  'America/New_York',
  'America/Los_Angeles',
  'Asia/Karachi',
  'Asia/Kolkata',
  'Asia/Kuala_Lumpur',
  'Asia/Tokyo',
  'Australia/Sydney',
  'UTC',
];

/**
 * What the wall clock reads in `zone` at `hour:00` of `date` in `home`: the second column of hour
 * labels. The date part says when it falls on another day.
 */
export function clockInZone(
  date: PlainDate,
  hour: number,
  home: TimeZoneId,
  zone: TimeZoneId,
): PlainDateTime {
  const h = String(hour).padStart(2, '0');
  return fromInstantMs(toInstantMs(`${date}T${h}:00`, home), zone);
}

/** A short name for a zone to put above its column: "Africa/Cairo" → "Cairo". */
export function zoneName(zone: TimeZoneId): string {
  const last = zone.split('/').pop() ?? zone;
  return last.replace(/_/g, ' ');
}
