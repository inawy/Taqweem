import { describe, expect, it } from 'vitest';
import { addDays } from '@/core/time';
import type { PlainDate } from '@/core/time';
import { islamicOccasion } from '@/features/view';

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
