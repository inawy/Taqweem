import { isTimeZone } from '@/core/time';
import type { IsoWeekday, Numerals } from '@/core/time';

// User settings: small, local, validated on the way in. A corrupt or foreign value in storage
// never breaks the app: each field falls back to its default on its own.

export type Locale = 'ar' | 'en';
export type ThemePreference = 'auto' | 'light' | 'dark';
/** The view the app opens on. `auto`: the Today list on a phone, the month elsewhere (D-025). */
export type DefaultView = 'auto' | 'agenda' | 'day' | 'days3' | 'week' | 'month' | 'year';
export const DEFAULT_VIEWS: readonly DefaultView[] = [
  'auto',
  'agenda',
  'day',
  'days3',
  'week',
  'month',
  'year',
];

/** Days the week view leaves out: none, Friday + Saturday, or Saturday + Sunday (D-120). */
export type WeekendHiding = 'none' | 'fri-sat' | 'sat-sun';
export const WEEKEND_HIDING: readonly WeekendHiding[] = ['none', 'fri-sat', 'sat-sun'];

/** Working hours shaded in the day and week views: `off`, or `start-end` in whole hours (D-127, D-129). */
export type WorkHours = string;

const WORK_HOURS_RE = /^(\d{1,2})-(\d{1,2})$/;

/** The shaded-outside range as whole hours (`0 ≤ start < end ≤ 24`), or undefined when off or invalid. */
export function workHoursRange(w: WorkHours): { start: number; end: number } | undefined {
  const m = WORK_HOURS_RE.exec(w);
  if (m === null) return undefined;
  const start = Number(m[1]);
  const end = Number(m[2]);
  return start < end && end <= 24 ? { start, end } : undefined;
}

/** The lengths offered for a new event, in minutes. */
export const DEFAULT_DURATIONS = [15, 30, 45, 60, 90, 120] as const;
export type DefaultDuration = (typeof DEFAULT_DURATIONS)[number];

/** Days the Hijri date is moved by, to follow the local moon-sighting announcement (D-150). */
export const HIJRI_ADJUSTS = [-2, -1, 0, 1, 2] as const;
export type HijriAdjust = (typeof HIJRI_ADJUSTS)[number];

export interface Settings {
  readonly locale: Locale;
  readonly theme: ThemePreference;
  readonly weekStart: IsoWeekday;
  readonly hour12: boolean;
  /** Show the Hijri date as a small secondary line (display only, D-016). */
  readonly hijri: boolean;
  /** Move every Hijri date shown by this many days; display only, never stored (D-150). */
  readonly hijriAdjust: HijriAdjust;
  /** Show ISO week numbers: a small number on each month row, and in the week view's title (D-133). */
  readonly weekNumbers: boolean;
  readonly numerals: Numerals;
  readonly defaultView: DefaultView;
  readonly hideWeekend: WeekendHiding;
  /** Which weekdays are tinted as the weekend (D-136); the same three choices. */
  readonly weekend: WeekendHiding;
  /** A second clock beside the hours of the day and week views: an IANA zone, or '' for none. */
  readonly secondZone: string;
  readonly workHours: WorkHours;
  /** How long a new timed event lasts, in minutes (D-134). */
  readonly defaultDuration: DefaultDuration;
}

export const SETTINGS_KEY = 'nawy-today:settings:v1';

/** Arabic-first: English only when the browser's first language is English. */
export function detectLocale(languages: readonly string[] | undefined): Locale {
  const first = languages?.[0]?.toLowerCase() ?? '';
  return first.startsWith('en') ? 'en' : 'ar';
}

export function defaultSettings(locale: Locale): Settings {
  return {
    locale,
    theme: 'auto',
    weekStart: locale === 'ar' ? 6 : 1, // D-016: Saturday for Arabic, Monday for English
    hour12: true,
    hijri: false,
    hijriAdjust: 0,
    weekNumbers: false,
    numerals: 'latn',
    defaultView: 'auto',
    hideWeekend: 'none',
    weekend: locale === 'ar' ? 'fri-sat' : 'sat-sun', // Friday–Saturday in the Arab region
    secondZone: '',
    workHours: 'off',
    defaultDuration: 60,
  };
}

const isOneOf = <T extends string>(value: unknown, allowed: readonly T[]): value is T =>
  typeof value === 'string' && (allowed as readonly string[]).includes(value);

export function parseSettings(raw: unknown, fallbackLocale: Locale): Settings {
  const o = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
  const locale = isOneOf(o['locale'], ['ar', 'en'] as const) ? o['locale'] : fallbackLocale;
  const d = defaultSettings(locale);
  const weekStart = o['weekStart'];
  return {
    locale,
    theme: isOneOf(o['theme'], ['auto', 'light', 'dark'] as const) ? o['theme'] : d.theme,
    weekStart:
      typeof weekStart === 'number' &&
      Number.isInteger(weekStart) &&
      weekStart >= 1 &&
      weekStart <= 7
        ? (weekStart as IsoWeekday)
        : d.weekStart,
    hour12: typeof o['hour12'] === 'boolean' ? o['hour12'] : d.hour12,
    hijri: typeof o['hijri'] === 'boolean' ? o['hijri'] : d.hijri,
    hijriAdjust: HIJRI_ADJUSTS.find((v) => v === o['hijriAdjust']) ?? d.hijriAdjust,
    weekNumbers: typeof o['weekNumbers'] === 'boolean' ? o['weekNumbers'] : d.weekNumbers,
    numerals: isOneOf(o['numerals'], ['latn', 'arab'] as const) ? o['numerals'] : d.numerals,
    defaultView: isOneOf(o['defaultView'], DEFAULT_VIEWS) ? o['defaultView'] : d.defaultView,
    hideWeekend: isOneOf(o['hideWeekend'], WEEKEND_HIDING) ? o['hideWeekend'] : d.hideWeekend,
    weekend: isOneOf(o['weekend'], WEEKEND_HIDING) ? o['weekend'] : d.weekend,
    secondZone:
      typeof o['secondZone'] === 'string' && (o['secondZone'] === '' || isTimeZone(o['secondZone']))
        ? o['secondZone']
        : d.secondZone,
    defaultDuration: DEFAULT_DURATIONS.find((m) => m === o['defaultDuration']) ?? d.defaultDuration,
    workHours:
      typeof o['workHours'] === 'string' &&
      (o['workHours'] === 'off' || workHoursRange(o['workHours']) !== undefined)
        ? o['workHours']
        : d.workHours,
  };
}

export interface ReadableStorage {
  getItem(key: string): string | null;
}
export interface WritableStorage {
  setItem(key: string, value: string): void;
}

export function loadSettings(
  storage: ReadableStorage | undefined,
  languages: readonly string[] | undefined,
): Settings {
  const fallback = detectLocale(languages);
  try {
    const text = storage?.getItem(SETTINGS_KEY);
    return parseSettings(text ? JSON.parse(text) : undefined, fallback);
  } catch {
    return defaultSettings(fallback);
  }
}

/** `false` when the browser refuses (private mode, quota): the caller can say so honestly. */
export function saveSettings(storage: WritableStorage | undefined, settings: Settings): boolean {
  try {
    storage?.setItem(SETTINGS_KEY, JSON.stringify(settings));
    return storage !== undefined;
  } catch {
    return false;
  }
}

/** Direction, language and theme on the document element. */
export function applyToDocument(root: HTMLElement, settings: Settings): void {
  root.lang = settings.locale;
  root.dir = settings.locale === 'ar' ? 'rtl' : 'ltr';
  if (settings.theme === 'auto') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', settings.theme);
  syncThemeColor(root, settings.theme);
}

/**
 * The browser's status bar colour. The page ships a light and a dark `theme-color` meta, each
 * limited to the OS scheme. An explicit theme makes the matching one apply regardless of the OS
 * and switches the other off; `auto` restores the OS-scheme behaviour.
 */
function syncThemeColor(root: HTMLElement, theme: Settings['theme']): void {
  for (const meta of root.ownerDocument.querySelectorAll<HTMLMetaElement>(
    'meta[name="theme-color"][data-scheme]',
  )) {
    const own = meta.dataset['scheme'];
    meta.dataset['media'] ??= meta.getAttribute('media') ?? 'all';
    if (theme === 'auto') meta.setAttribute('media', meta.dataset['media']);
    else meta.setAttribute('media', own === theme ? 'all' : 'not all');
  }
}
