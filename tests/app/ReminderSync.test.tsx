import 'fake-indexeddb/auto';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { App } from '@/app/App';
import type { ReminderScheduler } from '@/app/native/scheduler';
import type { NotificationPermission } from '@/app/native/scheduler';
import { createDb, createStore } from '@/data';
import { toInstantMs } from '@/core/time';

const ZONE = 'UTC';
const NOW = () => toInstantMs('2026-10-13T12:00', ZONE);

const memoryStorage = () => {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
  };
};

interface Call {
  readonly asked: boolean[];
  readonly replaced: { id: number; atMs: number; title: string }[][];
}

function fakeScheduler(state: NotificationPermission): [ReminderScheduler, Call] {
  const calls: Call = { asked: [], replaced: [] };
  return [
    {
      permission: (ask) => {
        calls.asked.push(ask);
        return Promise.resolve(state);
      },
      replaceAll: (items) => {
        calls.replaced.push(items.map((i) => ({ id: i.id, atMs: i.atMs, title: i.title })));
        return Promise.resolve();
      },
      status: () => Promise.resolve({ permission: state, exactAlarm: 'granted', pending: 0 }),
      sendTest: () => Promise.resolve(),
      openExactAlarmSettings: () => Promise.resolve(),
    },
    calls,
  ];
}

let dbName = '';
beforeEach(() => {
  dbName = `sync-${Math.random().toString(36).slice(2)}`;
});
afterEach(cleanup);

async function seed(reminderMinutes?: number) {
  const db = createDb(dbName);
  const store = createStore(db);
  const cal = await store.createCalendar({ name: 'Personal', color: 'blue' });
  await store.createEvent({
    calendarId: cal.id,
    title: 'Dentist',
    allDay: false,
    start: '2026-10-14T09:00',
    end: '2026-10-14T10:00',
    tzid: 'UTC',
    ...(reminderMinutes !== undefined && { reminderMinutes }),
  });
  db.close();
}

const open = (reminders: boolean, scheduler: ReminderScheduler) =>
  render(
    <App
      create={() => createDb(dbName)}
      now={NOW}
      storage={memoryStorage()}
      reminders={reminders}
      reminderScheduler={scheduler}
    />,
  );

describe('keeping the phone’s reminders in step (D-161)', () => {
  it('schedules the coming reminder, once permission is granted', async () => {
    await seed(10);
    const [scheduler, calls] = fakeScheduler('granted');
    open(true, scheduler);
    await waitFor(() => expect(calls.replaced.length).toBeGreaterThan(0));
    const last = calls.replaced.at(-1) ?? [];
    expect(last).toHaveLength(1);
    expect(last[0]?.title).toBe('Dentist');
    expect(last[0]?.atMs).toBe(toInstantMs('2026-10-14T08:50', ZONE));
    expect(calls.asked).toContain(true);
  });

  it('asks for nothing while no event has a reminder', async () => {
    await seed();
    const [scheduler, calls] = fakeScheduler('granted');
    open(true, scheduler);
    await screen.findByRole('heading', { level: 1 });
    await waitFor(() => expect(calls.replaced.length).toBeGreaterThan(0));
    expect(calls.replaced.at(-1)).toEqual([]);
    expect(calls.asked).toEqual([]);
  });

  it('says so, and schedules nothing, when notifications are off for the app', async () => {
    await seed(10);
    const [scheduler, calls] = fakeScheduler('denied');
    open(true, scheduler);
    expect(await screen.findByText(/Notifications for Taqweem are off/)).toBeTruthy();
    expect(calls.replaced).toEqual([]);
  });

  it('shows the phone’s own words when scheduling fails', async () => {
    await seed(10);
    const [scheduler] = fakeScheduler('granted');
    const failing: ReminderScheduler = {
      ...scheduler,
      replaceAll: () => Promise.reject(new Error('plugin missing')),
    };
    open(true, failing);
    expect(
      await screen.findByText(/Could not set the reminders on this phone: plugin missing/),
    ).toBeTruthy();
  });

  it('does nothing at all in the browser, where nothing could ring', async () => {
    await seed(10);
    const [scheduler, calls] = fakeScheduler('granted');
    open(false, scheduler);
    await screen.findByRole('heading', { level: 1 });
    await Promise.resolve();
    expect(calls.asked).toEqual([]);
    expect(calls.replaced).toEqual([]);
  });
});
