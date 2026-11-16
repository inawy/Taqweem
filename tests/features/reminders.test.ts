import { describe, expect, it } from 'vitest';
import { planReminders, reminderOf } from '@/features/reminders';
import type { CalEvent } from '@/core/model';
import { toInstantMs } from '@/core/time';
import { makeAllDayEvent, makeEvent } from '../helpers/factories';

const ZONE = 'Asia/Riyadh';
// 13 Oct 2026, 12:00 in Riyadh.
const NOW = toInstantMs('2026-10-13T12:00', ZONE);
const ten = () => 10;
type Over = Partial<Parameters<typeof planReminders>[1]>;
const plan = (events: CalEvent[], over: Over = {}) =>
  planReminders(events, { nowMs: NOW, localZone: ZONE, minutesBefore: ten, ...over });

describe('planReminders (D-161)', () => {
  it('rings the chosen minutes before a timed event', () => {
    const [r] = plan([makeEvent({ id: 'a', start: '2026-10-13T15:00', end: '2026-10-13T16:00' })]);
    expect(r?.atMs).toBe(toInstantMs('2026-10-13T14:50', ZONE));
    expect(r?.startMs).toBe(toInstantMs('2026-10-13T15:00', ZONE));
    expect(r?.title).toBe('Meeting');
    expect(r?.minutesBefore).toBe(10);
  });

  it('skips events without a reminder, deleted ones and bad offsets', () => {
    const at = { start: '2026-10-14T09:00', end: '2026-10-14T10:00' };
    const events = [
      makeEvent({ id: 'none', ...at }),
      makeEvent({ id: 'gone', deletedAt: 1, ...at }),
      makeEvent({ id: 'bad', ...at }),
      makeEvent({ id: 'ok', ...at }),
    ];
    const minutes: Record<string, number | undefined> = { gone: 10, bad: -5, ok: 10 };
    const out = plan(events, { minutesBefore: (ev) => minutes[ev.id] });
    expect(out.map((r) => r.eventId)).toEqual(['ok']);
  });

  it('leaves out reminders already past and those beyond the window', () => {
    const past = makeEvent({ id: 'past', start: '2026-10-13T12:05', end: '2026-10-13T13:00' });
    const soon = makeEvent({ id: 'soon', start: '2026-10-13T12:30', end: '2026-10-13T13:00' });
    const far = makeEvent({ id: 'far', start: '2026-11-20T09:00', end: '2026-11-20T10:00' });
    // `past` would ring at 11:55, before now; `far` is outside 14 days.
    expect(plan([past, soon, far]).map((r) => r.eventId)).toEqual(['soon']);
  });

  it('counts an event just past the window whose reminder falls inside it', () => {
    // Window ends 27 Oct 12:00. An event at 27 Oct 12:30 with a 1-hour reminder rings at 11:30.
    const e = makeEvent({ id: 'edge', start: '2026-10-27T12:30', end: '2026-10-27T13:30' });
    expect(plan([e], { minutesBefore: () => 60 })).toHaveLength(1);
  });

  it('plans each occurrence of a repeating event inside the window', () => {
    const daily = makeEvent({
      id: 'daily',
      start: '2026-10-10T08:00',
      end: '2026-10-10T08:30',
      rrule: 'FREQ=DAILY',
    });
    const out = plan([daily], { windowDays: 3 });
    // 14, 15 and 16 Oct at 07:50; the 13th's 07:50 is already past.
    expect(out.map((r) => r.atMs)).toEqual(
      ['2026-10-14T07:50', '2026-10-15T07:50', '2026-10-16T07:50'].map((t) => toInstantMs(t, ZONE)),
    );
    expect(new Set(out.map((r) => r.key)).size).toBe(3);
  });

  it('uses the event’s own zone: a London 09:00 is 11:00 in Riyadh in October', () => {
    const london = makeEvent({
      id: 'ldn',
      tzid: 'Europe/London',
      start: '2026-10-14T09:00',
      end: '2026-10-14T10:00',
    });
    const [r] = plan([london]);
    expect(r?.startMs).toBe(toInstantMs('2026-10-14T11:00', ZONE));
    expect(r?.atMs).toBe(toInstantMs('2026-10-14T10:50', ZONE));
  });

  it('counts an all-day event from 09:00 on its day', () => {
    const day = makeAllDayEvent({ id: 'day', start: '2026-10-15', end: '2026-10-16' });
    const [r] = plan([day], { minutesBefore: () => 60 });
    expect(r?.startMs).toBe(toInstantMs('2026-10-15T09:00', ZONE));
    expect(r?.atMs).toBe(toInstantMs('2026-10-15T08:00', ZONE));
    expect(r?.allDay).toBe(true);
  });

  it('is sorted soonest first and cut at the limit', () => {
    const events = [3, 1, 2].map((d) =>
      makeEvent({ id: `e${d}`, start: `2026-10-1${3 + d}T09:00`, end: `2026-10-1${3 + d}T10:00` }),
    );
    expect(plan(events).map((r) => r.eventId)).toEqual(['e1', 'e2', 'e3']);
    expect(plan(events, { limit: 2 }).map((r) => r.eventId)).toEqual(['e1', 'e2']);
    expect(plan(events, { limit: 0 })).toEqual([]);
    expect(plan(events, { windowDays: 0 })).toEqual([]);
  });

  it('gives the same plan for the same input', () => {
    const e = makeEvent({ id: 'a', start: '2026-10-14T09:00', end: '2026-10-14T10:00' });
    expect(plan([e])).toEqual(plan([e]));
  });
});

describe('reminderOf (D-161)', () => {
  it('takes an occurrence’s own reminder, else its series’, else none', () => {
    const master = makeEvent({ id: 'm', rrule: 'FREQ=DAILY', reminderMinutes: 60 });
    const plain = makeEvent({ id: 'p', reminderMinutes: 5 });
    const bare = makeEvent({ id: 'b' });
    const inherits = makeEvent({ id: 'o1', seriesId: 'm', originalStart: '2026-10-14T09:00' });
    const own = makeEvent({
      id: 'o2',
      seriesId: 'm',
      originalStart: '2026-10-15T09:00',
      reminderMinutes: 0,
    });
    const of = reminderOf([master, plain, bare, inherits, own]);
    expect(of(master)).toBe(60);
    expect(of(plain)).toBe(5);
    expect(of(bare)).toBeUndefined();
    expect(of(inherits)).toBe(60);
    expect(of(own)).toBe(0);
  });
});
