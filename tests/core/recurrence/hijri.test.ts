// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { expandRule, formatRule, parseRule } from '@/core/recurrence';
import type { Rule } from '@/core/recurrence';
import { addDays, hijriMonthDay } from '@/core/time';
import type { PlainDate } from '@/core/time';

const rule = (text: string): Rule => {
  const r = parseRule(text);
  if (!r.ok) throw new Error(r.error);
  return r.rule;
};

/** The first 1 Ramadan on or after 2026-02-15 (about 1447), found without the code under test. */
function firstRamadan(): PlainDate {
  let d = '2026-02-15' as PlainDate;
  for (let i = 0; i < 20; i += 1) {
    const h = hijriMonthDay(d);
    if (h?.month === 9 && h.day === 1) return d;
    d = addDays(d, 1);
  }
  throw new Error('no 1 Ramadan found');
}

describe('X-HIJRI rules', () => {
  it('parses and formats back to the same text', () => {
    const r = rule('FREQ=YEARLY;X-HIJRI=9-1');
    expect(r.hijri).toEqual({ month: 9, day: 1 });
    expect(formatRule(r)).toBe('FREQ=YEARLY;X-HIJRI=9-1');
    expect(formatRule(rule('FREQ=YEARLY;X-HIJRI=12-10;COUNT=3'))).toBe(
      'FREQ=YEARLY;X-HIJRI=12-10;COUNT=3',
    );
  });

  it('refuses what it cannot honestly expand', () => {
    for (const bad of [
      'FREQ=YEARLY;X-HIJRI=13-1',
      'FREQ=YEARLY;X-HIJRI=9-31',
      'FREQ=YEARLY;X-HIJRI=nine',
      'FREQ=MONTHLY;X-HIJRI=9-1',
      'FREQ=YEARLY;INTERVAL=2;X-HIJRI=9-1',
      'FREQ=YEARLY;BYMONTH=3;X-HIJRI=9-1',
    ]) {
      expect(parseRule(bad).ok).toBe(false);
    }
  });
});

describe('expanding a Hijri yearly rule', () => {
  const start = firstRamadan();

  it('lands on 1 Ramadan every Hijri year, 354 or 355 days apart', () => {
    const days = expandRule(rule('FREQ=YEARLY;X-HIJRI=9-1'), start, '2026-01-01', '2036-01-01');
    expect(days.length).toBeGreaterThanOrEqual(10); // a Hijri year is shorter than a Gregorian one
    expect(days[0]).toBe(start);
    for (const d of days) expect(hijriMonthDay(d as PlainDate)).toEqual({ month: 9, day: 1 });
    // Every year the date moves about 11 days earlier in the Gregorian calendar.
    const ms = (d: string): number => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10));
    for (let i = 1; i < days.length; i += 1) {
      const gap = (ms(days[i] as string) - ms(days[i - 1] as string)) / 86_400_000;
      expect([354, 355]).toContain(gap);
    }
  });

  it('keeps the time of day, and never goes before the start', () => {
    const timed = expandRule(
      rule('FREQ=YEARLY;X-HIJRI=9-1'),
      `${start}T20:30`,
      '2020-01-01T00:00',
      '2030-01-01T00:00',
    );
    expect(timed[0]).toBe(`${start}T20:30`);
    expect(timed.every((o) => o.endsWith('T20:30'))).toBe(true);
  });

  it('honours COUNT and UNTIL', () => {
    expect(
      expandRule(rule('FREQ=YEARLY;X-HIJRI=9-1;COUNT=3'), start, '2026-01-01', '2100-01-01'),
    ).toHaveLength(3);
    const until = expandRule(
      rule('FREQ=YEARLY;X-HIJRI=9-1;UNTIL=20290101'),
      start,
      '2026-01-01',
      '2100-01-01',
    );
    expect(until.every((d) => d <= '2029-01-01')).toBe(true);
    expect(until.length).toBeGreaterThanOrEqual(2);
  });

  it('reaches a far window without walking every day of the years before it', () => {
    const far = expandRule(rule('FREQ=YEARLY;X-HIJRI=9-1'), start, '2090-01-01', '2092-12-31');
    expect(far.length).toBeGreaterThanOrEqual(2);
    for (const d of far) expect(hijriMonthDay(d as PlainDate)?.month).toBe(9);
  });

  it('skips a year where the month has no day 30', () => {
    const days = expandRule(
      rule('FREQ=YEARLY;X-HIJRI=1-30'),
      '2026-01-01',
      '2026-01-01',
      '2070-01-01',
    );
    for (const d of days) expect(hijriMonthDay(d as PlainDate)).toEqual({ month: 1, day: 30 });
  });
});
