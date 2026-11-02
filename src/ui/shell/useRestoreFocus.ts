import { useEffect, useRef } from 'react';

/**
 * Gives focus back to what opened a dialog when the dialog goes away (the design system's rule:
 * "restore focus to the previous element"; D-085). The opener is taken while the dialog renders,
 * before it moves focus into itself. Nothing happens when the opener is gone, or when focus was
 * moved on purpose to somewhere else (only a focus left on the page itself is put back).
 */
export function useRestoreFocus(): void {
  const opener = useRef<Element | null>(
    typeof document === 'undefined' ? null : document.activeElement,
  );
  useEffect(() => {
    const el = opener.current;
    return () => {
      if (!(el instanceof HTMLElement) || !el.isConnected || el === document.body) return;
      const now = document.activeElement;
      if (now === null || now === document.body) el.focus({ preventScroll: true });
    };
  }, []);
}
