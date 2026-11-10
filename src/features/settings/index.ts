export {
  DEFAULT_VIEWS,
  SETTINGS_KEY,
  DEFAULT_DURATIONS,
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
  DefaultView,
  Locale,
  ReadableStorage,
  Settings,
  ThemePreference,
  DefaultDuration,
  WeekendHiding,
  WorkHours,
  WritableStorage,
} from './settings';
export { SettingsProvider, useSettings } from './SettingsContext';
