import { useEffect, useId, useRef } from 'react';
import type { KeyboardEvent } from 'react';
import type { IsoWeekday, Numerals } from '@/core/time';
import { useT } from '@/features/i18n';
import type { MessageKey } from '@/features/i18n';
import { SECOND_ZONES, zoneName } from '@/features/timegrid';
import {
  DEFAULT_DURATIONS,
  DEFAULT_VIEWS,
  WEEKEND_HIDING,
  useSettings,
  workHoursRange,
} from '@/features/settings';
import type {
  DefaultDuration,
  DefaultView,
  Locale,
  ThemePreference,
  WeekendHiding,
} from '@/features/settings';
import { trapTab } from '@/lib/focusTrap';
import { CloseIcon } from '@/ui/shell/Icons';
import { useRestoreFocus } from '@/ui/shell/useRestoreFocus';
import { useSwipeClose } from '@/ui/shell/useSwipeClose';

export interface SettingsDialogProps {
  readonly onClose: () => void;
}

const VIEW_LABELS: Record<DefaultView, MessageKey> = {
  auto: 'defaultViewAuto',
  agenda: 'viewAgenda',
  day: 'viewDay',
  days3: 'viewDays3',
  week: 'viewWeek',
  month: 'viewMonth',
  year: 'viewYear',
};

const WEEKEND_LABELS: Record<WeekendHiding, MessageKey> = {
  none: 'hideWeekendNone',
  'fri-sat': 'hideWeekendFriSat',
  'sat-sun': 'hideWeekendSatSun',
};

/** "30 minutes", "1.5 hours": the platform's own unit names in the page's language and numerals. */
function durationText(minutes: number, locale: string, numerals: string): string {
  const long = minutes >= 60;
  return new Intl.NumberFormat(locale, {
    style: 'unit',
    unit: long ? 'hour' : 'minute',
    unitDisplay: 'long',
    numberingSystem: numerals,
  }).format(long ? minutes / 60 : minutes);
}

const hourText = (h: number): string => `${String(h).padStart(2, '0')}:00`;
const range = (from: number, to: number): number[] =>
  Array.from({ length: to - from + 1 }, (_, i) => from + i);

const THEMES: readonly [ThemePreference, MessageKey][] = [
  ['auto', 'themeAuto'],
  ['light', 'themeLight'],
  ['dark', 'themeDark'],
];

/**
 * Language, theme, week start, opening view, time format, numerals and the Hijri date. They used to
 * be six full-width boxes at the bottom of the side panel; the panel now keeps only the month and
 * the calendars, and these live here (D-095). Each change applies and is saved at once.
 */
export function SettingsDialog({ onClose }: SettingsDialogProps) {
  const t = useT();
  const { settings, update, persisted } = useSettings();
  const work = workHoursRange(settings.workHours);
  useRestoreFocus();
  const titleId = useId();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.focus();
  }, []);
  const swipe = useSwipeClose('sheet', onClose);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.code === 'Escape') {
      event.stopPropagation();
      onClose();
      return;
    }
    if (ref.current) trapTab(ref.current, event.nativeEvent);
  };

  return (
    <div className="modal-backdrop">
      <div
        ref={ref}
        className="modal settings-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        {...swipe}
      >
        <header className="ed-head sheet-grip">
          <h2 id={titleId}>{t('settings')}</h2>
          <button type="button" className="icon-btn" aria-label={t('close')} onClick={onClose}>
            <CloseIcon />
          </button>
        </header>
        <div className="ed-body">
          <label className="field">
            <span>{t('language')}</span>
            <select
              value={settings.locale}
              onChange={(e) => {
                const locale = e.currentTarget.value as Locale;
                // Week start follows the language until the user has a setting of their own for it.
                update({ locale, weekStart: locale === 'ar' ? 6 : 1 });
              }}
            >
              <option value="ar">العربية</option>
              <option value="en">English</option>
            </select>
          </label>
          <label className="field">
            <span>{t('theme')}</span>
            <select
              value={settings.theme}
              onChange={(e) => update({ theme: e.currentTarget.value as ThemePreference })}
            >
              {THEMES.map(([value, key]) => (
                <option key={value} value={value}>
                  {t(key)}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>{t('weekStartLabel')}</span>
            <select
              value={settings.weekStart}
              onChange={(e) => update({ weekStart: Number(e.currentTarget.value) as IsoWeekday })}
            >
              <option value={6}>{t('daySaturday')}</option>
              <option value={7}>{t('daySunday')}</option>
              <option value={1}>{t('dayMonday')}</option>
            </select>
          </label>
          <label className="field">
            <span>{t('defaultViewLabel')}</span>
            <select
              value={settings.defaultView}
              onChange={(e) => update({ defaultView: e.currentTarget.value as DefaultView })}
            >
              {DEFAULT_VIEWS.map((value) => (
                <option key={value} value={value}>
                  {t(VIEW_LABELS[value])}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>{t('hideWeekendLabel')}</span>
            <select
              value={settings.hideWeekend}
              onChange={(e) => update({ hideWeekend: e.currentTarget.value as WeekendHiding })}
            >
              {WEEKEND_HIDING.map((value) => (
                <option key={value} value={value}>
                  {t(WEEKEND_LABELS[value])}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>{t('weekendLabel')}</span>
            <select
              value={settings.weekend}
              onChange={(e) => update({ weekend: e.currentTarget.value as WeekendHiding })}
            >
              {WEEKEND_HIDING.map((value) => (
                <option key={value} value={value}>
                  {value === 'none' ? t('weekendNone') : t(WEEKEND_LABELS[value])}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>{t('secondZoneLabel')}</span>
            <select
              value={settings.secondZone}
              onChange={(e) => update({ secondZone: e.currentTarget.value })}
            >
              <option value="">{t('secondZoneNone')}</option>
              {[...new Set([settings.secondZone, ...SECOND_ZONES])]
                .filter((zone) => zone !== '')
                .map((zone) => (
                  <option key={zone} value={zone}>
                    {zoneName(zone)}
                  </option>
                ))}
            </select>
          </label>
          <label className="field">
            <span>{t('defaultDurationLabel')}</span>
            <select
              value={settings.defaultDuration}
              onChange={(e) =>
                update({ defaultDuration: Number(e.currentTarget.value) as DefaultDuration })
              }
            >
              {DEFAULT_DURATIONS.map((m) => (
                <option key={m} value={m}>
                  {durationText(m, settings.locale, settings.numerals)}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>{t('workHoursLabel')}</span>
            <select
              value={work ? String(work.start) : 'off'}
              onChange={(e) => {
                const v = e.currentTarget.value;
                const start = Number(v);
                if (v === 'off') {
                  update({ workHours: 'off' });
                } else {
                  const end = work && work.end > start ? work.end : Math.min(24, start + 8);
                  update({ workHours: `${start}-${end}` });
                }
              }}
            >
              <option value="off">{t('workHoursOff')}</option>
              {range(0, 23).map((h) => (
                <option key={h} value={h}>
                  {hourText(h)}
                </option>
              ))}
            </select>
          </label>
          {work && (
            <label className="field">
              <span>{t('workHoursTo')}</span>
              <select
                value={work.end}
                onChange={(e) => update({ workHours: `${work.start}-${e.currentTarget.value}` })}
              >
                {range(work.start + 1, 24).map((h) => (
                  <option key={h} value={h}>
                    {hourText(h)}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="field">
            <span>{t('timeFormat')}</span>
            <select
              value={settings.hour12 ? '12' : '24'}
              onChange={(e) => update({ hour12: e.currentTarget.value === '12' })}
            >
              <option value="12">{t('time12')}</option>
              <option value="24">{t('time24')}</option>
            </select>
          </label>
          <label className="field">
            <span>{t('numeralsLabel')}</span>
            <select
              value={settings.numerals}
              onChange={(e) => update({ numerals: e.currentTarget.value as Numerals })}
            >
              <option value="latn">{t('numeralsLatin')}</option>
              <option value="arab">{t('numeralsArabic')}</option>
            </select>
          </label>
          <label className="ed-check">
            <input
              type="checkbox"
              checked={settings.hijri}
              onChange={(e) => update({ hijri: e.currentTarget.checked })}
            />
            <span>{t('hijriLabel')}</span>
          </label>
          <label className="ed-check">
            <input
              type="checkbox"
              checked={settings.weekNumbers}
              onChange={(e) => update({ weekNumbers: e.currentTarget.checked })}
            />
            <span>{t('weekNumbersLabel')}</span>
          </label>
          {!persisted && (
            <p role="status" className="muted">
              {t('notSaved')}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
