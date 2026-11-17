import { describe, expect, it, vi } from 'vitest';

// Capacitor's plugin object is a proxy that answers every property, `then` included. Handing it
// back through a promise makes the promise call `then`, which throws on Android. This stand-in
// behaves the same way, so the scheduler must never resolve a promise with the plugin itself.
vi.mock('@capacitor/local-notifications', () => {
  const calls: string[] = [];
  const plugin = {
    then: () => {
      throw new Error('"LocalNotifications.then()" is not implemented on android');
    },
    checkPermissions: () => Promise.resolve({ display: 'granted' }),
    requestPermissions: () => Promise.resolve({ display: 'granted' }),
    getPending: () => Promise.resolve({ notifications: [] }),
    cancel: () => Promise.resolve(),
    createChannel: () => Promise.resolve(),
    schedule: ({ notifications }: { notifications: unknown[] }) => {
      calls.push(`schedule:${notifications.length}`);
      return Promise.resolve({ notifications });
    },
    checkExactNotificationSetting: () => Promise.resolve({ exact_alarm: 'granted' }),
    changeExactNotificationSetting: () => Promise.resolve(),
  };
  return { LocalNotifications: plugin, __calls: calls };
});

import { capacitorScheduler } from '@/app/native/scheduler';

describe('the phone scheduler (D-169)', () => {
  const scheduler = capacitorScheduler('Reminders', () => 0);

  it('reads the permission although the plugin object looks like a promise', async () => {
    await expect(scheduler.permission(false)).resolves.toBe('granted');
  });

  it('answers the status', async () => {
    await expect(scheduler.status()).resolves.toEqual({
      permission: 'granted',
      exactAlarm: 'granted',
      pending: 0,
    });
  });

  it('sends a test reminder', async () => {
    await expect(scheduler.sendTest('t', 'b')).resolves.toBeUndefined();
  });
});
