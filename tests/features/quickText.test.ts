import { describe, expect, it } from 'vitest';
import { parseQuickText } from '@/features/events';
import type { PlainDate } from '@/core/time';

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
