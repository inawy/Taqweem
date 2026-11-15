import { describe, expect, it } from 'vitest';
import { alarmTrigger, parseIcs, serializeIcs } from '@/core/ics';
import { makeAllDayEvent, makeCalendar, makeEvent } from '../../helpers/factories';

const file = (...lines: string[]) =>
  ['BEGIN:VCALENDAR', 'VERSION:2.0', ...lines, 'END:VCALENDAR'].join('\r\n');
const event = (...lines: string[]) => ['BEGIN:VEVENT', ...lines, 'END:VEVENT'].join('\r\n');
const ZONE = 'Asia/Riyadh';

describe('parseIcs', () => {
  it('refuses text that is not a calendar', () => {
    expect(parseIcs('hello', { zone: ZONE }).isCalendar).toBe(false);
  });

  it('reads a timed event in its own zone, with text unescaped', () => {
    const r = parseIcs(
      file(
        'X-WR-CALNAME:Work',
        event(
          'UID:a1',
          'DTSTART;TZID=Europe/London:20261025T090000',
          'DTEND;TZID=Europe/London:20261025T103000',
          'SUMMARY:Plan\\, review',
          'LOCATION:Room 2',
          'DESCRIPTION:line1\\nline2',
        ),
      ),
      { zone: ZONE },
    );
    expect(r.name).toBe('Work');
    expect(r.events).toEqual([
      {
        uid: 'a1',
        title: 'Plan, review',
        notes: 'line1\nline2',
        location: 'Room 2',
        allDay: false,
        start: '2026-10-25T09:00',
        end: '2026-10-25T10:30',
        tzid: 'Europe/London',
        exdates: [],
      },
    ]);
  });

  it('turns a UTC time into the wall time of the person’s zone', () => {
    const r = parseIcs(
      file(event('UID:u', 'DTSTART:20261025T060000Z', 'DTEND:20261025T070000Z', 'SUMMARY:x')),
      { zone: ZONE },
    );
    expect(r.events[0]).toMatchObject({
      start: '2026-10-25T09:00',
      end: '2026-10-25T10:00',
      tzid: ZONE,
    });
  });

  it('reads a floating time in the person’s zone', () => {
    const r = parseIcs(file(event('UID:f', 'DTSTART:20261025T090000', 'SUMMARY:x')), {
      zone: ZONE,
    });
    expect(r.events[0]).toMatchObject({ start: '2026-10-25T09:00', end: '2026-10-25T09:00' });
  });

  it('reads all-day events with an exclusive end, a duration, or nothing', () => {
    const r = parseIcs(
      file(
        event('UID:1', 'DTSTART;VALUE=DATE:20261025', 'DTEND;VALUE=DATE:20261028', 'SUMMARY:a'),
        event('UID:2', 'DTSTART;VALUE=DATE:20261025', 'DURATION:P2D', 'SUMMARY:b'),
        event('UID:3', 'DTSTART;VALUE=DATE:20261025', 'SUMMARY:c'),
      ),
      { zone: ZONE },
    );
    expect(r.events.map((e) => [e.allDay, e.start, e.end, e.tzid])).toEqual([
      [true, '2026-10-25', '2026-10-28', undefined],
      [true, '2026-10-25', '2026-10-27', undefined],
      [true, '2026-10-25', '2026-10-26', undefined],
    ]);
  });

  it('adds a DURATION to a timed event', () => {
    const r = parseIcs(
      file(
        event('UID:d', 'DTSTART;TZID=Asia/Riyadh:20261025T090000', 'DURATION:PT1H30M', 'SUMMARY:x'),
      ),
      { zone: ZONE },
    );
    expect(r.events[0]?.end).toBe('2026-10-25T10:30');
  });

  it('keeps a supported repeat rule with its exceptions, and an override of one day', () => {
    const r = parseIcs(
      file(
        event(
          'UID:s',
          'DTSTART;TZID=Asia/Riyadh:20261025T090000',
          'DTEND;TZID=Asia/Riyadh:20261025T100000',
          'RRULE:FREQ=WEEKLY;COUNT=4',
          'EXDATE;TZID=Asia/Riyadh:20261101T090000',
          'SUMMARY:Standup',
        ),
        event(
          'UID:s',
          'RECURRENCE-ID;TZID=Asia/Riyadh:20261108T090000',
          'DTSTART;TZID=Asia/Riyadh:20261108T110000',
          'DTEND;TZID=Asia/Riyadh:20261108T120000',
          'SUMMARY:Standup (moved)',
        ),
      ),
      { zone: ZONE },
    );
    expect(r.events).toHaveLength(2);
    expect(r.events[0]).toMatchObject({
      rrule: 'FREQ=WEEKLY;COUNT=4',
      exdates: ['2026-11-01T09:00'],
    });
    expect(r.events[1]).toMatchObject({
      originalStart: '2026-11-08T09:00',
      start: '2026-11-08T11:00',
    });
  });

  it('moves a UTC UNTIL into the event’s zone', () => {
    const r = parseIcs(
      file(
        event(
          'UID:u',
          'DTSTART;TZID=Asia/Riyadh:20261025T090000',
          'RRULE:FREQ=DAILY;UNTIL=20261030T060000Z',
          'SUMMARY:x',
        ),
      ),
      { zone: ZONE },
    );
    expect(r.events[0]?.rrule).toBe('FREQ=DAILY;UNTIL=20261030T090000');
  });

  it('counts what it cannot honour instead of dropping it silently', () => {
    const r = parseIcs(
      file(
        event('UID:no-start', 'SUMMARY:x'),
        event('UID:c', 'STATUS:CANCELLED', 'DTSTART:20261025T090000', 'SUMMARY:x'),
        event('UID:hourly', 'DTSTART:20261025T090000', 'RRULE:FREQ=HOURLY', 'SUMMARY:x'),
        event('UID:tz', 'DTSTART;TZID=Mars/Olympus:20261025T090000', 'SUMMARY:x'),
        event(
          'UID:al',
          'DTSTART:20261025T090000',
          'SUMMARY:x',
          'BEGIN:VALARM',
          'ACTION:DISPLAY',
          'TRIGGER:-PT10M',
          'END:VALARM',
        ),
        'BEGIN:VTODO\r\nUID:t\r\nSUMMARY:todo\r\nEND:VTODO',
        event('UID:gone', 'RECURRENCE-ID:20261101T090000', 'DTSTART:20261101T100000', 'SUMMARY:x'),
      ),
      { zone: ZONE },
    );
    expect(r.report).toEqual({
      unreadable: 1,
      cancelled: 1,
      orphanOverrides: 1,
      ruleDropped: 1,
      unknownZone: 1,
      alarms: 1,
      otherComponents: 1,
    });
    // Unreadable, cancelled and orphan ones are gone; the other three are kept.
    expect(r.events.map((e) => e.uid)).toEqual(['hourly', 'tz', 'al']);
    expect(r.events[0]?.rrule).toBeUndefined();
  });
});

describe('serializeIcs', () => {
  const calendars = [makeCalendar({ id: 'c', name: 'Home, sweet' })];

  it('writes a valid calendar with zones, all-day dates and no alarms', () => {
    const text = serializeIcs({
      calendars,
      events: [
        makeEvent({
          id: 'e1',
          calendarId: 'c',
          title: 'Lunch; with Ali',
          location: 'Cafe',
          notes: 'a\nb',
          updatedAt: 0,
        }),
        makeAllDayEvent({ id: 'e2', calendarId: 'c', title: 'Trip', updatedAt: 0 }),
      ],
    });
    expect(text.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n')).toBe(true);
    expect(text.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(text).toContain('UID:e1@nawy-today');
    expect(text).toContain('DTSTAMP:19700101T000000Z');
    expect(text).toContain('DTSTART;TZID=Asia/Riyadh:20261013T090000');
    expect(text).toContain('DTEND;TZID=Asia/Riyadh:20261013T100000');
    expect(text).toContain('SUMMARY:Lunch\\; with Ali');
    expect(text).toContain('DESCRIPTION:a\\nb');
    expect(text).toContain('CATEGORIES:Home\\, sweet');
    expect(text).toContain('DTSTART;VALUE=DATE:20261013');
    expect(text).toContain('DTEND;VALUE=DATE:20261014');
    expect(text).not.toContain('VALARM');
  });

  it('exports a Hijri-yearly series without an RRULE other calendars would misread (D-111)', () => {
    const text = serializeIcs({
      calendars,
      events: [
        makeEvent({ id: 'h', calendarId: 'c', title: 'Ramadan', rrule: 'FREQ=YEARLY;X-HIJRI=9-1' }),
        makeEvent({ id: 'w', calendarId: 'c', title: 'Weekly', rrule: 'FREQ=WEEKLY;COUNT=4' }),
      ],
    });
    expect(text).not.toContain('RRULE:FREQ=YEARLY;X-HIJRI');
    expect(text).toContain('X-NAWY-HIJRI-RULE:FREQ=YEARLY;X-HIJRI=9-1');
    expect(text).toContain('RRULE:FREQ=WEEKLY;COUNT=4');
  });

  it('reads its own Hijri rule back from the private line, and ignores it next to an RRULE (D-115)', () => {
    const back = parseIcs(
      file(
        event(
          'UID:h',
          'DTSTART;VALUE=DATE:20260219',
          'SUMMARY:Ramadan',
          'X-NAWY-HIJRI-RULE:FREQ=YEARLY;X-HIJRI=9-1',
        ),
      ),
      { zone: ZONE },
    );
    expect(back.events[0]).toMatchObject({ rrule: 'FREQ=YEARLY;X-HIJRI=9-1' });
    expect(back.report.ruleDropped).toBe(0);

    const both = parseIcs(
      file(
        event(
          'UID:b',
          'DTSTART;VALUE=DATE:20260219',
          'SUMMARY:Both',
          'RRULE:FREQ=WEEKLY;COUNT=2',
          'X-NAWY-HIJRI-RULE:FREQ=YEARLY;X-HIJRI=9-1',
        ),
      ),
      { zone: ZONE },
    );
    expect(both.events[0]).toMatchObject({ rrule: 'FREQ=WEEKLY;COUNT=2' });
  });

  it('leaves out deleted events and overrides whose series is gone', () => {
    const text = serializeIcs({
      calendars,
      events: [
        makeEvent({ id: 'gone', calendarId: 'c', title: '', deletedAt: 5 }),
        makeEvent({
          id: 'o',
          calendarId: 'c',
          seriesId: 'missing',
          originalStart: '2026-10-13T09:00',
        }),
        makeEvent({ id: 'x', calendarId: 'unknown' }),
      ],
    });
    expect(text).not.toContain('BEGIN:VEVENT');
  });

  it('reads back what it wrote, repeats and overrides included', () => {
    const series = makeEvent({
      id: 'series',
      calendarId: 'c',
      title: 'Standup',
      rrule: 'FREQ=WEEKLY;COUNT=4',
      exdates: ['2026-10-20T09:00'],
    });
    const override = makeEvent({
      id: 'ovr',
      calendarId: 'c',
      title: 'Standup (moved)',
      start: '2026-10-27T11:00',
      end: '2026-10-27T12:00',
      seriesId: 'series',
      originalStart: '2026-10-27T09:00',
    });
    const back = parseIcs(serializeIcs({ calendars, events: [series, override] }), { zone: ZONE });
    expect(back.report.unreadable + back.report.orphanOverrides + back.report.ruleDropped).toBe(0);
    expect(back.events).toHaveLength(2);
    const [s, o] = back.events;
    expect(s).toMatchObject({
      uid: 'series@nawy-today',
      nawyId: 'series',
      title: 'Standup',
      start: '2026-10-13T09:00',
      rrule: 'FREQ=WEEKLY;COUNT=4',
      exdates: ['2026-10-20T09:00'],
    });
    expect(o).toMatchObject({
      uid: 'series@nawy-today',
      nawyId: 'ovr',
      originalStart: '2026-10-27T09:00',
      start: '2026-10-27T11:00',
    });
  });
});

describe('an alarm asked for in the file (D-159)', () => {
  const calendars = [makeCalendar({ id: 'c', name: 'Home' })];

  it('computes the trigger: before a timed start, from 09:00 for an all-day one', () => {
    expect(alarmTrigger(0, false)).toBe('PT0S');
    expect(alarmTrigger(10, false)).toBe('-PT10M');
    expect(alarmTrigger(60, false)).toBe('-PT60M');
    expect(alarmTrigger(1440, false)).toBe('-PT1440M');
    expect(alarmTrigger(0, true)).toBe('PT9H');
    expect(alarmTrigger(60, true)).toBe('PT8H');
    expect(alarmTrigger(1440, true)).toBe('-PT15H');
    expect(alarmTrigger(30, true)).toBe('PT8H30M');
  });

  it('refuses offsets that make no sense', () => {
    for (const bad of [-1, 1.5, Number.NaN, 7 * 24 * 60 + 1]) {
      expect(alarmTrigger(bad, false)).toBeUndefined();
    }
  });

  it('writes a display alarm in every event, and none unless asked', () => {
    const e = makeEvent({ id: 'a', calendarId: 'c', title: 'Dentist; today' });
    const asked = serializeIcs({ calendars, events: [e], alarmMinutes: 10 });
    expect(asked).toContain(
      'BEGIN:VALARM\r\nACTION:DISPLAY\r\nDESCRIPTION:Dentist\\; today\r\nTRIGGER:-PT10M\r\nEND:VALARM',
    );
    expect(serializeIcs({ calendars, events: [e] })).not.toContain('VALARM');
    expect(serializeIcs({ calendars, events: [e], alarmMinutes: -5 })).not.toContain('VALARM');
  });

  it('still reads back as the same event', () => {
    const e = makeEvent({ id: 'a', calendarId: 'c', title: 'Dentist' });
    const back = parseIcs(serializeIcs({ calendars, events: [e], alarmMinutes: 60 }), {
      zone: ZONE,
    });
    expect(back.events).toHaveLength(1);
    expect(back.events[0]?.title).toBe('Dentist');
  });
});
