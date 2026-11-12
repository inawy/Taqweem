import { describe, expect, it } from 'vitest';
import { addDays } from '@/core/time';
import type { PlainDate } from '@/core/time';
import { islamicOccasion, upcomingOccasions } from '@/features/view';

/** Every date of 2026 and 2027 that carries an occasion, by name. */
function found(): Map<string, PlainDate[]> {
  const out = new Map<string, PlainDate[]>();
  let day = '2026-01-01' as PlainDate;
  for (let i = 0; i < 730; i += 1) {
    const key = islamicOccasion(day);
    if (key) out.set(key, [...(out.get(key) ?? []), day]);
    day = addDays(day, 1);
  }
  return out;
}

const near = (dates: PlainDate[] | undefined, expected: PlainDate): boolean =>
  (dates ?? []).some((d) => [-1, 0, 1].some((n) => addDays(expected, n) === d));

describe('islamicOccasion', () => {
  it('marks ordinary days with nothing', () => {
    expect(islamicOccasion('2026-10-13')).toBeUndefined();
  });

  it('finds the 1447 occasions within a day of the published dates', () => {
    const all = found();
    expect(near(all.get('occRamadan'), '2026-02-19' as PlainDate)).toBe(true);
    expect(near(all.get('occEidFitr'), '2026-03-20' as PlainDate)).toBe(true);
    expect(near(all.get('occArafah'), '2026-05-26' as PlainDate)).toBe(true);
    expect(near(all.get('occEidAdha'), '2026-05-27' as PlainDate)).toBe(true);
    expect(near(all.get('occHijriNewYear'), '2026-06-16' as PlainDate)).toBe(true);
  });

  it('keeps Arafah the day before Eid al-Adha', () => {
    const all = found();
    const arafah = all.get('occArafah')?.[0] as PlainDate;
    expect(all.get('occEidAdha')).toContain(addDays(arafah, 1));
  });
});

describe('Eid days, Tashreeq and the Hijri correction (D-150)', () => {
  const days = (key: string): PlainDate[] => found().get(key) ?? [];

  it('marks all three days of Eid al-Fitr, and the three days after Eid al-Adha as Tashreeq', () => {
    const fitr = days('occEidFitr');
    expect(fitr.slice(0, 3)).toEqual([0, 1, 2].map((n) => addDays(fitr[0] as PlainDate, n)));
    const adha = days('occEidAdha')[0] as PlainDate;
    expect(days('occTashreeq').slice(0, 3)).toEqual([1, 2, 3].map((n) => addDays(adha, n)));
  });

  it('moves every occasion by the correction: +1 shows Arafah a day earlier', () => {
    const arafah = days('occArafah')[0] as PlainDate;
    expect(islamicOccasion(arafah)).toBe('occArafah');
    expect(islamicOccasion(addDays(arafah, -1), 1)).toBe('occArafah');
    expect(islamicOccasion(arafah, 1)).toBe('occEidAdha');
    expect(islamicOccasion(addDays(arafah, 1), -1)).toBe('occArafah');
  });
});

describe('upcomingOccasions (D-151)', () => {
  it('lists the next occasions in date order, none before the starting day', () => {
    const list = upcomingOccasions('2026-10-13' as PlainDate);
    // A Hijri year has nine of them (new year to Tashreeq); 400 days reach a few more.
    expect(list.length).toBeGreaterThanOrEqual(9);
    expect(list.length).toBeLessThanOrEqual(12);
    expect((list[0]?.start ?? '') >= '2026-10-13').toBe(true);
    const starts = list.map((o) => o.start);
    expect([...starts].sort()).toEqual(starts);
  });

  it('puts the three days of Eid and of Tashreeq together as one range', () => {
    const list = upcomingOccasions('2026-01-01' as PlainDate, 0, 40);
    const fitr = list.find((o) => o.key === 'occEidFitr');
    const tashreeq = list.find((o) => o.key === 'occTashreeq');
    expect(fitr && addDays(fitr.start, 2)).toBe(fitr?.end);
    expect(tashreeq && addDays(tashreeq.start, 2)).toBe(tashreeq?.end);
    expect(fitr).toBeDefined();
    expect(tashreeq).toBeDefined();
  });

  it('stops at the limit, and the correction moves the days', () => {
    expect(upcomingOccasions('2026-01-01' as PlainDate, 0, 3)).toHaveLength(3);
    const a = upcomingOccasions('2026-01-01' as PlainDate, 0, 1)[0];
    const b = upcomingOccasions('2026-01-01' as PlainDate, 1, 1)[0];
    expect(a && b && addDays(b.start, 1)).toBe(a?.start);
  });
});

describe('Ramadan as a whole month (D-152)', () => {
  it('marks every day of it, 29 or 30, and nothing around it', () => {
    const run = found().get('occRamadan') ?? [];
    expect(run.length).toBeGreaterThanOrEqual(29);
    expect(run.length).toBeLessThanOrEqual(60); // two Ramadans in 2026–2027
    const first = run[0] as PlainDate;
    expect(islamicOccasion(addDays(first, -1))).toBeUndefined();
    expect(islamicOccasion(addDays(first, 15))).toBe('occRamadan');
  });

  it('is one range in the upcoming list, with Eid after it', () => {
    const list = upcomingOccasions('2026-01-01' as PlainDate, 0, 40);
    const ramadan = list.find((o) => o.key === 'occRamadan');
    const fitr = list.find((o) => o.key === 'occEidFitr');
    const days = Number(
      (new Date(`${ramadan?.end}T00:00Z`).getTime() - new Date(`${ramadan?.start}T00:00Z`).getTime()) /
        86_400_000,
    );
    expect([28, 29]).toContain(days);
    expect(ramadan && fitr && addDays(ramadan.end, 1)).toBe(fitr?.start);
  });
});
