import { describe, expect, it } from 'vitest';
import { prepareData } from '@/features/common/prepare';
import { makeCalendar, makeEvent } from '../helpers/factories';

const calendar = makeCalendar({ id: 'cal-1' });
const events = Array.from({ length: 5000 }, (_, i) =>
  makeEvent({ id: `e${i}`, start: '2026-10-13T09:00', end: '2026-10-13T09:45' }),
);

describe('prepareData remembers its result (D-090)', () => {
  it('returns the same object for the same arrays, and re-validates a new array', () => {
    const calendars = [calendar];
    const first = prepareData(calendars, events);
    expect(prepareData(calendars, events)).toBe(first);
    const extra = makeEvent({ id: 'extra', start: '2026-10-14T09:00', end: '2026-10-14T09:45' });
    const changed = [...events, extra];
    const next = prepareData(calendars, changed);
    expect(next).not.toBe(first);
    expect(next.events).toHaveLength(5001);
    expect(first.events).toHaveLength(5000);
  });

  it('a repeat call over 5000 events is far cheaper than the first', () => {
    const calendars = [calendar];
    const events2 = [...events];
    const t0 = performance.now();
    prepareData(calendars, events2);
    const first = performance.now() - t0;
    const t1 = performance.now();
    prepareData(calendars, events2);
    const again = performance.now() - t1;
    console.log(`PREPARE5000 first=${first.toFixed(2)}ms again=${again.toFixed(3)}ms`);
    expect(again).toBeLessThan(Math.max(first / 10, 1));
  });
});
