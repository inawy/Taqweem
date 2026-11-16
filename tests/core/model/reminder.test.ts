import { describe, expect, it } from 'vitest';
import { parseEvent, tombstoneEvent } from '@/core/model';
import { makeEvent } from '../../helpers/factories';

describe('an event’s reminder (D-161)', () => {
  const base = () => ({ ...makeEvent({ id: 'r' }) }) as Record<string, unknown>;

  it('is optional: events without it still read, and with it keep it', () => {
    expect(parseEvent(base()).ok).toBe(true);
    const r = parseEvent({ ...base(), reminderMinutes: 10 });
    expect(r.ok && r.value.reminderMinutes).toBe(10);
    const zero = parseEvent({ ...base(), reminderMinutes: 0 });
    expect(zero.ok && zero.value.reminderMinutes).toBe(0);
  });

  it('refuses anything but whole minutes from 0 to a week', () => {
    for (const bad of [-1, 1.5, '10', null, 7 * 24 * 60 + 1, Number.NaN]) {
      expect(parseEvent({ ...base(), reminderMinutes: bad }).ok).toBe(false);
    }
    expect(parseEvent({ ...base(), reminderMinutes: 7 * 24 * 60 }).ok).toBe(true);
  });

  it('is dropped by a deleted event, and a deleted event may not keep one', () => {
    const t = tombstoneEvent(makeEvent({ id: 'r', reminderMinutes: 10 }), 5_000);
    expect(t.reminderMinutes).toBeUndefined();
    expect(parseEvent(t).ok).toBe(true);
    expect(parseEvent({ ...t, reminderMinutes: 10 }).ok).toBe(false);
  });
});
