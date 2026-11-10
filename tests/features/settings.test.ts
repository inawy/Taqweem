import { describe, expect, it } from 'vitest';
import {
  SETTINGS_KEY,
  applyToDocument,
  defaultSettings,
  detectLocale,
  loadSettings,
  parseSettings,
  workHoursRange,
  saveSettings,
} from '@/features/settings';

describe('detectLocale', () => {
  it('is Arabic unless the first browser language is English', () => {
    expect(detectLocale(['ar-EG', 'en'])).toBe('ar');
    expect(detectLocale(['en-US', 'ar'])).toBe('en');
    expect(detectLocale(['fr'])).toBe('ar');
    expect(detectLocale([])).toBe('ar');
    expect(detectLocale(undefined)).toBe('ar');
  });
});

describe('defaults (D-016)', () => {
  it('Saturday for Arabic, Monday for English', () => {
    expect(defaultSettings('ar').weekStart).toBe(6);
    expect(defaultSettings('en').weekStart).toBe(1);
  });

  it('opt-in extras are off', () => {
    expect(defaultSettings('ar')).toMatchObject({ hijri: false, numerals: 'latn', theme: 'auto' });
  });
});

describe('parseSettings is lenient field by field', () => {
  it('keeps valid values', () => {
    const s = {
      locale: 'en',
      theme: 'dark',
      weekStart: 7,
      hour12: false,
      hijri: true,
      weekNumbers: true,
      numerals: 'arab',
      defaultView: 'week',
      hideWeekend: 'fri-sat',
      secondZone: 'Africa/Cairo',
      workHours: '9-17',
    };
    expect(parseSettings(s, 'ar')).toEqual(s);
  });

  it('replaces only the broken fields', () => {
    const got = parseSettings({ locale: 'en', theme: 'purple', weekStart: 9, hour12: 'yes' }, 'ar');
    expect(got.locale).toBe('en');
    expect(got.theme).toBe('auto');
    expect(got.weekStart).toBe(1); // English default, not the fallback locale's
    expect(got.hour12).toBe(true);
  });

  it.each([null, undefined, 'x', 42, [], {}])('survives %j', (raw) => {
    expect(parseSettings(raw, 'ar')).toEqual(defaultSettings('ar'));
  });

  it('opens on the automatic view unless a known one was chosen', () => {
    expect(defaultSettings('ar').defaultView).toBe('auto');
    expect(parseSettings({ defaultView: 'days3' }, 'ar').defaultView).toBe('days3');
    expect(parseSettings({ defaultView: 'year' }, 'ar').defaultView).toBe('year');
    expect(parseSettings({ defaultView: 'decade' }, 'ar').defaultView).toBe('auto');
    expect(parseSettings({ defaultView: 7 }, 'ar').defaultView).toBe('auto');
  });

  it('rejects fractional and out-of-range week starts', () => {
    expect(parseSettings({ weekStart: 1.5 }, 'ar').weekStart).toBe(6);
    expect(parseSettings({ weekStart: 0 }, 'ar').weekStart).toBe(6);
  });
});

describe('loadSettings / saveSettings', () => {
  const memory = () => {
    const m = new Map<string, string>();
    return {
      getItem: (k: string) => m.get(k) ?? null,
      setItem: (k: string, v: string) => void m.set(k, v),
    };
  };

  it('round-trips', () => {
    const storage = memory();
    const s = { ...defaultSettings('ar'), theme: 'dark' as const };
    expect(saveSettings(storage, s)).toBe(true);
    expect(loadSettings(storage, ['ar'])).toEqual(s);
  });

  it('falls back to defaults for corrupt JSON, missing storage, or a throwing storage', () => {
    const corrupt = memory();
    corrupt.setItem(SETTINGS_KEY, '{not json');
    expect(loadSettings(corrupt, ['en'])).toEqual(defaultSettings('en'));
    expect(loadSettings(undefined, ['ar'])).toEqual(defaultSettings('ar'));
    const throwing = {
      getItem: () => {
        throw new Error('blocked');
      },
    };
    expect(loadSettings(throwing, ['ar'])).toEqual(defaultSettings('ar'));
  });

  it('reports a refused write instead of pretending it was saved', () => {
    const refusing = {
      setItem: () => {
        throw new Error('quota');
      },
    };
    expect(saveSettings(refusing, defaultSettings('ar'))).toBe(false);
    expect(saveSettings(undefined, defaultSettings('ar'))).toBe(false);
  });
});

describe('applyToDocument', () => {
  it('sets language and direction', () => {
    const root = document.createElement('html');
    applyToDocument(root, defaultSettings('ar'));
    expect([root.lang, root.dir]).toEqual(['ar', 'rtl']);
    applyToDocument(root, defaultSettings('en'));
    expect([root.lang, root.dir]).toEqual(['en', 'ltr']);
  });

  it('sets data-theme only for an explicit theme', () => {
    const root = document.createElement('html');
    applyToDocument(root, { ...defaultSettings('ar'), theme: 'dark' });
    expect(root.getAttribute('data-theme')).toBe('dark');
    applyToDocument(root, { ...defaultSettings('ar'), theme: 'auto' });
    expect(root.hasAttribute('data-theme')).toBe(false);
  });

  it('points the status bar colour at the chosen theme, and back to the OS scheme for auto', () => {
    const doc = document.implementation.createHTMLDocument('t');
    for (const scheme of ['light', 'dark']) {
      const meta = doc.createElement('meta');
      meta.name = 'theme-color';
      meta.setAttribute('media', `(prefers-color-scheme: ${scheme})`);
      meta.dataset['scheme'] = scheme;
      doc.head.append(meta);
    }
    const media = (): string[] =>
      [...doc.querySelectorAll('meta')].map((m) => m.getAttribute('media') ?? '');
    applyToDocument(doc.documentElement, { ...defaultSettings('ar'), theme: 'dark' });
    expect(media()).toEqual(['not all', 'all']);
    applyToDocument(doc.documentElement, { ...defaultSettings('ar'), theme: 'light' });
    expect(media()).toEqual(['all', 'not all']);
    applyToDocument(doc.documentElement, { ...defaultSettings('ar'), theme: 'auto' });
    expect(media()).toEqual(['(prefers-color-scheme: light)', '(prefers-color-scheme: dark)']);
  });
});

describe('hideWeekend (D-120)', () => {
  it('shows every day by default and accepts only the three choices', () => {
    expect(defaultSettings('ar').hideWeekend).toBe('none');
    expect(parseSettings({ hideWeekend: 'fri-sat' }, 'ar').hideWeekend).toBe('fri-sat');
    expect(parseSettings({ hideWeekend: 'sat-sun' }, 'en').hideWeekend).toBe('sat-sun');
    expect(parseSettings({ hideWeekend: 'thu-fri' }, 'ar').hideWeekend).toBe('none');
    expect(parseSettings({ hideWeekend: true }, 'ar').hideWeekend).toBe('none');
  });
});

describe('secondZone (D-122)', () => {
  it('is off by default and accepts only a real zone', () => {
    expect(defaultSettings('ar').secondZone).toBe('');
    expect(parseSettings({ secondZone: 'Europe/London' }, 'ar').secondZone).toBe('Europe/London');
    expect(parseSettings({ secondZone: 'Mars/Olympus' }, 'ar').secondZone).toBe('');
    expect(parseSettings({ secondZone: 5 }, 'ar').secondZone).toBe('');
    expect(parseSettings({ secondZone: '' }, 'ar').secondZone).toBe('');
  });
});

describe('weekNumbers (D-133)', () => {
  it('is off by default and only a real boolean turns it on', () => {
    expect(defaultSettings('ar').weekNumbers).toBe(false);
    expect(parseSettings({ weekNumbers: true }, 'ar').weekNumbers).toBe(true);
    expect(parseSettings({ weekNumbers: 'yes' }, 'ar').weekNumbers).toBe(false);
  });
});

describe('workHours (D-127)', () => {
  it('is off by default and accepts a range of whole hours, start before end', () => {
    expect(defaultSettings('ar').workHours).toBe('off');
    expect(parseSettings({ workHours: '9-17' }, 'ar').workHours).toBe('9-17');
    expect(parseSettings({ workHours: '6-14' }, 'ar').workHours).toBe('6-14');
    expect(parseSettings({ workHours: '0-24' }, 'ar').workHours).toBe('0-24');
    for (const bad of ['9-25', '17-9', '9-9', '-', 'x', '9-17-1', '']) {
      expect(parseSettings({ workHours: bad }, 'ar').workHours).toBe('off');
    }
    expect(parseSettings({ workHours: 9 }, 'ar').workHours).toBe('off');
  });
  it('turns a range into whole hours, or nothing when off', () => {
    expect(workHoursRange('off')).toBeUndefined();
    expect(workHoursRange('8-16')).toEqual({ start: 8, end: 16 });
    expect(workHoursRange('0-24')).toEqual({ start: 0, end: 24 });
    expect(workHoursRange('17-9')).toBeUndefined();
  });
});
