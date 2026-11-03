/**
 * Focuses an element, and keeps trying for a few frames if the browser refuses. A browser refuses
 * to focus an element that is still `visibility: hidden` (a drawer or card that is just being
 * shown), even when the page's own state already says it is open (D-084, D-086). Returns a
 * function that stops trying. Pure DOM: no React.
 */
export function focusWhenReady(el: HTMLElement | null, frames = 12): () => void {
  if (el === null) return () => undefined;
  let handle = 0;
  let left = frames;
  const attempt = (): void => {
    el.focus({ preventScroll: true });
    left -= 1;
    if (document.activeElement === el || left <= 0) return;
    handle = requestAnimationFrame(attempt);
  };
  attempt();
  return () => cancelAnimationFrame(handle);
}
