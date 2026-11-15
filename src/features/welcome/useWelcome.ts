import { useCallback, useEffect, useState } from 'react';

// The first-run card (D-158): shown once, to someone whose calendar is empty. A small flag in
// localStorage like the settings; if the browser refuses it, the card may come back, nothing breaks.

export const WELCOME_KEY = 'nawy-today:welcome:v1';

interface Reader {
  getItem(key: string): string | null;
}
interface Writer {
  setItem(key: string, value: string): void;
}

function seenBefore(storage: Reader | undefined): boolean {
  try {
    return storage?.getItem(WELCOME_KEY) === '1';
  } catch {
    return false;
  }
}

function remember(storage: Writer | undefined): void {
  try {
    storage?.setItem(WELCOME_KEY, '1');
  } catch {
    // Refused: the card may show again next time.
  }
}

export interface Welcome {
  readonly show: boolean;
  readonly dismiss: () => void;
}

export interface WelcomeOptions {
  readonly storage: (Reader & Writer) | undefined;
  /** False while the data is loading, and when the app was not asked to greet anyone. */
  readonly enabled: boolean;
  /** Events in the calendar. Someone who already has some does not need a greeting. */
  readonly eventCount: number;
}

export function useWelcome({ storage, enabled, eventCount }: WelcomeOptions): Welcome {
  const [seen, setSeen] = useState(() => seenBefore(storage));
  const hasData = eventCount > 0;

  // Whoever has events has already found their way: never greet them later, if they empty it.
  useEffect(() => {
    if (!enabled || !hasData || seen) return;
    remember(storage);
    setSeen(true);
  }, [enabled, hasData, seen, storage]);

  const dismiss = useCallback(() => {
    remember(storage);
    setSeen(true);
  }, [storage]);

  return { show: enabled && !seen && !hasData, dismiss };
}
