import { useRef, useState } from 'react';
import { BUILD_INFO } from '@/lib/buildInfo';
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
  /** How long to wait for the phone; 10 seconds when not given. */
  readonly answerMs?: number | undefined;
}

/** The phone must answer within this; a call that never returns is shown, not waited on forever. */
const ANSWER_MS = 10_000;

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
  const end = useRef<HTMLDivElement>(null);

  const run = async (job: () => Promise<void>): Promise<void> => {
    setBusy(true);
    setNote(null);
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        job(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () => reject(new Error(t('diagTimeout'))),
            tools.answerMs ?? ANSWER_MS,
          );
        }),
      ]);
    } catch (error) {
      setNote(`${t('diagFailed')} ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      clearTimeout(timer);
      setBusy(false);
      // The section sits at the bottom of a long form: bring the answer into view.
      setTimeout(() => end.current?.scrollIntoView?.({ block: 'nearest' }), 50);
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
      {busy && <p className="muted">{t('diagBusy')}</p>}
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
      <p className="muted">
        {t('diagBuild')}: {BUILD_INFO.sha}
      </p>
      <div ref={end} />
    </section>
  );
}
