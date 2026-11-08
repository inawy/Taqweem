import { useEffect, useId, useRef } from 'react';
import type { KeyboardEvent } from 'react';
import type { IsoWeekday, Numerals } from '@/core/time';
import { useT } from '@/features/i18n';
import type { MessageKey } from '@/features/i18n';
import { DEFAULT_VIEWS, WEEKEND_HIDING, useSettings } from '@/features/settings';
import type { DefaultView, Locale, ThemePreference, WeekendHiding } from '@/features/settings';
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
