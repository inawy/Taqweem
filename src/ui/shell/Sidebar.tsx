import type { Calendar } from '@/core/model';
import { useT } from '@/features/i18n';
import { useSettings } from '@/features/settings';
import { calendarColorVars } from '@/ui/theme/calendarColor';
import type { FormatOptions, PlainDate } from '@/core/time';
import { EditIcon, PlusIcon } from './Icons';
import { MiniMonth } from './MiniMonth';

export interface SidebarProps {
  readonly calendars: readonly Calendar[];
  readonly onToggleCalendar: (id: string, visible: boolean) => void;
  /** Present only when the browser can install the app right now. */
  readonly onInstall?: (() => void) | undefined;
  readonly onOpenSettings?: (() => void) | undefined;
  readonly onOpenData?: (() => void) | undefined;
  readonly onOpenShortcuts?: (() => void) | undefined;
  readonly onOpenAbout?: (() => void) | undefined;
  /** Lets the person jump to a date from a small month. */
  readonly mini?:
    | {
        readonly anchor: PlainDate;
        readonly today: PlainDate;
        readonly fmt: FormatOptions;
        readonly onPick: (date: PlainDate) => void;
      }
    | undefined;
  readonly onNewCalendar?: (() => void) | undefined;
  readonly onEditCalendar?: ((id: string) => void) | undefined;
  /** Steps for this platform, shown when no install button is possible and the app is not installed yet. */
  readonly installHelp?: 'ios' | 'android' | 'desktop' | null | undefined;
}

export function Sidebar({
  calendars,
  onToggleCalendar,
  onInstall,
  onOpenSettings,
  onOpenData,
  onOpenShortcuts,
  onOpenAbout,
  mini,
  onNewCalendar,
  onEditCalendar,
  installHelp,
}: SidebarProps) {
  const t = useT();
  const { settings } = useSettings();

  return (
    <div className="sidebar-body">
      {mini && <MiniMonth {...mini} weekStart={settings.weekStart} weekend={settings.weekend} />}
      <section aria-labelledby="calendars-heading">
        <h2 id="calendars-heading" className="sidebar-heading">
          {t('calendars')}
        </h2>
        {calendars.length === 0 ? (
          <p className="muted">{t('noCalendars')}</p>
        ) : (
          <ul className="calendar-list">
            {calendars.map((c) => (
              <li key={c.id}>
                <label className="calendar-row">
                  <input
                    type="checkbox"
                    checked={c.visible}
                    onChange={(e) => onToggleCalendar(c.id, e.currentTarget.checked)}
                  />
                  <span
                    className="calendar-dot"
                    style={{ background: calendarColorVars(c.color).bar }}
                    aria-hidden="true"
                  />
                  <span className="calendar-name">{c.name}</span>
                </label>
                {onEditCalendar && (
                  <button
                    type="button"
                    className="icon-btn calendar-edit"
                    aria-label={t('calendarEditNamed', { name: c.name })}
                    onClick={() => onEditCalendar(c.id)}
                  >
                    <EditIcon />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        {onNewCalendar && (
          <button type="button" className="btn calendar-add" onClick={onNewCalendar}>
            <PlusIcon /> {t('calendarAdd')}
          </button>
        )}
      </section>

      <section className="sidebar-settings">
        {onOpenSettings && (
          <button type="button" className="btn" onClick={onOpenSettings}>
            {t('settings')}
          </button>
        )}
        {onOpenData && (
          <button type="button" className="btn" onClick={onOpenData}>
            {t('dataTitle')}
          </button>
        )}
        {onOpenShortcuts && (
          <button type="button" className="btn shortcuts-btn" onClick={onOpenShortcuts}>
            {t('shortcutsOpen')}
          </button>
        )}
        {onOpenAbout && (
          <button type="button" className="btn" onClick={onOpenAbout}>
            {t('aboutOpen')}
          </button>
        )}
        {onInstall && (
          <button type="button" className="btn" onClick={onInstall}>
            {t('installApp')}
          </button>
        )}
        {!onInstall && installHelp && (
          <details className="install-help">
            <summary>{t('installHow')}</summary>
            <p>
              {t(
                installHelp === 'ios'
                  ? 'installIos'
                  : installHelp === 'android'
                    ? 'installAndroid'
                    : 'installDesktop',
              )}
            </p>
          </details>
        )}
      </section>
    </div>
  );
}
