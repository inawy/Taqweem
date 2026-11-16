import { dateOfInstantMs } from '@/core/time';
import type { ScheduledReminder } from '@/features/reminders';

// The one place that talks to the phone's notification system (D-161). The plugin is loaded only
// when asked, so the browser build never runs it.

export type NotificationPermission = 'granted' | 'denied' | 'prompt';

export interface ReminderScheduler {
  /** The permission now; with `ask`, shows the system prompt first if it is still undecided. */
  permission(ask: boolean): Promise<NotificationPermission>;
  /** Makes these the only reminders the phone has: cancels the rest, schedules these. */
  replaceAll(items: readonly ScheduledReminder[]): Promise<void>;
}

export function capacitorScheduler(): ReminderScheduler {
  const plugin = () => import('@capacitor/local-notifications').then((m) => m.LocalNotifications);
  return {
    async permission(ask) {
      const notifications = await plugin();
      let state = (await notifications.checkPermissions()).display;
      if (state !== 'granted' && state !== 'denied' && ask) {
        state = (await notifications.requestPermissions()).display;
      }
      return state === 'granted' ? 'granted' : state === 'denied' ? 'denied' : 'prompt';
    },
    async replaceAll(items) {
      const notifications = await plugin();
      const pending = await notifications.getPending();
      if (pending.notifications.length > 0) {
        await notifications.cancel({ notifications: pending.notifications });
      }
      if (items.length === 0) return;
      await notifications.schedule({
        notifications: items.map((i) => ({
          id: i.id,
          title: i.title,
          body: i.body,
          schedule: { at: dateOfInstantMs(i.atMs), allowWhileIdle: true },
        })),
      });
    },
  };
}
