import { useEffect, useId, useRef } from 'react';
import type { KeyboardEvent } from 'react';
import { addDays, epochDayOf, formatDate, formatDateRange, formatHijriDate } from '@/core/time';
import type { FormatOptions, PlainDate } from '@/core/time';
import { useT } from '@/features/i18n';
import { upcomingOccasions } from '@/features/view';
import { trapTab } from '@/lib/focusTrap';
import { useRestoreFocus } from '@/ui/shell/useRestoreFocus';
import { CloseIcon } from '../shell/Icons';
import { useSwipeClose } from '../shell/useSwipeClose';

export interface OccasionsDialogProps {
  readonly today: PlainDate;
  readonly fmt: FormatOptions;
  /** The Hijri correction in days (D-150). */
  readonly adjust: number;
  readonly onGo: (date: PlainDate) => void;
  readonly onClose: () => void;
}

/** The next Islamic occasions with their dates; touching one goes to its day (D-151). */
export function OccasionsDialog({ today, fmt, adjust, onGo, onClose }: OccasionsDialogProps) {
  const t = useT();
  useRestoreFocus();
  const titleId = useId();
  const ref = useRef<HTMLDivElement>(null);
  const swipe = useSwipeClose('sheet', onClose);

  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('button.occasion-row')?.focus();
  }, []);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.code === 'Escape') {
      event.stopPropagation();
      onClose();
      return;
    }
    if (ref.current) trapTab(ref.current, event.nativeEvent);
  };

  // The numbering system goes in the locale: this formatter takes no option for it.
  const rtf = new Intl.RelativeTimeFormat(`${fmt.locale}-u-nu-${fmt.numerals ?? 'latn'}`, {
    numeric: 'auto',
  });
  const todayDay = epochDayOf(today) ?? 0;
  const list = upcomingOccasions(today, adjust);

  return (
    <div className="modal-backdrop">
      <div
        ref={ref}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        {...swipe}
      >
        <header className="ed-head sheet-grip">
          <h2 id={titleId}>{t('upcomingOccasions')}</h2>
          <button type="button" className="icon-btn" aria-label={t('close')} onClick={onClose}>
            <CloseIcon />
          </button>
        </header>
        <div className="ed-body">
          <ul className="occasion-list">
            {list.map((o) => {
              const days = (epochDayOf(o.start) ?? todayDay) - todayDay;
              return (
                <li key={`${o.key}-${o.start}`}>
                  <button type="button" className="occasion-row" onClick={() => onGo(o.start)}>
                    <span className="occasion-name">{t(o.key)}</span>
                    <span className="occasion-date">
                      {o.start === o.end
                        ? formatDate(o.start, fmt, 'medium')
                        : formatDateRange(o.start, o.end, fmt)}
                    </span>
                    <span className="occasion-hijri muted">
                      {formatHijriDate(addDays(o.start, adjust), fmt)}
                    </span>
                    <span className="occasion-until muted">{rtf.format(days, 'day')}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="muted">{t('upcomingNote')}</p>
        </div>
      </div>
    </div>
  );
}
