import { describe, expect, it } from 'vitest';
import { isTimeZone } from '@/core/time';
import { SECOND_ZONES, clockInZone, zoneName } from '@/features/timegrid';

describe('second clock zones (D-122)', () => {
  it('reads the hour in another zone, across a day boundary', () => {
    // Riyadh is UTC+3 all year; Cairo is UTC+2 in January (no summer time there then).
    expect(clockInZone('2026-01-15', 9, 'Asia/Riyadh', 'Africa/Cairo')).toBe('2026-01-15T08:00');
    expect(clockInZone('2026-01-15', 1, 'Asia/Riyadh', 'UTC')).toBe('2026-01-14T22:00');
    expect(clockInZone('2026-01-15', 23, 'Asia/Riyadh', 'Asia/Tokyo')).toBe('2026-01-16T05:00');
  });

  it('follows summer time of the day it shows', () => {
    // London is UTC+1 in July and UTC+0 in January.
    expect(clockInZone('2026-07-15', 12, 'Asia/Riyadh', 'Europe/London')).toBe('2026-07-15T10:00');
    expect(clockInZone('2026-01-15', 12, 'Asia/Riyadh', 'Europe/London')).toBe('2026-01-15T09:00');
  });

  it('knows which names are real zones, and every offered zone is', () => {
    expect(isTimeZone('Asia/Riyadh')).toBe(true);
    expect(isTimeZone('Nowhere/City')).toBe(false);
    expect(isTimeZone('')).toBe(false);
    for (const zone of SECOND_ZONES) expect(isTimeZone(zone)).toBe(true);
  });

  it('names a zone by its city', () => {
    expect(zoneName('America/New_York')).toBe('New York');
    expect(zoneName('UTC')).toBe('UTC');
  });
});
