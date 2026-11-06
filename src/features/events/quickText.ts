import { addDays, compareDates, dateParts, isValidDate, weekdayOf } from '@/core/time';
import { withStart } from './draft';
import type { Draft } from './draft';
import type { IsoWeekday, PlainDate } from '@/core/time';

/** What a line of free text says about when an event is; anything it does not say is absent. */
export interface QuickText {
  /** The line without the words that named the day and time. */
  readonly title: string;
  readonly date?: PlainDate;
  /** "HH:MM", 24-hour. */
  readonly time?: string;
  /** The words that were understood, as typed, for showing back to the person. */
  readonly understood: string;
}

const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';
const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';

/** One word in a comparable form: Latin digits, no diacritics, one kind of alef, lower case. */
function norm(word: string): string {
  return word
    .replace(/[٠-٩]/g, (c) => String(ARABIC_DIGITS.indexOf(c)))
    .replace(/[۰-۹]/g, (c) => String(PERSIAN_DIGITS.indexOf(c)))
    .replace(/[ً-ٰٟـ]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/[،,.؛!؟?]+$/g, '')
    .toLowerCase();
}

const WEEKDAYS: Readonly<Record<string, IsoWeekday>> = {
  الاثنين: 1,
  الاتنين: 1,
  monday: 1,
  mon: 1,
  الثلاثاء: 2,
  التلات: 2,
  tuesday: 2,
  tue: 2,
  الاربعاء: 3,
  الاربع: 3,
  wednesday: 3,
  wed: 3,
  الخميس: 4,
  thursday: 4,
  thu: 4,
  الجمعه: 5,
  الجمعة: 5,
  friday: 5,
  fri: 5,
  السبت: 6,
  saturday: 6,
  sat: 6,
  الاحد: 7,
  sunday: 7,
  sun: 7,
};

const MONTHS: Readonly<Record<string, number>> = {
  يناير: 1,
  january: 1,
  jan: 1,
  فبراير: 2,
  february: 2,
  feb: 2,
  مارس: 3,
  march: 3,
  mar: 3,
  ابريل: 4,
  april: 4,
  apr: 4,
  مايو: 5,
  may: 5,
  يونيو: 6,
  june: 6,
  jun: 6,
  يوليو: 7,
  july: 7,
  jul: 7,
  اغسطس: 8,
  august: 8,
  aug: 8,
  سبتمبر: 9,
  september: 9,
  sep: 9,
  اكتوبر: 10,
  october: 10,
  oct: 10,
  نوفمبر: 11,
  november: 11,
  nov: 11,
  ديسمبر: 12,
  december: 12,
  dec: 12,
};

/** "next" after a weekday or "week": القادم، الجاي، المقبل. */
const NEXT = new Set(['القادم', 'القادمه', 'القادمة', 'الجاي', 'الجاى', 'المقبل', 'المقبله']);

const TODAY = new Set(['اليوم', 'النهارده', 'النهاردة', 'today']);
const TOMORROW = new Set(['بكره', 'بكرة', 'غدا', 'غدا', 'tomorrow']);

type Half = 'am' | 'pm' | 'noon';
const MARKERS: Readonly<Record<string, Half>> = {
  ص: 'am',
  صباحا: 'am',
  صباح: 'am',
  الصبح: 'am',
  فجرا: 'am',
  am: 'am',
  م: 'pm',
  مساء: 'pm',
  مساءا: 'pm',
  المغرب: 'pm',
  ليلا: 'pm',
  بالليل: 'pm',
  عصرا: 'pm',
  العصر: 'pm',
  pm: 'pm',
  الظهر: 'noon',
  ظهرا: 'noon',
};

const CLOCK = /^(\d{1,2})(?::(\d{2}))?(am|pm|ص|م)?$/;

function clock(hour: number, minute: number, half: Half | undefined): string | undefined {
  if (minute > 59) return undefined;
  let h = hour;
  if (half === undefined) {
    if (h > 23) return undefined;
  } else {
    if (h < 1 || h > 12) return undefined;
    if (half === 'am') h = h === 12 ? 0 : h;
    else if (half === 'pm') h = h === 12 ? 12 : h + 12;
    else h = h === 12 ? 12 : h < 6 ? h + 12 : h; // "5 الظهر" is not a thing; 1–5 reads as afternoon
  }
  return `${String(h).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

/** A real day from day, month and (optional) year; with no year, the next one not in the past. */
function civil(
  day: number,
  month: number,
  year: number | undefined,
  today: PlainDate,
): PlainDate | undefined {
  const pad = (v: number, w: number): string => String(v).padStart(w, '0');
  const make = (y: number): PlainDate | undefined => {
    const text = `${pad(y, 4)}-${pad(month, 2)}-${pad(day, 2)}`;
    return isValidDate(text) ? text : undefined;
  };
  if (year !== undefined) return make(year);
  const thisYear = dateParts(today).year;
  const first = make(thisYear);
  if (first !== undefined && compareDates(first, today) >= 0) return first;
  return make(thisYear + 1);
}

/**
 * Reads "اجتماع الخميس 5 مساءً" (or "Lunch tomorrow 1pm"): the first day word and the first clock
 * time, in Arabic (Egyptian and Gulf spellings) or English. A bare hour with no morning/evening
 * word ("الساعة 5") is NOT guessed: only 24-hour times ("17:00") and hours with a marker count.
 * Nothing is invented: if no day or time is found the line is returned as the title, untouched.
 */
export function parseQuickText(line: string, today: PlainDate): QuickText {
  const words = line
    .trim()
    .split(/\s+/)
    .filter((w) => w !== '');
  const used = new Array<boolean>(words.length).fill(false);
  const n = (i: number): string => norm(words[i] ?? '');
  let date: PlainDate | undefined;
  let time: string | undefined;

  for (let i = 0; i < words.length && date === undefined; i += 1) {
    const w = n(i);
    let next: PlainDate | undefined;
    let span = 1;
    const num = /^\d{1,2}$/;
    const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(w);
    const slash = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?$/.exec(w);
    const year = (j: number): number | undefined =>
      /^\d{4}$/.test(n(j)) ? Number(n(j)) : undefined;
    if (iso) next = civil(Number(iso[3]), Number(iso[2]), Number(iso[1]), today);
    else if (slash) {
      next = civil(
        Number(slash[1]),
        Number(slash[2]),
        slash[3] === undefined ? undefined : Number(slash[3]),
        today,
      );
    } else if (num.test(w) && MONTHS[n(i + 1)] !== undefined) {
      const y = year(i + 2);
      next = civil(Number(w), MONTHS[n(i + 1)] as number, y, today);
      span = y === undefined ? 2 : 3;
    } else if (MONTHS[w] !== undefined && num.test(n(i + 1))) {
      const y = year(i + 2);
      next = civil(Number(n(i + 1)), MONTHS[w] as number, y, today);
      span = y === undefined ? 2 : 3;
    } else if ((w === 'الاسبوع' && NEXT.has(n(i + 1))) || (w === 'next' && n(i + 1) === 'week')) {
      next = addDays(today, 7);
      span = 2;
    } else if (TODAY.has(w)) next = today;
    else if (TOMORROW.has(w)) next = addDays(today, 1);
    else if (w === 'بعد' && (n(i + 1) === 'بكره' || n(i + 1) === 'بكرة' || n(i + 1) === 'غد')) {
      next = addDays(today, 2);
      span = 2;
    } else if (WEEKDAYS[w] !== undefined) {
      const target = WEEKDAYS[w] as IsoWeekday;
      const ahead = (target - weekdayOf(today) + 7) % 7;
      const wantsNext = NEXT.has(n(i + 1)) || n(i - 1) === 'next';
      // "الخميس الجاي" / "next thursday" is never today: a full week on if it is the same day.
      next = addDays(today, wantsNext && ahead === 0 ? 7 : ahead);
      if (NEXT.has(n(i + 1))) span = 2;
      else if (n(i - 1) === 'next' && i > 0) used[i - 1] = true;
    }
    if (!next || !isValidDate(next)) continue;
    date = next;
    for (let k = 0; k < span; k += 1) used[i + k] = true;
    if (n(i - 1) === 'يوم' && i > 0) used[i - 1] = true;
  }

  for (let i = 0; i < words.length && time === undefined; i += 1) {
    if (used[i]) continue;
    const m = CLOCK.exec(n(i));
    if (!m) continue;
    const hour = Number(m[1]);
    const minute = Number(m[2] ?? 0);
    let half: Half | undefined = m[3] === undefined ? undefined : MARKERS[m[3]];
    let span = 1;
    const after = MARKERS[n(i + 1)];
    if (half === undefined && after !== undefined) {
      half = after;
      span = 2;
    }
    // Without a marker only an unmistakable 24-hour time counts ("17:00"); "9:30" or a bare "15"
    // (as in "15 chairs") would be a guess.
    if (half === undefined && !(m[2] !== undefined && hour >= 13)) continue;
    const parsed = clock(hour, minute, half);
    if (parsed === undefined) continue;
    time = parsed;
    for (let k = 0; k < span; k += 1) used[i + k] = true;
    if (n(i - 1) === 'الساعه' || n(i - 1) === 'الساعة') used[i - 1] = true;
  }

  const rest = words.filter((_, i) => !used[i]).join(' ');
  if (date === undefined && time === undefined) return { title: line.trim(), understood: '' };
  if (rest === '') return { title: line.trim(), understood: '' };
  const understood = words.filter((_, i) => used[i]).join(' ');
  return {
    title: rest,
    ...(date !== undefined && { date }),
    ...(time !== undefined && { time }),
    understood,
  };
}

/**
 * The draft with what the text said applied: the day moves it (same length), a time moves the
 * start; a time on an all-day draft makes it a one-hour event at that time on that day.
 */
export function applyQuickText(draft: Draft, said: QuickText): Draft {
  const titled: Draft = { ...draft, title: said.title.trim() };
  if (said.date === undefined && said.time === undefined) return titled;
  if (said.time !== undefined && draft.allDay) {
    const day = said.date ?? (isValidDate(draft.startDate) ? draft.startDate : undefined);
    if (day === undefined) return titled;
    const [h = 0, m = 0] = said.time.split(':').map(Number);
    const end = Math.min(h * 60 + m + 60, 23 * 60 + 59);
    const hh = String(Math.floor(end / 60)).padStart(2, '0');
    const mm = String(end % 60).padStart(2, '0');
    return {
      ...titled,
      allDay: false,
      startDate: day,
      startTime: said.time,
      endDate: day,
      endTime: `${hh}:${mm}`,
    };
  }
  return withStart(titled, {
    ...(said.date !== undefined && { startDate: said.date }),
    ...(said.time !== undefined && { startTime: said.time }),
  });
}
