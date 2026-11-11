import 'fake-indexeddb/auto';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { App } from '@/app/App';
import { createDb, createStore } from '@/data';
import { makeNewEvent } from '../helpers/factories';

// Measures what the views cost with a busy calendar (D-138). jsdom has no layout or paint, so the
// numbers are the JavaScript side only (building models and React's render): good for comparing a
// change with the one before it, not for promising a speed on a phone.
const NOW = () => Date.UTC(2026, 9, 13, 12, 0);

const memoryStorage = () => {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
  };
};

afterEach(cleanup);

const time = (label: string, fn: () => void): number => {
  const t0 = performance.now();
  fn();
  const ms = performance.now() - t0;
  console.log(`RENDERPERF ${label}: ${ms.toFixed(0)} ms`);
  return ms;
};

async function seeded(name: string, count: number) {
  const db = createDb(name);
  const store = createStore(db);
  const calendar = await store.createCalendar({ name: 'Personal', color: 'blue' });
  for (let i = 0; i < count; i += 1) {
    const day = String((i % 28) + 1).padStart(2, '0');
    const hour = String(8 + (i % 10)).padStart(2, '0');
    const nextHour = String(9 + (i % 10)).padStart(2, '0');
    const repeats = i % 8 === 0;
    await store.createEvent(
      makeNewEvent({
        calendarId: calendar.id,
        title: `Event ${i}`,
        start: `2026-10-${day}T${hour}:00`,
        end: `2026-10-${day}T${nextHour}:00`,
        ...(repeats && { rrule: 'FREQ=WEEKLY;COUNT=40' }),
      }),
    );
  }
  db.close();
}

describe('render cost with a busy calendar (D-138)', () => {
  it('opens, moves through months, and changes view', async () => {
    const name = `perf-${Math.random().toString(36).slice(2)}`;
    await seeded(name, 400);
    const opened = performance.now();
    render(<App create={() => createDb(name)} now={NOW} storage={memoryStorage()} />);
    await screen.findByRole('heading', { level: 1, name: 'October 2026' });
    await screen.findAllByText(/Event \d+/, undefined, { timeout: 20_000 });
    console.log(`RENDERPERF open (400 events): ${(performance.now() - opened).toFixed(0)} ms`);

    const next = () => screen.getByRole('button', { name: /^Next/ });
    const monthMs = time('6 × next month', () => {
      for (let i = 0; i < 6; i += 1) fireEvent.click(next());
    });
    const press = (code: string) => fireEvent.keyDown(window, { code });
    const weekMs = time('month → week', () => press('KeyW'));
    const dayMs = time('week → day', () => press('KeyD'));
    const yearMs = time('day → year', () => press('KeyY'));
    const backMs = time('year → month', () => press('KeyM'));

    // Generous: this only catches a view that has become pathologically slow.
    for (const ms of [monthMs, weekMs, dayMs, yearMs, backMs]) expect(ms).toBeLessThan(15_000);
  }, 120_000);
});
