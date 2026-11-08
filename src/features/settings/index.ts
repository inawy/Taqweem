export {
  DEFAULT_VIEWS,
  SETTINGS_KEY,
  WEEKEND_HIDING,
  applyToDocument,
  defaultSettings,
  detectLocale,
  loadSettings,
  parseSettings,
  saveSettings,
} from './settings';
export type {
  DefaultView,
  Locale,
  ReadableStorage,
  Settings,
  ThemePreference,
  WeekendHiding,
  WritableStorage,
} from './settings';
export { SettingsProvider, useSettings } from './SettingsContext';
