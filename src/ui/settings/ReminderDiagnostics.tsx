import { useState } from 'react';
import { useT } from '@/features/i18n';
import type { MessageKey } from '@/features/i18n';

// For the native app only (D-163): shows what the phone says about reminders and rings a test one,
// so a missing reminder can be told apart: the phone's settings, or the app's own data.

export interface ReminderState {
  readonly permission: 'granted' | 'denied' | 'prompt';
  readonly exactAlarm: 'granted' | 'denied' | 'unknown';
  readonly pending: number;
}

export interface ReminderTools {
  check(): Promise<ReminderState>;
  /** Asks for permission if needed, then schedules the test one. */
  test(): Promise<'sent' | 'denied'>;
  openExactAlarmSettings(): Promise<void>;
}

const STATE_KEY: Record<string, MessageKey> = {
  granted: 'diagGranted',
  denied: 'diagDenied',
  prompt: 'diagPrompt',
  unknown: 'diagUnknown',
};

export function ReminderDiagnostics({ tools }: { readonly tools: ReminderTools }) {
  const t = useT();
  const [state, setState] = useState<ReminderState | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (job: () => Promise<void>): Promise<void> => {
    setBusy(true);
    setNote(null);
    try {
      await job();
    } catch (error) {
      setNote(`${t('diagFailed')} ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="reminder-diag" aria-labelledby="reminder-diag-head">
      <h3 id="reminder-diag-head" className="details-alarm-head">
        {t('diagHead')}
      </h3>
      <button
        type="button"
        className="btn"
        disabled={busy}
        onClick={() => void run(async () => setState(await tools.check()))}
      >
        {t('diagCheck')}
      </button>
      <button
        type="button"
        className="btn"
        disabled={busy}
        onClick={() =>
          void run(async () => {
            const result = await tools.test();
            setNote(t(result === 'sent' ? 'diagSent' : 'diagTestDenied'));
            setState(await tools.check());
          })
        }
      >
        {t('diagTest')}
      </button>
      {state && (
        <ul className="reminder-diag-list" role="status">
          <li>
            {t('diagPermission')}: {t(STATE_KEY[state.permission] ?? 'diagUnknown')}
          </li>
          <li>
            {t('diagExact')}: {t(STATE_KEY[state.exactAlarm] ?? 'diagUnknown')}
          </li>
          <li>
            {t('diagPending')}: {state.pending}
          </li>
        </ul>
      )}
      {state?.exactAlarm === 'denied' && (
        <button
          type="button"
          className="btn"
          disabled={busy}
          onClick={() => void run(() => tools.openExactAlarmSettings())}
        >
          {t('diagOpenExact')}
        </button>
      )}
      {note && <p className="muted">{note}</p>}
    </section>
  );
}
