import { dateOfInstantMs } from '@/core/time';
import type { ScheduledReminder } from '@/features/reminders';

// The one place that talks to the phone's notification system (D-161). The plugin is loaded only
// when asked, so the browser build never runs it.

export type NotificationPermission = 'granted' | 'denied' | 'prompt';

export type ExactAlarm = 'granted' | 'denied' | 'unknown';

/** What the phone says about reminders right now: for the person to read, not to act on silently. */
export interface ReminderStatus {
  readonly permission: NotificationPermission;
  readonly exactAlarm: ExactAlarm;
  readonly pending: number;
}

export interface ReminderScheduler {
  /** The permission now; with `ask`, shows the system prompt first if it is still undecided. */
  permission(ask: boolean): Promise<NotificationPermission>;
  /** Makes these the only reminders the phone has: cancels the rest, schedules these. */
  replaceAll(items: readonly ScheduledReminder[]): Promise<void>;
  /** The permission, the exact-alarm setting and how many reminders the phone holds. */
  status(): Promise<ReminderStatus>;
  /** Rings once, a few seconds from now, apart from any event: tells the phone from the data. */
  sendTest(title: string, body: string): Promise<void>;
  /** Opens the phone's screen for exact alarms, when that is what is off. */
  openExactAlarmSettings(): Promise<void>;
}

const CHANNEL_ID = 'reminders';
const TEST_ID = 2_147_483_000;
const TEST_DELAY_MS = 10_000;

/** `channelName` is what the phone's own notification settings call these reminders. */
export function capacitorScheduler(channelName: string, nowMs: () => number): ReminderScheduler {
  const plugin = () => import('@capacitor/local-notifications').then((m) => m.LocalNotifications);
  // Android 8+ files every notification in a channel; make ours loud enough to show on screen.
  const ensureChannel = async (): Promise<void> => {
    try {
      const notifications = await plugin();
      await notifications.createChannel({
        id: CHANNEL_ID,
        name: channelName,
        description: '',
        importance: 4,
        visibility: 1,
        vibration: true,
      });
    } catch {
      // Not Android, or the channel exists already: nothing to do.
    }
  };
  const permission = async (ask: boolean): Promise<NotificationPermission> => {
    const notifications = await plugin();
    let state = (await notifications.checkPermissions()).display;
    if (state !== 'granted' && state !== 'denied' && ask) {
      state = (await notifications.requestPermissions()).display;
    }
    return state === 'granted' ? 'granted' : state === 'denied' ? 'denied' : 'prompt';
  };
  return {
    permission,
    async replaceAll(items) {
      const notifications = await plugin();
      const pending = await notifications.getPending();
      if (pending.notifications.length > 0) {
        await notifications.cancel({ notifications: pending.notifications });
      }
      if (items.length === 0) return;
      await ensureChannel();
      await notifications.schedule({
        notifications: items.map((i) => ({
          id: i.id,
          title: i.title,
          body: i.body,
          channelId: CHANNEL_ID,
          schedule: { at: dateOfInstantMs(i.atMs), allowWhileIdle: true },
        })),
      });
    },
    async status() {
      const notifications = await plugin();
      const allowed = await permission(false);
      const pending = (await notifications.getPending()).notifications.length;
      let exactAlarm: ExactAlarm = 'unknown';
      try {
        const exact = (await notifications.checkExactNotificationSetting()).exact_alarm;
        exactAlarm = exact === 'granted' ? 'granted' : exact === 'denied' ? 'denied' : 'unknown';
      } catch {
        // Only Android has this setting.
      }
      return { permission: allowed, exactAlarm, pending };
    },
    async sendTest(title, body) {
      const notifications = await plugin();
      await ensureChannel();
      await notifications.schedule({
        notifications: [
          {
            id: TEST_ID,
            title,
            body,
            channelId: CHANNEL_ID,
            schedule: { at: dateOfInstantMs(nowMs() + TEST_DELAY_MS), allowWhileIdle: true },
          },
        ],
      });
    },
    async openExactAlarmSettings() {
      const notifications = await plugin();
      await notifications.changeExactNotificationSetting();
    },
  };
}
