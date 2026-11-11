import { useEffect, useId, useRef, useState } from 'react';
import type { FormEvent, KeyboardEvent } from 'react';
import { isValidDate } from '@/core/time';
import type { PlainDate } from '@/core/time';
import { useT } from '@/features/i18n';
import { trapTab } from '@/lib/focusTrap';
import { useRestoreFocus } from '@/ui/shell/useRestoreFocus';
import { CloseIcon } from '../shell/Icons';
import { useSwipeClose } from '../shell/useSwipeClose';

export interface GoToDialogProps {
  /** The day the app is on now: where the date field starts. */
  readonly from: PlainDate;
  readonly onGo: (date: PlainDate) => void;
  readonly onClose: () => void;
}

/** Jump to any date by typing or picking it (D-141): the small month only reaches a month at a time. */
export function GoToDialog({ from, onGo, onClose }: GoToDialogProps) {
  const t = useT();
  useRestoreFocus();
  const titleId = useId();
  const ref = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState<string>(from);
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    input.current?.focus();
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

  const submit = (event: FormEvent): void => {
    event.preventDefault();
    if (isValidDate(value)) onGo(value);
    else setInvalid(true);
  };

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
          <h2 id={titleId}>{t('goToDate')}</h2>
          <button type="button" className="icon-btn" aria-label={t('close')} onClick={onClose}>
            <CloseIcon />
          </button>
        </header>
        <form onSubmit={submit}>
          <div className="ed-body">
            <label className="field">
              <span>{t('goToDate')}</span>
              <input
                ref={input}
                type="date"
                value={value}
                aria-invalid={invalid}
                onChange={(e) => {
                  setValue(e.currentTarget.value);
                  setInvalid(false);
                }}
              />
            </label>
            {invalid && <p role="alert">{t('goToInvalid')}</p>}
          </div>
          <div className="ed-foot">
            <span className="ed-spacer" />
            <button type="submit" className="btn btn-primary">
              {t('goToGo')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
