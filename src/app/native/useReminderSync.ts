import { useEffect, useRef, useState } from 'react';
import type { CalEvent } from '@/core/model';
import type { TimeFormatOptions, TimeZoneId } from '@/core/time';
import { planReminders, reminderOf, toScheduled } from '@/features/reminders';
import type { ReminderLabels } from '@/features/reminders';
import type { ReminderScheduler } from './scheduler';

// Keeps the phone's reminders in step with the calendar (D-161): planned again whenever the events
// change and whenever the app comes back to the front, because the phone's own list can be cleared
// (a reboot, a force stop) without this app knowing. Asks for permission only once a reminder exists.

export interface ReminderSyncInput {
  readonly scheduler: ReminderScheduler | undefined;
  readonly events: readonly CalEvent[];
  readonly ready: boolean;
  readonly now: () => number;
  readonly zone: TimeZoneId;
  readonly fmt: TimeFormatOptions;
  readonly labels: ReminderLabels;
}

export interface ReminderSync {
  /** A reminder is due but the person has switched notifications off for this app. */
  readonly blocked: boolean;
  /** The phone refused to schedule them: its own words, so the person is never left guessing. */
  readonly error: string | null;
}

export function useReminderSync(input: ReminderSyncInput): ReminderSync {
  const { scheduler, events, ready, now, zone, fmt, labels } = input;
  const [blocked, setBlocked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const last = useRef('');
  const { locale, numerals, hour12 } = fmt;
  const { untitled, allDay } = labels;

  useEffect(() => {
    if (!scheduler || !ready) return;
    let cancelled = false;

    const sync = async (force: boolean): Promise<void> => {
      const planned = planReminders(events, {
        nowMs: now(),
        localZone: zone,
        minutesBefore: reminderOf(events),
      });
      const items = toScheduled(
        planned,
        zone,
        { locale, hour12, ...(numerals !== undefined && { numerals }) },
        { untitled, allDay },
      );
      const signature = JSON.stringify(items);
      if (!force && signature === last.current) return;
      try {
        if (items.length > 0) {
          const state = await scheduler.permission(true);
          if (cancelled) return;
          setBlocked(state === 'denied');
          if (state !== 'granted') return;
        } else {
          setBlocked(false);
        }
        await scheduler.replaceAll(items);
        last.current = signature;
        if (!cancelled) setError(null);
      } catch (failure) {
        // The phone refused or the plugin is missing: say so, and try again at the next change or return.
        last.current = '';
        if (!cancelled) setError(failure instanceof Error ? failure.message : String(failure));
      }
    };

    void sync(false);
    const onVisible = (): void => {
      if (document.visibilityState === 'visible') void sync(true);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [scheduler, ready, events, now, zone, locale, numerals, hour12, untitled, allDay]);

  return { blocked, error };
}
