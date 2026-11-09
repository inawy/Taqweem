export {
  DEFAULT_VIEWS,
  SETTINGS_KEY,
  WEEKEND_HIDING,
  WORK_HOURS,
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
  WeekendHiding,
  WorkHours,
  WritableStorage,
} from './settings';
export { SettingsProvider, useSettings } from './SettingsContext';
