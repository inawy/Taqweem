import { describe, expect, it } from 'vitest';
import { inLocalClock } from '@/features/events';

describe('inLocalClock (D-149)', () => {
  it('moves a time kept in another zone to the person’s clock', () => {
    expect(inLocalClock('2026-10-13T10:00', 'Europe/London', 'Asia/Riyadh')).toBe(
      '2026-10-13T12:00',
    );
  });

  it('leaves the time alone for the same zone, no zone, or a zone the platform does not know', () => {
    expect(inLocalClock('2026-10-13T10:00', 'Asia/Riyadh', 'Asia/Riyadh')).toBe('2026-10-13T10:00');
    expect(inLocalClock('2026-10-13T10:00', undefined, 'Asia/Riyadh')).toBe('2026-10-13T10:00');
    expect(inLocalClock('2026-10-13T10:00', 'Mars/Olympus', 'Asia/Riyadh')).toBe(
      '2026-10-13T10:00',
    );
  });
});
