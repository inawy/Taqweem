import { useRef, type TouchEvent } from 'react';
import {
  DRAG_START_PX,
  dragOffset,
  exitPlan,
  flings,
  releaseVelocity,
  settleDrag,
  startsDrag,
} from '@/features/view';
import type { CloseDirection, TrailPoint } from '@/features/view';

export interface SwipeCloseHandlers {
  readonly onTouchStart: (e: TouchEvent<HTMLElement>) => void;
  readonly onTouchMove: (e: TouchEvent<HTMLElement>) => void;
  readonly onTouchEnd: (e: TouchEvent<HTMLElement>) => void;
  readonly onTouchCancel: (e: TouchEvent<HTMLElement>) => void;
}

/**
 * `sheet`: a card that is swiped away down (from its grip or header) or to either side (from
 * anywhere on it), as in D-099. The others are one fixed direction (D-063, D-074).
 */
export type SwipeDirection = CloseDirection | 'sheet';

interface Gesture {
  readonly x: number;
  readonly y: number;
  readonly at: number;
  /** The whole panel that moves: a sheet's `.modal`, or the drawer itself. */
  readonly panel: HTMLElement;
  /** The touch began on the sheet's grip or header, the only place a drag DOWN may start. */
  readonly fromGrip: boolean;
  /** `undefined` until the first few pixels say whether this touch is a drag or something else. */
  dragging: boolean | undefined;
  /** The way this drag was locked to at its start. */
  axis: CloseDirection | undefined;
  /** Where the panel was last drawn. */
  offset: { x: number; y: number };
  /** The last few finger positions, to read how fast it was moving when it let go. */
  trail: TrailPoint[];
}

const SPRING_MS = 160;
const FIELD = 'input, textarea, select, [contenteditable="true"]';

/** The dimmed layer behind a sheet (the drawer has its own, outside the panel). */
function scrimOf(panel: HTMLElement): HTMLElement | null {
  const parent = panel.parentElement;
  return parent?.classList.contains('modal-backdrop') ? parent : null;
}

const SCRIM_ALPHA = 0.45; // the backdrop's colour in CSS

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;
}

/**
 * Touch handlers that move a panel with the finger and close it after a deliberate swipe in its
 * leaving direction. Put them on the part meant to be grabbed (a sheet's whole card, the drawer),
 * never on a typing area. `enabled: false` turns them off (for example while saving). The
 * movement is drawn straight on the element (no re-render per move). A closing sheet does not
 * vanish: it glides on from where the finger left it, in the direction and at the speed it was
 * thrown, and only then is removed.
 */
export function useSwipeClose(
  direction: SwipeDirection,
  onClose: () => void,
  enabled = true,
): SwipeCloseHandlers {
  const gesture = useRef<Gesture | null>(null);
  const leaving = useRef(false);

  const release = (panel: HTMLElement, animate: boolean): void => {
    panel.style.transition = animate ? `transform ${SPRING_MS}ms var(--nawy-ease)` : '';
    panel.style.transform = '';
    const scrim = scrimOf(panel);
    if (scrim) {
      scrim.style.transition = animate ? `background-color ${SPRING_MS}ms linear` : '';
      scrim.style.backgroundColor = '';
    }
    if (animate) {
      window.setTimeout(() => {
        panel.style.transition = '';
        panel.style.willChange = '';
        if (scrim) scrim.style.transition = '';
      }, SPRING_MS + 20);
    } else {
      panel.style.willChange = '';
    }
  };

  return {
    onTouchStart: (e) => {
      const touch = e.touches.length === 1 ? e.touches[0] : undefined;
      if (!touch || leaving.current) {
        gesture.current = null;
        return;
      }
      const target = e.target instanceof Element ? e.target : null;
      // A finger on a text field is selecting text or moving a slider, not throwing the card.
      if (direction === 'sheet' && target?.closest(FIELD)) {
        gesture.current = null;
        return;
      }
      const panel = (e.currentTarget.closest('.modal') as HTMLElement | null) ?? e.currentTarget;
      gesture.current = {
        x: touch.clientX,
        y: touch.clientY,
        at: e.timeStamp,
        panel,
        fromGrip: direction !== 'sheet' || !!target?.closest('.sheet-grip'),
        dragging: undefined,
        axis: undefined,
        offset: { x: 0, y: 0 },
        trail: [{ x: touch.clientX, y: touch.clientY, t: e.timeStamp }],
      };
    },
    onTouchMove: (e) => {
      const g = gesture.current;
      const touch = e.touches[0];
      if (!enabled || !g || !touch || g.dragging === false) return;
      const move = { dx: touch.clientX - g.x, dy: touch.clientY - g.y };
      const rtl = getComputedStyle(e.currentTarget).direction === 'rtl';
      if (g.dragging === undefined) {
        if (Math.abs(move.dx) < DRAG_START_PX && Math.abs(move.dy) < DRAG_START_PX) return;
        if (direction === 'sheet') {
          g.axis =
            g.fromGrip && startsDrag(move, 'down', rtl)
              ? 'down'
              : startsDrag(move, 'side', rtl)
                ? 'side'
                : undefined;
        } else {
          g.axis = startsDrag(move, direction, rtl) ? direction : undefined;
        }
        g.dragging = g.axis !== undefined;
        if (!g.dragging) return;
      }
      const { x, y } = dragOffset(move, g.axis ?? 'down', rtl);
      g.offset = { x, y };
      g.trail.push({ x: touch.clientX, y: touch.clientY, t: e.timeStamp });
      if (g.trail.length > 8) g.trail.shift();
      g.panel.style.willChange = 'transform';
      g.panel.style.transition = 'none';
      g.panel.style.transform = `translate(${x}px, ${y}px)`;
      // The dimmed page behind lightens as the card leaves, so nothing flashes when it is gone.
      const scrim = direction === 'sheet' ? scrimOf(g.panel) : null;
      if (scrim) {
        const span = g.axis === 'down' ? window.innerHeight : window.innerWidth;
        const travelled = Math.min(1, Math.hypot(x, y) / (span * 0.6));
        scrim.style.transition = 'none';
        scrim.style.backgroundColor = `rgb(0 0 0 / ${(SCRIM_ALPHA * (1 - travelled)).toFixed(3)})`;
      }
    },
    onTouchEnd: (e) => {
      const g = gesture.current;
      const touch = e.changedTouches[0];
      gesture.current = null;
      if (!g) return;
      if (!enabled || !touch) {
        release(g.panel, false);
        return;
      }
      const rtl = getComputedStyle(e.currentTarget).direction === 'rtl';
      const move = {
        dx: touch.clientX - g.x,
        dy: touch.clientY - g.y,
        ms: e.timeStamp - g.at,
      };
      // A touch that never moved (a very quick flick) has no locked way yet: take whichever way
      // the whole movement closes.
      const ways: readonly CloseDirection[] =
        g.axis !== undefined
          ? [g.axis]
          : direction === 'sheet'
            ? g.fromGrip
              ? ['down', 'side']
              : ['side']
            : [direction];
      g.trail.push({ x: touch.clientX, y: touch.clientY, t: e.timeStamp });
      const velocity = releaseVelocity(g.trail);
      const axis =
        g.dragging === false
          ? undefined
          : ways.find(
              (w) =>
                settleDrag(move, w, rtl) === 'close' ||
                (direction === 'sheet' &&
                  (w === 'down' || w === 'side') &&
                  flings(w, velocity, move)),
            );
      if (axis === undefined) {
        release(g.panel, g.dragging === true);
        return;
      }
      if (direction !== 'sheet' || (axis !== 'down' && axis !== 'side')) {
        // A drawer glides on from where the finger left it (its own CSS transition).
        release(g.panel, false);
        onClose();
        return;
      }
      if (prefersReducedMotion()) {
        release(g.panel, false);
        onClose();
        return;
      }
      // The card carries on in the direction and at the speed it was thrown, then goes.
      const plan = exitPlan(
        axis,
        move,
        g.offset,
        { width: window.innerWidth, height: window.innerHeight },
        Math.abs(axis === 'down' ? velocity.vy : velocity.vx) || undefined,
      );
      leaving.current = true;
      const { panel } = g;
      const backdrop = scrimOf(panel);
      panel.style.willChange = 'transform';
      panel.style.transition = `transform ${plan.ms}ms cubic-bezier(0.3, 0, 0.7, 1)`;
      panel.style.transform = `translate(${plan.x}px, ${plan.y}px)`;
      if (backdrop) {
        backdrop.style.transition = `background-color ${plan.ms}ms linear`;
        backdrop.style.backgroundColor = 'transparent';
      }
      window.setTimeout(() => {
        onClose();
        // If the owner kept it open after all, give the card back instead of leaving it invisible.
        window.setTimeout(() => {
          leaving.current = false;
          if (!panel.isConnected) return;
          panel.style.transition = '';
          panel.style.transform = '';
          panel.style.willChange = '';
          if (backdrop) {
            backdrop.style.transition = '';
            backdrop.style.backgroundColor = '';
          }
        }, 80);
      }, plan.ms);
    },
    onTouchCancel: () => {
      const g = gesture.current;
      gesture.current = null;
      if (g) release(g.panel, g.dragging === true);
    },
  };
}
