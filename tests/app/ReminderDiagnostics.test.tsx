import 'fake-indexeddb/auto';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { App } from '@/app/App';
import type { ReminderScheduler, ReminderStatus } from '@/app/native/scheduler';
import { createDb } from '@/data';
import { SettingsProvider } from '@/features/settings';
import { ReminderDiagnostics } from '@/ui/settings/ReminderDiagnostics';

const NOW = () => Date.UTC(2026, 9, 13, 12, 0);

const memoryStorage = () => {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
  };
};

function fake(status: ReminderStatus, grant: 'granted' | 'denied' = 'granted') {
  const log = { tests: [] as string[], exactOpened: 0, asked: [] as boolean[] };
  const scheduler: ReminderScheduler = {
    permission: (ask) => {
      log.asked.push(ask);
      return Promise.resolve(grant);
    },
    replaceAll: () => Promise.resolve(),
    status: () => Promise.resolve(status),
    sendTest: (title) => {
      log.tests.push(title);
      return Promise.resolve();
    },
    openExactAlarmSettings: () => {
      log.exactOpened += 1;
      return Promise.resolve();
    },
  };
  return { scheduler, log };
}

let dbName = '';
beforeEach(() => {
  dbName = `diag-${Math.random().toString(36).slice(2)}`;
});
afterEach(cleanup);

async function openSettings(reminders: boolean, scheduler: ReminderScheduler) {
  render(
    <App
      create={() => createDb(dbName)}
      now={NOW}
      storage={memoryStorage()}
      reminders={reminders}
      reminderScheduler={scheduler}
    />,
  );
  fireEvent.click(await screen.findByRole('button', { name: 'Settings' }));
  return screen.findByRole('dialog', { name: 'Settings' });
}

describe('the reminder check in Settings (D-163)', () => {
  it('is not there in the browser', async () => {
    const { scheduler } = fake({ permission: 'granted', exactAlarm: 'granted', pending: 0 });
    const dialog = await openSettings(false, scheduler);
    expect(within(dialog).queryByRole('button', { name: 'Check now' })).toBeNull();
  });

  it('tells what the phone says: permission, exact alarms, how many are scheduled', async () => {
    const { scheduler } = fake({ permission: 'denied', exactAlarm: 'granted', pending: 3 });
    const dialog = await openSettings(true, scheduler);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Check now' }));
    const list = await within(dialog).findByRole('status');
    expect(list.textContent).toContain('Notification permission: Denied');
    expect(list.textContent).toContain('Exact alarms: Allowed');
    expect(list.textContent).toContain('Scheduled reminders: 3');
    expect(within(dialog).queryByRole('button', { name: /exact-alarm settings/ })).toBeNull();
  });

  it('offers the exact-alarm screen when that is what is off', async () => {
    const { scheduler, log } = fake({ permission: 'granted', exactAlarm: 'denied', pending: 0 });
    const dialog = await openSettings(true, scheduler);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Check now' }));
    fireEvent.click(await within(dialog).findByRole('button', { name: /exact-alarm settings/ }));
    await waitFor(() => expect(log.exactOpened).toBe(1));
  });

  it('rings a test reminder, asking for permission first', async () => {
    const { scheduler, log } = fake({ permission: 'granted', exactAlarm: 'granted', pending: 0 });
    const dialog = await openSettings(true, scheduler);
    fireEvent.click(within(dialog).getByRole('button', { name: /Send a test reminder/ }));
    expect(await within(dialog).findByText(/A notification should appear/)).toBeTruthy();
    expect(log.tests).toEqual(['Taqweem test']);
    expect(log.asked).toContain(true);
  });

  it('sends nothing, and says why, when notifications are not allowed', async () => {
    const { scheduler, log } = fake(
      { permission: 'denied', exactAlarm: 'granted', pending: 0 },
      'denied',
    );
    const dialog = await openSettings(true, scheduler);
    fireEvent.click(within(dialog).getByRole('button', { name: /Send a test reminder/ }));
    expect(await within(dialog).findByText(/permission is not granted/)).toBeTruthy();
    expect(log.tests).toEqual([]);
  });

  it('shows the app version, and says so when the phone never answers', async () => {
    render(
      <SettingsProvider storage={memoryStorage()} languages={['en']}>
        <ReminderDiagnostics
          tools={{
            check: () => new Promise(() => undefined),
            test: () => Promise.resolve('sent'),
            openExactAlarmSettings: () => Promise.resolve(),
            answerMs: 50,
          }}
        />
      </SettingsProvider>,
    );
    expect(screen.getByText(/App version: /)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Check now' }));
    expect(screen.getByText('Checking…')).toBeTruthy();
    expect(await screen.findByText(/did not answer within 10 seconds/)).toBeTruthy();
  });
});
