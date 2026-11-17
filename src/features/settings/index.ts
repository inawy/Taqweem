export {
  DEFAULT_VIEWS,
  SETTINGS_KEY,
  DEFAULT_DURATIONS,
  DEFAULT_REMINDERS,
  HIJRI_ADJUSTS,
  WEEKEND_HIDING,
  applyToDocument,
  defaultSettings,
  detectLocale,
  loadSettings,
  parseSettings,
  saveSettings,
  workHoursRange,
} from './settings';
export type {
  HijriAdjust,
  DefaultView,
  Locale,
  ReadableStorage,
  Settings,
  ThemePreference,
  DefaultDuration,
  DefaultReminder,
  WeekendHiding,
  WorkHours,
  WritableStorage,
} from './settings';
export { SettingsProvider, useSettings } from './SettingsContext';
