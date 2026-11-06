// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { expandRule, parseRule } from '@/core/recurrence';

// Measures what a view costs when many events repeat on a Hijri date (D-113).
describe('Hijri repeat cost', () => {
  const parsed = parseRule('FREQ=YEARLY;X-HIJRI=9-1');
  if (!parsed.ok) throw new Error(parsed.error);
  const rule = parsed.rule;
  const time = (label: string, fn: () => void): number => {
    const t0 = performance.now();
    fn();
    const ms = performance.now() - t0;
    console.log(`HIJRIPERF ${label}: ${ms.toFixed(1)} ms`);
    return ms;
  };

  it('one event, one month window, started this year', () => {
    time('1 event / month', () => expandRule(rule, '2026-02-18', '2026-11-01', '2026-12-13'));
  });

  it('one event, a year window, started 40 years ago', () => {
    time('1 event / year window / 40y', () =>
      expandRule(rule, '1986-01-01', '2026-01-01', '2027-01-01'),
    );
  });

  it('200 events (distinct starts), a month window', () => {
    const ms = time('200 events / month', () => {
      for (let i = 0; i < 200; i += 1) {
        const day = String((i % 28) + 1).padStart(2, '0');
        expandRule(rule, `2020-03-${day}`, '2026-11-01', '2026-12-13');
      }
    });
    expect(ms).toBeLessThan(20_000);
  });

  it('200 events, a year window', () => {
    const ms = time('200 events / year', () => {
      for (let i = 0; i < 200; i += 1) {
        const day = String((i % 28) + 1).padStart(2, '0');
        expandRule(rule, `2020-03-${day}`, '2026-01-01', '2027-01-01');
      }
    });
    expect(ms).toBeLessThan(40_000);
  });
});
