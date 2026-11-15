import { fromInstantMs, isValidDate } from '@/core/time';
import type { CalEvent, Calendar } from '@/core/model';
import { escapeText, foldLine } from './text';

// Events → an .ics file (RFC 5545). No alarms are written unless one is asked for (D-159): this app
// does not remind (D-002); an alarm in the file is carried out by whatever opens the file.

export const PRODID = '-//Nawy Today//AR//EN';

/** `2026-10-25` → `20261025`; `2026-10-25T09:30` → `20261025T093000`. */
export function icsLocal(value: string): string {
  return value.replace(/[-:]/g, '').replace(/^(\d{8}T\d{4})$/, '$100');
}

/** `…Z` UTC stamp for an epoch-ms instant. */
export function icsStamp(epochMs: number): string {
  return `${icsLocal(fromInstantMs(epochMs, 'UTC'))}Z`;
}

function when(name: string, value: string, tzid: string | undefined): string {
  return isValidDate(value) || tzid === undefined
    ? `${name};VALUE=DATE:${icsLocal(value)}`
    : `${name};TZID=${tzid}:${icsLocal(value)}`;
}

/** The 09:00 an all-day event's alarm counts from: it starts at midnight, a bad hour to ring. */
const ALL_DAY_ALARM_MINUTE = 9 * 60;
const MAX_ALARM_MINUTES = 7 * 24 * 60;

/** RFC 5545 `TRIGGER` value, or `undefined` for a number that is no sensible offset. */
export function alarmTrigger(minutes: number, allDay: boolean): string | undefined {
  if (!Number.isInteger(minutes) || minutes < 0 || minutes > MAX_ALARM_MINUTES) return undefined;
  const total = allDay ? ALL_DAY_ALARM_MINUTE - minutes : -minutes;
  if (total === 0) return 'PT0S';
  const abs = Math.abs(total);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `${total < 0 ? '-' : ''}PT${h > 0 ? `${h}H` : ''}${m > 0 ? `${m}M` : ''}`;
}

export interface IcsInput {
  readonly calendars: readonly Calendar[];
  readonly events: readonly CalEvent[];
  readonly name?: string;
  /** Minutes before the start that the program opening the file should alert (D-159). */
  readonly alarmMinutes?: number;
}

export function serializeIcs(input: IcsInput): string {
  const calendarNames = new Map(
    input.calendars.filter((c) => c.deletedAt === undefined).map((c) => [c.id, c.name]),
  );
  const live = input.events.filter(
    (e) => e.deletedAt === undefined && calendarNames.has(e.calendarId),
  );
  const seriesIds = new Set(live.filter((e) => e.seriesId === undefined).map((e) => e.id));

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${PRODID}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];
  if (input.name !== undefined) lines.push(`X-WR-CALNAME:${escapeText(input.name)}`);

  for (const e of live) {
    if (e.seriesId !== undefined && !seriesIds.has(e.seriesId)) continue;
    const tz = e.allDay ? undefined : e.tzid;
    const stamp = icsStamp(e.updatedAt);
    lines.push(
      'BEGIN:VEVENT',
      `UID:${e.seriesId ?? e.id}@nawy-today`,
      `X-NAWY-ID:${e.id}`,
      `DTSTAMP:${stamp}`,
      `LAST-MODIFIED:${stamp}`,
    );
    if (e.originalStart !== undefined) lines.push(when('RECURRENCE-ID', e.originalStart, tz));
    lines.push(when('DTSTART', e.start, tz), when('DTEND', e.end, tz));
    lines.push(`SUMMARY:${escapeText(e.title)}`);
    if (e.location) lines.push(`LOCATION:${escapeText(e.location)}`);
    if (e.notes) lines.push(`DESCRIPTION:${escapeText(e.notes)}`);
    const calendarName = calendarNames.get(e.calendarId);
    if (calendarName) lines.push(`CATEGORIES:${escapeText(calendarName)}`);
    // A Hijri-yearly rule has no RFC 5545 form: other calendars would read it as a plain yearly one.
    // It is exported as a single event with a note of the rule (D-111); the JSON backup keeps it.
    if (e.rrule?.includes('X-HIJRI')) lines.push(`X-NAWY-HIJRI-RULE:${e.rrule}`);
    else if (e.rrule) lines.push(`RRULE:${e.rrule}`);
    for (const x of e.exdates ?? []) lines.push(when('EXDATE', x, tz));
    const trigger =
      input.alarmMinutes === undefined ? undefined : alarmTrigger(input.alarmMinutes, e.allDay);
    if (trigger !== undefined) {
      lines.push(
        'BEGIN:VALARM',
        'ACTION:DISPLAY',
        `DESCRIPTION:${escapeText(e.title)}`,
        `TRIGGER:${trigger}`,
        'END:VALARM',
      );
    }
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return `${lines.map(foldLine).join('\r\n')}\r\n`;
}
