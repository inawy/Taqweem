import { useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import type { Calendar, CalEvent } from '@/core/model';
import { useT } from '@/features/i18n';
import type { MessageKey } from '@/features/i18n';
import { trapTab } from '@/lib/focusTrap';
import { useRestoreFocus } from '@/ui/shell/useRestoreFocus';
import { CloseIcon } from '@/ui/shell/Icons';
import { useSwipeClose } from '@/ui/shell/useSwipeClose';
import { calendarColorVars } from '@/ui/theme/calendarColor';

export interface EventDetailsProps {
  readonly event: CalEvent;
  readonly calendar: Calendar | undefined;
  /** Already formatted: "Tuesday, October 20, 2026 · 9:00 AM – 10:00 AM". */
  readonly when: string;
  /** The same time on the person's own clock, when the event is kept in another zone (D-148). */
  readonly whenHere?: string | undefined;
  readonly recurring: boolean;
  /** Hands the event to the phone's own calendar as a file, with an alarm that many minutes early. */
  readonly onSendToPhone?: ((minutes: number) => void) | undefined;
  readonly onEdit: () => void;
  readonly onDuplicate: () => void;
  readonly onDelete: () => void;
  readonly onClose: () => void;
}

const ALARM_CHOICES: readonly (readonly [number, MessageKey])[] = [
  [0, 'icsAlarm0'],
  [10, 'icsAlarm10'],
  [60, 'icsAlarm60'],
  [1440, 'icsAlarm1440'],
];

/** What an event is, at a glance, before deciding to change it. Text only: never parsed as HTML. */
export function EventDetails({
  event,
  calendar,
  when,
  whenHere,
  recurring,
  onSendToPhone,
  onEdit,
  onDuplicate,
  onDelete,
  onClose,
}: EventDetailsProps) {
  const t = useT();
  useRestoreFocus();
  const titleId = useId();
  const ref = useRef<HTMLDivElement>(null);
  const editRef = useRef<HTMLButtonElement>(null);
  const [alarm, setAlarm] = useState(10);
  const alarmId = useId();
  const title = event.title.trim() === '' ? t('untitled') : event.title;

  useEffect(() => {
    editRef.current?.focus();
  }, []);
  const swipe = useSwipeClose('sheet', onClose);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>): void => {
    if (e.code === 'Escape') {
      e.stopPropagation();
      onClose();
      return;
    }
    if (ref.current) trapTab(ref.current, e.nativeEvent);
  };

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        className="modal details"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={onKeyDown}
        {...swipe}
      >
        <div className="ed-head sheet-grip">
          <span
            className="details-bar"
            style={{ background: calendarColorVars(event.color ?? calendar?.color ?? 'gray').bar }}
            aria-hidden="true"
          />
          <h2 id={titleId} className="details-title">
            {title}
          </h2>
          <button type="button" className="icon-btn" aria-label={t('close')} onClick={onClose}>
            <CloseIcon />
          </button>
        </div>
        <dl className="details-body">
          <div>
            <dt>{t('when')}</dt>
            <dd>
              {when}
              {whenHere && (
                <span className="details-here">{t('whenHere', { when: whenHere })}</span>
              )}
              {recurring && <span className="details-chip">{t('detailsRepeats')}</span>}
            </dd>
          </div>
          {event.location && (
            <div>
              <dt>{t('location')}</dt>
              <dd>{event.location}</dd>
            </div>
          )}
          {calendar && (
            <div>
              <dt>{t('calendar')}</dt>
              <dd>{calendar.name}</dd>
            </div>
          )}
          {event.notes && (
            <div>
              <dt>{t('notes')}</dt>
              <dd className="details-notes">{event.notes}</dd>
            </div>
          )}
        </dl>
        {onSendToPhone && (
          <section className="details-alarm" aria-labelledby={`${alarmId}-h`}>
            <h3 id={`${alarmId}-h`} className="details-alarm-head">
              {t('icsAlarmHead')}
            </h3>
            <label className="field">
              <span>{t('icsAlarmWhen')}</span>
              <select value={alarm} onChange={(e) => setAlarm(Number(e.currentTarget.value))}>
                {ALARM_CHOICES.map(([minutes, key]) => (
                  <option key={minutes} value={minutes}>
                    {t(key)}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" className="btn" onClick={() => onSendToPhone(alarm)}>
              {t('icsAlarmButton')}
            </button>
            <p className="muted details-alarm-note">
              {t('icsAlarmNote')}
              {event.allDay && ` ${t('icsAlarmAllDay')}`}
            </p>
          </section>
        )}
        <footer className="ed-foot">
          <button ref={editRef} type="button" className="btn btn-primary" onClick={onEdit}>
            {t('editEvent')}
          </button>
          <button type="button" className="btn" onClick={onDuplicate}>
            {t('duplicateEvent')}
          </button>
          <button type="button" className="btn btn-danger" onClick={onDelete}>
            {t('delete')}
          </button>
        </footer>
      </div>
    </div>
  );
}
