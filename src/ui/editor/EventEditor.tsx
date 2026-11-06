import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import type { Calendar } from '@/core/model';
import { isValidDate, localTimeZone } from '@/core/time';
import type { FormatOptions, IsoWeekday, PlainDate } from '@/core/time';
import {
  applyQuickText,
  draftToFields,
  isDirty,
  parseQuickText,
  withStart,
} from '@/features/events';
import type { Draft, DraftError } from '@/features/events';
import { useT } from '@/features/i18n';
import type { MessageKey } from '@/features/i18n';
import { trapTab } from '@/lib/focusTrap';
import { useRestoreFocus } from '@/ui/shell/useRestoreFocus';
import { useSwipeClose } from '@/ui/shell/useSwipeClose';
import { useVisualViewport } from '@/lib/useVisualViewport';
import { CloseIcon } from '@/ui/shell/Icons';
import { RepeatFields } from './RepeatFields';
import { islamicOccasion } from '@/features/view';

/** What the owner of the editor reports back after trying to save. */
export type SaveOutcome = { ok: true } | { ok: false; message: MessageKey | null };

export interface EventEditorProps {
  readonly mode: 'new' | 'edit';
  readonly initial: Draft;
  readonly calendars: readonly Calendar[];
  readonly fmt: FormatOptions;
  readonly weekStart: IsoWeekday;
  /** Today: with it, a new event offers to read a day and time out of its title (D-110). */
  readonly today?: PlainDate | undefined;
  /** Called with a draft that already passed `draftToFields`. `null` message = user cancelled. */
  readonly onSave: (draft: Draft) => Promise<SaveOutcome>;
  readonly onDelete?: (() => void) | undefined;
  readonly onClose: () => void;
  /**
   * Hands the owner the editor's own "close and save" so the Back button can use it. Resolves
   * true when the editor closed, false when it stays open (nothing to save is a close).
   */
  readonly registerClose?: ((close: (() => Promise<boolean>) | null) => void) | undefined;
}

const ERROR_KEY: Record<DraftError, MessageKey> = {
  calendar: 'errCalendar',
  start: 'errStart',
  end: 'errEnd',
  order: 'errOrder',
  timezone: 'errTimezone',
  'title-too-long': 'errTitleLong',
  'repeat-interval': 'errInterval',
  'repeat-count': 'errCount',
  'repeat-until': 'errUntil',
};

let allZones: string[] | null = null;

/** Every zone the browser knows, read once (it is a long list, ~420 names). */
function knownTimeZones(): string[] {
  if (allZones) return allZones;
  const all = (Intl as unknown as { supportedValuesOf?: (key: string) => string[] })
    .supportedValuesOf;
  try {
    allZones = all ? all('timeZone') : [];
  } catch {
    allZones = [];
  }
  return allZones;
}

/**
 * The zones to offer. `full = false` is only the few that matter at first (the event's own, the
 * device's, UTC) so opening the editor does not build ~420 `<option>`s before the first paint.
 */
export function timeZoneOptions(current: string, full: boolean): string[] {
  const first = [current, localTimeZone(), 'UTC'];
  return [...new Set(full ? [...first, ...knownTimeZones()] : first)];
}

/**
 * The full editor. Closing it (Escape, the close button, the backdrop) SAVES when something
 * changed and the values are valid; if saving is not possible it stays open with the reason and
 * the draft intact, and "discard" is the explicit way out. Nothing typed is ever dropped silently.
 */
export function EventEditor({
  mode,
  initial,
  calendars,
  fmt,
  weekStart,
  today,
  onSave,
  onDelete,
  onClose,
  registerClose,
}: EventEditorProps) {
  const t = useT();
  useRestoreFocus();
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<Draft>(initial);
  const [error, setError] = useState<MessageKey | null>(null);
  const [busy, setBusy] = useState(false);
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const busyRef = useRef(false);

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  // The long zone list is added after the first paint, or as soon as the person reaches the select.
  const [fullZones, setFullZones] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setFullZones(true), 120);
    return () => window.clearTimeout(id);
  }, []);
  const zones = useMemo(() => timeZoneOptions(initial.tzid, fullZones), [initial.tzid, fullZones]);
  // A new event whose title says "الخميس 5 مساءً" offers to apply it, one tap, never by itself:
  // the person is already looking at the date and time fields (D-110).
  const read =
    mode === 'new' && today !== undefined ? parseQuickText(draft.title, today) : undefined;
  const said = read && read.understood !== '' ? read : undefined;

  // A new event on a day that is an Islamic occasion offers to become that occasion every year (D-112).
  const occasion =
    mode === 'new' && draft.repeat.kind === 'none' && isValidDate(draft.startDate)
      ? islamicOccasion(draft.startDate)
      : undefined;

  const set = <K extends keyof Draft>(key: K, value: Draft[K]): void => {
    setError(null);
    setDraft((d) => ({ ...d, [key]: value }));
  };

  /** Validates and saves; resolves true when the editor may close. */
  const commit = useCallback(async (): Promise<boolean> => {
    if (busyRef.current) return false;
    const current = draftRef.current;
    const fields = draftToFields(current);
    if (!fields.ok) {
      setError(ERROR_KEY[fields.error]);
      return false;
    }
    busyRef.current = true;
    setBusy(true);
    try {
      const outcome = await onSave(current);
      if (outcome.ok) return true;
      setError(outcome.message);
      return false;
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [onSave]);

  const requestClose = useCallback(async (): Promise<boolean> => {
    if (!isDirty(initial, draftRef.current)) {
      onClose();
      return true;
    }
    if (await commit()) {
      onClose();
      return true;
    }
    return false;
  }, [commit, initial, onClose]);

  // Thrown from its header it closes by the same way as Escape: it saves when something changed and
  // is valid, and stays open with the reason when it cannot (D-103). No glide: it may stay.
  const swipe = useSwipeClose('sheet', () => void requestClose(), !busy, {
    gripOnly: true,
    glide: false,
  });

  useVisualViewport();
  useEffect(() => {
    registerClose?.(requestClose);
    return () => registerClose?.(null);
  }, [registerClose, requestClose]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.code === 'Escape') {
      event.stopPropagation();
      void requestClose();
      return;
    }
    if (dialogRef.current) trapTab(dialogRef.current, event.nativeEvent);
  };

  const submit = async (): Promise<void> => {
    if (await commit()) onClose();
  };

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => e.target === e.currentTarget && void requestClose()}
    >
      <div
        ref={dialogRef}
        className="modal ed"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={onKeyDown}
        {...swipe}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <header className="ed-head sheet-grip">
            <h2 id={titleId}>{mode === 'new' ? t('newEvent') : t('editEvent')}</h2>
            <button
              type="button"
              className="icon-btn"
              aria-label={t('close')}
              onClick={() => void requestClose()}
            >
              <CloseIcon />
            </button>
          </header>

          <div className="ed-body">
            <input
              ref={titleRef}
              className="ed-title"
              aria-label={t('eventTitle')}
              placeholder={t('eventTitlePlaceholder')}
              value={draft.title}
              onChange={(e) => set('title', e.target.value)}
            />

            {said && (
              <button
                type="button"
                className="btn ed-suggest"
                onClick={() => {
                  setDraft((d) => applyQuickText(d, said));
                  titleRef.current?.focus();
                }}
              >
                {t('quickApply')} «{said.understood}»
              </button>
            )}

            {occasion && (
              <button
                type="button"
                className="btn ed-suggest"
                onClick={() =>
                  setDraft((d) => ({
                    ...d,
                    title: d.title.trim() === '' ? t(occasion) : d.title,
                    allDay: true,
                    endDate: d.startDate,
                    repeat: { ...d.repeat, kind: 'hijriYearly', interval: 1 },
                  }))
                }
              >
                {t('occasionEveryYear')} «{t(occasion)}»
              </button>
            )}

            <label className="ed-check">
              <input
                type="checkbox"
                checked={draft.allDay}
                onChange={(e) => set('allDay', e.target.checked)}
              />
              <span>{t('allDay')}</span>
            </label>

            <fieldset className="ed-group">
              <legend>{t('starts')}</legend>
              <input
                type="date"
                aria-label={`${t('starts')} · ${t('date')}`}
                value={draft.startDate}
                onChange={(e) => {
                  setError(null);
                  setDraft((d) => withStart(d, { startDate: e.target.value }));
                }}
              />
              {!draft.allDay && (
                <input
                  type="time"
                  aria-label={`${t('starts')} · ${t('time')}`}
                  value={draft.startTime}
                  onChange={(e) => {
                    setError(null);
                    setDraft((d) => withStart(d, { startTime: e.target.value }));
                  }}
                />
              )}
            </fieldset>

            <fieldset className="ed-group">
              <legend>{t('ends')}</legend>
              <input
                type="date"
                aria-label={`${t('ends')} · ${t('date')}`}
                value={draft.endDate}
                onChange={(e) => set('endDate', e.target.value)}
              />
              {!draft.allDay && (
                <input
                  type="time"
                  aria-label={`${t('ends')} · ${t('time')}`}
                  value={draft.endTime}
                  onChange={(e) => set('endTime', e.target.value)}
                />
              )}
            </fieldset>

            {!draft.allDay && (
              <label className="ed-field">
                <span>{t('timeZone')}</span>
                <select
                  value={draft.tzid}
                  onPointerDown={() => setFullZones(true)}
                  onFocus={() => setFullZones(true)}
                  onChange={(e) => set('tzid', e.target.value)}
                >
                  {zones.map((z) => (
                    <option key={z} value={z}>
                      {z}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <RepeatFields
              value={draft.repeat}
              onChange={(r) => set('repeat', r)}
              fmt={fmt}
              weekStart={weekStart}
            />

            <label className="ed-field">
              <span>{t('calendar')}</span>
              <select value={draft.calendarId} onChange={(e) => set('calendarId', e.target.value)}>
                {calendars.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="ed-field">
              <span>{t('location')}</span>
              <input value={draft.location} onChange={(e) => set('location', e.target.value)} />
            </label>

            <label className="ed-field">
              <span>{t('notes')}</span>
              <textarea
                rows={3}
                value={draft.notes}
                onChange={(e) => set('notes', e.target.value)}
              />
            </label>

            {error !== null && (
              <p role="alert" className="ed-error">
                {t(error)}
              </p>
            )}
          </div>

          <footer className="ed-foot">
            {onDelete && (
              <button type="button" className="btn btn-danger" onClick={onDelete} disabled={busy}>
                {t('delete')}
              </button>
            )}
            <span className="ed-spacer" />
            <button type="button" className="btn" onClick={onClose} disabled={busy}>
              {isDirty(initial, draft) ? t('discard') : t('cancel')}
            </button>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? t('saving') : t('save')}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
