import 'fake-indexeddb/auto';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Spies that record how many events each view's builder was given (D-089).
const seen = vi.hoisted(() => ({
  month: [] as number[],
  grid: [] as number[],
  agenda: [] as number[],
}));

vi.mock('@/features/month', async (orig) => {
  const m = await orig<typeof import('@/features/month')>();
  return {
    ...m,
    buildMonthModel: (i: Parameters<typeof m.buildMonthModel>[0]) => {
      seen.month.push(i.events.length);
      return m.buildMonthModel(i);
    },
  };
});
vi.mock('@/features/timegrid', async (orig) => {
  const m = await orig<typeof import('@/features/timegrid')>();
  return {
    ...m,
    buildTimeGridModel: (i: Parameters<typeof m.buildTimeGridModel>[0]) => {
      seen.grid.push(i.events.length);
      return m.buildTimeGridModel(i);
    },
  };
});
vi.mock('@/features/agenda', async (orig) => {
  const m = await orig<typeof import('@/features/agenda')>();
  return {
    ...m,
    buildAgendaModel: (i: Parameters<typeof m.buildAgendaModel>[0]) => {
      seen.agenda.push(i.events.length);
      return m.buildAgendaModel(i);
    },
  };
});

import { App } from '@/app/App';
import { createDb, createStore } from '@/data';
import { makeNewEvent } from '../helpers/factories';

const NOW = () => Date.UTC(2026, 9, 13, 12, 0);
const memoryStorage = () => {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
  };
};

let dbName = '';
beforeEach(() => {
  dbName = `lazy-${Math.random().toString(36).slice(2)}`;
  seen.month = [];
  seen.grid = [];
  seen.agenda = [];
});
afterEach(cleanup);

describe('only the view on screen reads the events (D-089)', () => {
  it('month builds the month model; the week and agenda models get no events', async () => {
    const db = createDb(dbName);
    const store = createStore(db);
    const calendar = await store.createCalendar({ name: 'Personal', color: 'blue' });
    await store.createEvent(makeNewEvent({ calendarId: calendar.id, title: 'Team sync' }));
    db.close();
    render(<App create={() => createDb(dbName)} now={NOW} storage={memoryStorage()} />);
    await screen.findByRole('heading', { level: 1, name: 'October 2026' });
    await screen.findByText('Team sync');
    expect(Math.max(...seen.month)).toBe(1);
    expect(Math.max(...seen.grid)).toBe(0);
    expect(Math.max(...seen.agenda)).toBe(0);

    fireEvent.keyDown(window, { code: 'KeyW' });
    await screen.findByRole('button', { name: 'Week', pressed: true });
    expect(Math.max(...seen.grid)).toBe(1);
    expect(seen.month.at(-1)).toBe(0);
  });
});
