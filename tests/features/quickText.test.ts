import { describe, expect, it } from 'vitest';
import { applyQuickText, parseQuickText } from '@/features/events';
import type { PlainDate } from '@/core/time';
import type { Draft } from '@/features/events';

// 2026-11-05 is a Thursday.
const TODAY = '2026-11-05' as PlainDate;
const parse = (s: string) => parseQuickText(s, TODAY);

describe('parseQuickText', () => {
  it('reads a weekday and an evening hour', () => {
    expect(parse('اجتماع الخميس 5 مساءً')).toMatchObject({
      title: 'اجتماع',
      date: '2026-11-05',
      time: '17:00',
    });
    expect(parse('غداء يوم السبت الساعة ٢ ظهرا')).toMatchObject({
      title: 'غداء',
      date: '2026-11-07',
      time: '14:00',
    });
  });

  it('reads relative days in Egyptian and standard spellings', () => {
    expect(parse('دكتور بكرة 10 ص')).toMatchObject({ date: '2026-11-06', time: '10:00' });
    expect(parse('سفر بعد بكرة')).toMatchObject({ title: 'سفر', date: '2026-11-07' });
    expect(parse('مراجعة اليوم 9:30م')).toMatchObject({ date: '2026-11-05', time: '21:30' });
  });

  it('reads English too', () => {
    expect(parse('Lunch tomorrow 1pm')).toMatchObject({
      title: 'Lunch',
      date: '2026-11-06',
      time: '13:00',
    });
    expect(parse('Review friday 9:15am')).toMatchObject({ date: '2026-11-06', time: '09:15' });
  });

  it('takes the next such weekday, today included', () => {
    expect(parse('نادي الأحد')).toMatchObject({ date: '2026-11-08' });
    expect(parse('نادي الخميس')).toMatchObject({ date: '2026-11-05' });
  });

  it('does not guess a bare hour, and accepts a 24-hour time', () => {
    expect(parse('اجتماع الخميس الساعة 5').time).toBeUndefined();
    expect(parse('اجتماع الخميس 17:00')).toMatchObject({ title: 'اجتماع', time: '17:00' });
  });

  it('twelve is noon with a pm word and midnight with an am word', () => {
    expect(parse('غداء 12 م').time).toBe('12:00');
    expect(parse('نوم 12 ص').time).toBe('00:00');
  });

  it('leaves plain text, or text that is only a date, untouched', () => {
    expect(parse('شراء خبز')).toEqual({ title: 'شراء خبز', understood: '' });
    expect(parse('الخميس')).toEqual({ title: 'الخميس', understood: '' });
    expect(parse('')).toEqual({ title: '', understood: '' });
  });

  it('says what it understood', () => {
    expect(parse('اجتماع الخميس 5 مساءً').understood).toBe('الخميس 5 مساءً');
  });
});

describe('applyQuickText', () => {
  const allDay: Draft = {
    title: '',
    notes: '',
    location: '',
    calendarId: 'c',
    allDay: true,
    startDate: '2026-10-13',
    startTime: '09:00',
    endDate: '2026-10-13',
    endTime: '10:00',
    tzid: 'UTC',
    repeat: { kind: 'none', interval: 1, weekdays: [], monthlyMode: 'day', end: { kind: 'never' } },
  };

  it('turns an all-day draft into a one-hour event when a time is said', () => {
    const out = applyQuickText({ ...allDay }, parse('Lunch friday 1pm'));
    expect(out).toMatchObject({
      title: 'Lunch',
      allDay: false,
      startDate: '2026-11-06',
      startTime: '13:00',
      endDate: '2026-11-06',
      endTime: '14:00',
    });
  });

  it('only moves the day of an all-day draft when no time is said', () => {
    const out = applyQuickText({ ...allDay }, parse('Trip friday'));
    expect(out).toMatchObject({ allDay: true, startDate: '2026-11-06', endDate: '2026-11-06' });
  });

  it('keeps the length of a timed draft', () => {
    const out = applyQuickText({ ...allDay, allDay: false }, parse('Call 11am'));
    expect(out).toMatchObject({ startTime: '11:00', endTime: '12:00' });
  });
});

describe('explicit and relative dates', () => {
  it('reads a day and month in Arabic and English, with or without a year', () => {
    expect(parse('سفر 15 نوفمبر')).toMatchObject({ title: 'سفر', date: '2026-11-15' });
    expect(parse('Trip nov 15')).toMatchObject({ title: 'Trip', date: '2026-11-15' });
    expect(parse('عرض ٢٠ ديسمبر ٢٠٢٧')).toMatchObject({ date: '2027-12-20' });
    expect(parse('Party 3 March 2028')).toMatchObject({ date: '2028-03-03' });
  });

  it('puts a month that has already gone this year into next year', () => {
    expect(parse('ذكرى 2 مارس')).toMatchObject({ date: '2027-03-02' });
    expect(parse('اليوم نفسه 5 نوفمبر')).toMatchObject({ date: '2026-11-05' });
  });

  it('reads 15/11, 15/11/2026 and 2026-11-15', () => {
    expect(parse('موعد 15/11')).toMatchObject({ date: '2026-11-15' });
    expect(parse('موعد 15/11/2027')).toMatchObject({ date: '2027-11-15' });
    expect(parse('موعد 2026-12-01')).toMatchObject({ title: 'موعد', date: '2026-12-01' });
  });

  it('ignores a day that does not exist', () => {
    expect(parse('موعد 31/2')).toEqual({ title: 'موعد 31/2', understood: '' });
    expect(parse('موعد 30 فبراير')).toEqual({ title: 'موعد 30 فبراير', understood: '' });
  });

  it('keeps a date and a time apart', () => {
    expect(parse('اجتماع 15 نوفمبر 5 مساءً')).toMatchObject({
      title: 'اجتماع',
      date: '2026-11-15',
      time: '17:00',
    });
  });

  it('reads "next week" and "next <weekday>"', () => {
    expect(parse('مراجعة الأسبوع الجاي')).toMatchObject({ title: 'مراجعة', date: '2026-11-12' });
    expect(parse('Review next week')).toMatchObject({ date: '2026-11-12' });
    // Today is a Thursday: "الخميس" is today, "الخميس الجاي" and "next thursday" a week on.
    expect(parse('نادي الخميس')).toMatchObject({ date: '2026-11-05' });
    expect(parse('نادي الخميس الجاي')).toMatchObject({ title: 'نادي', date: '2026-11-12' });
    expect(parse('Gym next thursday')).toMatchObject({ title: 'Gym', date: '2026-11-12' });
    expect(parse('Gym next friday')).toMatchObject({ date: '2026-11-06' });
  });
});
