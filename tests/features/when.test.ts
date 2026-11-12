import { describe, expect, it } from 'vitest';
import { describeWhen, describeWhenHere } from '@/features/events';

const en = { locale: 'en', hour12: false };

describe('describeWhen', () => {
  it('names a one-day all-day event by its date only', () => {
    expect(
      describeWhen({ start: '2026-10-20', end: '2026-10-21', allDay: true }, en, 'Asia/Riyadh'),
    ).toBe('Tuesday, October 20, 2026');
  });

  it('shows the last real day of a multi-day all-day event (the end is exclusive)', () => {
    const text = describeWhen(
      { start: '2026-10-20', end: '2026-10-23', allDay: true },
      en,
      'Asia/Riyadh',
    );
    expect(text).toContain('October 20');
    expect(text).toContain('October 22');
    expect(text).not.toContain('October 23');
  });

  it('gives date and times for a same-day event, without a zone when it is the local one', () => {
    const text = describeWhen(
      { start: '2026-10-20T09:00', end: '2026-10-20T10:30', allDay: false, tzid: 'Asia/Riyadh' },
      en,
      'Asia/Riyadh',
    );
    expect(text).toBe('Tuesday, October 20, 2026 · 09:00 – 10:30');
  });

  it('names the zone when it differs from the local one', () => {
    const text = describeWhen(
      { start: '2026-10-20T09:00', end: '2026-10-20T10:00', allDay: false, tzid: 'Europe/Paris' },
      en,
      'Asia/Riyadh',
    );
    expect(text.endsWith('(Europe/Paris)')).toBe(true);
  });

  it('gives both dates when an event crosses midnight', () => {
    const text = describeWhen(
      { start: '2026-10-20T22:00', end: '2026-10-21T01:00', allDay: false, tzid: 'Asia/Riyadh' },
      en,
      'Asia/Riyadh',
    );
    expect(text).toContain('October 20');
    expect(text).toContain('October 21');
  });
});

describe('describeWhenHere (D-148)', () => {
  const london = {
    start: '2026-10-13T10:00',
    end: '2026-10-13T11:00',
    allDay: false,
    tzid: 'Europe/London',
  };

  it('gives the same moment on the person’s own clock', () => {
    expect(describeWhenHere(london, en, 'Asia/Riyadh')).toBe(
      'Tuesday, October 13, 2026 · 12:00 – 13:00',
    );
  });

  it('carries the date over midnight', () => {
    const late = { ...london, start: '2026-10-13T23:00', end: '2026-10-14T00:30' };
    expect(describeWhenHere(late, en, 'Asia/Riyadh')).toBe(
      'Wednesday, October 14, 2026 · 01:00 – 02:30',
    );
  });

  it('says nothing for the person’s own zone, a missing or unknown zone, or an all-day event', () => {
    expect(describeWhenHere({ ...london, tzid: 'Asia/Riyadh' }, en, 'Asia/Riyadh')).toBeUndefined();
    expect(describeWhenHere({ ...london, tzid: undefined }, en, 'Asia/Riyadh')).toBeUndefined();
    expect(
      describeWhenHere({ ...london, tzid: 'Mars/Olympus' }, en, 'Asia/Riyadh'),
    ).toBeUndefined();
    expect(
      describeWhenHere(
        { start: '2026-10-20', end: '2026-10-21', allDay: true, tzid: 'Europe/London' },
        en,
        'Asia/Riyadh',
      ),
    ).toBeUndefined();
  });
});
