import { describe, expect, it } from 'vitest';
import { convertTaqweemBackup, isTaqweemBackup, parseEnvelopeValue } from '@/core/model';
import { readBackupText } from '@/features/backup';

const base = {
  id: 'e1',
  title: 'اجتماع',
  date: '2026-11-10',
  startTime: '10:00',
  endTime: '11:30',
  allDay: false,
  description: 'تفاصيل',
  category: 'work',
  color: '#A56ADB',
  createdAt: 1_000,
  updatedAt: 2_000,
};
const file = (events: unknown[]) => ({
  app: 'nawy-today',
  schemaVersion: 1,
  exportedAt: '2026-11-08T10:00:00.000Z',
  events,
});

describe('«تقويم» backups', () => {
  it('are recognised by the missing calendars, and our own files are not', () => {
    expect(isTaqweemBackup(file([base]))).toBe(true);
    expect(isTaqweemBackup({ ...file([base]), calendars: [] })).toBe(false);
    expect(isTaqweemBackup(file([{ id: 'x' }]))).toBe(false);
    expect(isTaqweemBackup(null)).toBe(false);
  });

  it('become a valid envelope: timed in the person’s zone, calendars only for used categories', () => {
    const { envelope, skipped } = convertTaqweemBackup(file([base]), 'Asia/Riyadh', 5);
    expect(skipped).toBe(0);
    const parsed = parseEnvelopeValue(envelope);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.calendars.map((c) => [c.id, c.name, c.color])).toEqual([
      ['taqweem-work', 'عمل', 'purple'],
    ]);
    expect(parsed.value.exportedAt).toBe(Date.UTC(2026, 10, 8, 10));
    const [event] = parsed.value.events;
    expect(event).toMatchObject({
      id: 'e1',
      calendarId: 'taqweem-work',
      allDay: false,
      start: '2026-11-10T10:00',
      end: '2026-11-10T11:30',
      tzid: 'Asia/Riyadh',
      notes: 'تفاصيل',
    });
    expect(event?.color).toBeUndefined(); // the category's own colour is the calendar's
  });

  it('keeps a colour the person chose, and gives a start-only event one hour', () => {
    const { envelope } = convertTaqweemBackup(
      file([{ ...base, endTime: null, color: '#E27878' }]),
      'Asia/Riyadh',
      5,
    );
    const parsed = parseEnvelopeValue(envelope);
    expect(parsed.ok && parsed.value.events[0]).toMatchObject({
      end: '2026-11-10T11:00',
      color: '#E27878',
    });
  });

  it('turns an all-day or no-time event into an all-day event ending the next day', () => {
    const { envelope } = convertTaqweemBackup(
      file([
        { ...base, id: 'a', allDay: true, startTime: null, endTime: null },
        { ...base, id: 'b', startTime: null, endTime: null, date: '2026-12-31' },
      ]),
      'Asia/Riyadh',
      5,
    );
    const parsed = parseEnvelopeValue(envelope);
    const shape = parsed.ok ? parsed.value.events.map((e) => [e.allDay, e.start, e.end, e.tzid]) : [];
    expect(shape).toEqual([
      [true, '2026-11-10', '2026-11-11', undefined],
      [true, '2026-12-31', '2027-01-01', undefined],
    ]);
  });

  it('leaves out an event it cannot convert and counts it', () => {
    const { envelope, skipped } = convertTaqweemBackup(
      file([base, { ...base, id: 'bad', date: '2026-02-31' }, { ...base, id: 'c', category: 'x' }]),
      'Asia/Riyadh',
      5,
    );
    expect(skipped).toBe(2);
    expect(parseEnvelopeValue(envelope).ok).toBe(true);
  });

  it('are read by the import screen’s reader, in the device zone', () => {
    const read = readBackupText(JSON.stringify(file([base])));
    expect(read.ok).toBe(true);
    expect(read.ok && read.envelope.events).toHaveLength(1);
  });
});
