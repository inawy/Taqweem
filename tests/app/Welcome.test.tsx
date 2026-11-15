import 'fake-indexeddb/auto';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { App } from '@/app/App';
import { createDb, createStore } from '@/data';
import { WELCOME_KEY } from '@/features/welcome';
import { makeNewEvent } from '../helpers/factories';

const NOW = () => Date.UTC(2026, 9, 13, 12, 0);

const memoryStorage = (initial: Record<string, string> = {}) => {
  const m = new Map(Object.entries(initial));
  return {
    raw: m,
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
  };
};

let dbName = '';
beforeEach(() => {
  dbName = `welcome-${Math.random().toString(36).slice(2)}`;
});
afterEach(cleanup);

const open = (storage: ReturnType<typeof memoryStorage>, welcome = true) =>
  render(<App create={() => createDb(dbName)} now={NOW} storage={storage} welcome={welcome} />);

const card = () => screen.queryByRole('region', { name: 'Welcome to Taqweem' });

describe('first-run welcome card (D-158)', () => {
  it('greets an empty calendar once, and "Get started" remembers it', async () => {
    const storage = memoryStorage();
    open(storage);
    expect(await screen.findByRole('region', { name: 'Welcome to Taqweem' })).toBeTruthy();
    expect(screen.getByText(/Your data stays on this device/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Get started' }));
    expect(card()).toBeNull();
    expect(storage.raw.get(WELCOME_KEY)).toBe('1');
  });

  it('does not come back once it was seen', async () => {
    open(memoryStorage({ [WELCOME_KEY]: '1' }));
    await screen.findByRole('heading', { level: 1 });
    expect(card()).toBeNull();
  });

  it('is not shown when the app was not asked to greet (the default)', async () => {
    open(memoryStorage(), false);
    await screen.findByRole('heading', { level: 1 });
    expect(card()).toBeNull();
  });

  it('is not shown to someone who already has events, and is never shown to them later', async () => {
    const db = createDb(dbName);
    const store = createStore(db);
    const calendar = await store.createCalendar({ name: 'Personal', color: 'blue' });
    await store.createEvent(makeNewEvent({ calendarId: calendar.id, title: 'Existing' }));
    db.close();
    const storage = memoryStorage();
    open(storage);
    await waitFor(() => expect(storage.raw.get(WELCOME_KEY)).toBe('1'));
    expect(card()).toBeNull();
  });
});
