import { describe, expect, it } from 'vitest';
import { expandEvents, expandEventsIn, shownEnd, shownStart } from '@/core/recurrence';
import { makeAllDayEvent, makeEvent } from '../../helpers/factories';

// An event kept in another zone is drawn on the person's own clock (D-147). On 13 Oct 2026 London
// is on summer time (UTC+1) and Riyadh is UTC+3: two hours ahead.
const london = (over = {}) =>
  makeEvent({
    tzid: 'Europe/London',
    start: '2026-10-13T10:00',
    end: '2026-10-13T11:00',
    ...over,
  });

describe('expandEventsIn', () => {
  it('moves a timed event to the local clock and keeps its own times for editing', () => {
    const { occurrences } = expandEventsIn([london()], '2026-10-13', '2026-10-14', 'Asia/Riyadh');
    const [o] = occurrences;
    expect(occurrences).toHaveLength(1);
    expect(o?.start).toBe('2026-10-13T10:00');
    expect(o?.end).toBe('2026-10-13T11:00');
    expect(o && shownStart(o)).toBe('2026-10-13T12:00');
    expect(o && shownEnd(o)).toBe('2026-10-13T13:00');
  });

  it('puts an event on the day it falls on for the person, not the day it falls on where it is', () => {
    const late = london({ start: '2026-10-13T23:00', end: '2026-10-14T00:00' });
    const raw = expandEventsIn([late], '2026-10-13', '2026-10-14', 'Asia/Riyadh');
    const next = expandEventsIn([late], '2026-10-14', '2026-10-15', 'Asia/Riyadh');
    expect(raw.occurrences).toHaveLength(0);
    expect(next.occurrences).toHaveLength(1);
    expect(next.occurrences[0] && shownStart(next.occurrences[0])).toBe('2026-10-14T01:00');
  });

  it('converts each occurrence of a repeating event across a summer-time change', () => {
    // London goes back to winter time on 25 Oct 2026: 10:00 there is 12:00 here, then 13:00.
    const weekly = london({
      start: '2026-10-20T10:00',
      end: '2026-10-20T11:00',
      rrule: 'FREQ=WEEKLY;COUNT=2',
    });
    const { occurrences } = expandEventsIn([weekly], '2026-10-19', '2026-11-01', 'Asia/Riyadh');
    expect(occurrences.map(shownStart)).toEqual(['2026-10-20T12:00', '2026-10-27T13:00']);
    expect(occurrences.map((o) => o.start)).toEqual(['2026-10-20T10:00', '2026-10-27T10:00']);
  });

  it('leaves events in the person’s own zone, and all-day events, exactly as they are', () => {
    const own = makeEvent({ tzid: 'Asia/Riyadh' });
    const day = makeAllDayEvent();
    const events = [own, day, london()];
    const { occurrences } = expandEventsIn(events, '2026-10-13', '2026-10-14', 'Asia/Riyadh');
    const byId = new Map(occurrences.map((o) => [o.event.id, o]));
    expect(byId.get(own.id)?.shownStart).toBeUndefined();
    expect(byId.get(day.id)?.shownStart).toBeUndefined();
    expect(byId.get(own.id) && shownStart(byId.get(own.id)!)).toBe(own.start);
  });

  it('is exactly expandEvents when nothing is in another zone, or no zone is given', () => {
    const events = [makeEvent({ tzid: 'Asia/Riyadh' })];
    const plain = expandEvents(events, '2026-10-13', '2026-10-14');
    expect(expandEventsIn(events, '2026-10-13', '2026-10-14', 'Asia/Riyadh')).toEqual(plain);
    const foreign = [london()];
    expect(expandEventsIn(foreign, '2026-10-13', '2026-10-14', undefined)).toEqual(
      expandEvents(foreign, '2026-10-13', '2026-10-14'),
    );
  });

  it('ignores a zone the platform does not know instead of throwing', () => {
    const odd = london({ tzid: 'Mars/Olympus' });
    const { occurrences } = expandEventsIn([odd], '2026-10-13', '2026-10-14', 'Asia/Riyadh');
    expect(occurrences).toHaveLength(1);
    expect(occurrences[0]?.shownStart).toBeUndefined();
  });
});
