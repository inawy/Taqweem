import { describe, expect, it } from 'vitest';
import {
  closeSwipe,
  dragOffset,
  exitPlan,
  flings,
  releaseVelocity,
  settleDrag,
  startsDrag,
  swipeIntent,
  verticalSwipeIntent,
} from '@/features/view';

describe('swipeIntent', () => {
  it('left-to-right reading: dragging left goes forward, right goes back', () => {
    expect(swipeIntent({ dx: -120, dy: 10, ms: 200 }, false)).toBe('next');
    expect(swipeIntent({ dx: 120, dy: 10, ms: 200 }, false)).toBe('previous');
  });

  it('right-to-left reading mirrors it', () => {
    expect(swipeIntent({ dx: 120, dy: 10, ms: 200 }, true)).toBe('next');
    expect(swipeIntent({ dx: -120, dy: 10, ms: 200 }, true)).toBe('previous');
  });

  it('ignores short, slow and mostly vertical movements', () => {
    expect(swipeIntent({ dx: -30, dy: 0, ms: 100 }, false)).toBeNull();
    expect(swipeIntent({ dx: -200, dy: 0, ms: 900 }, false)).toBeNull();
    expect(swipeIntent({ dx: -100, dy: 90, ms: 200 }, false)).toBeNull();
  });
});

describe('closeSwipe', () => {
  const quick = { ms: 200 };

  it('a sheet closes on a clear, quick swipe down', () => {
    expect(closeSwipe({ dx: 5, dy: 90, ...quick }, 'down', false)).toBe(true);
  });
  it('a sheet stays on a short, slow, upward or sideways swipe', () => {
    expect(closeSwipe({ dx: 0, dy: 40, ...quick }, 'down', false)).toBe(false);
    expect(closeSwipe({ dx: 0, dy: 90, ms: 900 }, 'down', false)).toBe(false);
    expect(closeSwipe({ dx: 0, dy: -90, ...quick }, 'down', false)).toBe(false);
    expect(closeSwipe({ dx: 90, dy: 90, ...quick }, 'down', false)).toBe(false);
  });
  it('a drawer leaves toward the side it came from: right in Arabic, left in English', () => {
    expect(closeSwipe({ dx: 90, dy: 5, ...quick }, 'inline-start', true)).toBe(true);
    expect(closeSwipe({ dx: -90, dy: 5, ...quick }, 'inline-start', true)).toBe(false);
    expect(closeSwipe({ dx: -90, dy: 5, ...quick }, 'inline-start', false)).toBe(true);
    expect(closeSwipe({ dx: 90, dy: 5, ...quick }, 'inline-start', false)).toBe(false);
  });
  it('a drawer ignores short, slow or mostly vertical swipes (scrolling stays scrolling)', () => {
    expect(closeSwipe({ dx: -40, dy: 0, ...quick }, 'inline-start', false)).toBe(false);
    expect(closeSwipe({ dx: -90, dy: 0, ms: 900 }, 'inline-start', false)).toBe(false);
    expect(closeSwipe({ dx: -90, dy: 80, ...quick }, 'inline-start', false)).toBe(false);
  });
});

describe('settleDrag: a panel that followed the finger', () => {
  it('closes on a quick flick, as before', () => {
    expect(settleDrag({ dx: 0, dy: 90, ms: 200 }, 'down', false)).toBe('close');
    expect(settleDrag({ dx: -90, dy: 0, ms: 200 }, 'inline-start', false)).toBe('close');
  });
  it('also closes when carried far enough, however slowly', () => {
    expect(settleDrag({ dx: 0, dy: 140, ms: 2000 }, 'down', false)).toBe('close');
    expect(settleDrag({ dx: 150, dy: 5, ms: 2000 }, 'inline-start', true)).toBe('close');
  });
  it('springs back when it was not carried far, or was carried the wrong way', () => {
    expect(settleDrag({ dx: 0, dy: 60, ms: 2000 }, 'down', false)).toBe('back');
    expect(settleDrag({ dx: 0, dy: -200, ms: 300 }, 'down', false)).toBe('back');
    expect(settleDrag({ dx: 200, dy: 0, ms: 2000 }, 'inline-start', false)).toBe('back');
    expect(settleDrag({ dx: 150, dy: 140, ms: 2000 }, 'down', false)).toBe('back');
  });
});

describe('startsDrag and dragOffset', () => {
  it('a drag starts only in the leaving direction (so scrolling and taps are left alone)', () => {
    expect(startsDrag({ dx: 2, dy: 20 }, 'down', false)).toBe(true);
    expect(startsDrag({ dx: 0, dy: -20 }, 'down', false)).toBe(false);
    expect(startsDrag({ dx: 30, dy: 20 }, 'down', false)).toBe(false);
    expect(startsDrag({ dx: -30, dy: 5 }, 'inline-start', false)).toBe(true);
    expect(startsDrag({ dx: 30, dy: 5 }, 'inline-start', false)).toBe(false);
    expect(startsDrag({ dx: 30, dy: 5 }, 'inline-start', true)).toBe(true);
    expect(startsDrag({ dx: -30, dy: 25 }, 'inline-start', false)).toBe(false);
  });
  it('draws the panel only toward where it leaves, never back past its place', () => {
    expect(dragOffset({ dx: 9, dy: 50 }, 'down', false)).toEqual({ x: 0, y: 50 });
    expect(dragOffset({ dx: 0, dy: -50 }, 'down', false)).toEqual({ x: 0, y: 0 });
    expect(dragOffset({ dx: -40, dy: 9 }, 'inline-start', false)).toEqual({ x: -40, y: 0 });
    expect(dragOffset({ dx: 40, dy: 9 }, 'inline-start', false)).toEqual({ x: 0, y: 0 });
    expect(dragOffset({ dx: 40, dy: 9 }, 'inline-start', true)).toEqual({ x: 40, y: 0 });
  });
});

describe('verticalSwipeIntent: paging through months on a phone', () => {
  it('up brings the next month and down the previous one', () => {
    expect(verticalSwipeIntent({ dx: 5, dy: -120, ms: 250 })).toBe('next');
    expect(verticalSwipeIntent({ dx: -5, dy: 120, ms: 250 })).toBe('previous');
  });
  it('ignores short, slow and slanted movements, and sideways ones', () => {
    expect(verticalSwipeIntent({ dx: 0, dy: -30, ms: 100 })).toBeNull();
    expect(verticalSwipeIntent({ dx: 0, dy: -200, ms: 900 })).toBeNull();
    expect(verticalSwipeIntent({ dx: 80, dy: -100, ms: 200 })).toBeNull();
    expect(verticalSwipeIntent({ dx: 150, dy: 10, ms: 200 })).toBeNull();
  });
});

describe('a card thrown to either side (D-099)', () => {
  it('closes on a clear sideways flick in both directions, in either reading direction', () => {
    expect(closeSwipe({ dx: 90, dy: 5, ms: 200 }, 'side', false)).toBe(true);
    expect(closeSwipe({ dx: -90, dy: 5, ms: 200 }, 'side', true)).toBe(true);
    expect(closeSwipe({ dx: 30, dy: 0, ms: 200 }, 'side', false)).toBe(false);
    expect(closeSwipe({ dx: 90, dy: 80, ms: 200 }, 'side', false)).toBe(false);
    expect(closeSwipe({ dx: 90, dy: 0, ms: 900 }, 'side', false)).toBe(false);
  });
  it('follows the finger either way and starts only when mostly sideways', () => {
    expect(startsDrag({ dx: 30, dy: 5 }, 'side', false)).toBe(true);
    expect(startsDrag({ dx: -30, dy: 5 }, 'side', false)).toBe(true);
    expect(startsDrag({ dx: 30, dy: 25 }, 'side', false)).toBe(false);
    expect(dragOffset({ dx: 40, dy: 9 }, 'side', false)).toEqual({ x: 40, y: 0 });
    expect(dragOffset({ dx: -40, dy: 9 }, 'side', true)).toEqual({ x: -40, y: 0 });
  });
  it('settles: a slow carry far enough closes, a short one springs back', () => {
    expect(settleDrag({ dx: -150, dy: 4, ms: 2000 }, 'side', false)).toBe('close');
    expect(settleDrag({ dx: 60, dy: 4, ms: 2000 }, 'side', false)).toBe('back');
  });
});

describe('exitPlan: the glide that carries a let-go card off the screen', () => {
  const screen = { width: 390, height: 844 };
  it('goes the way it was thrown: down, to the left or to the right', () => {
    const down = exitPlan('down', { dx: 0, dy: 100, ms: 100 }, { x: 0, y: 100 }, screen);
    expect(down).toMatchObject({ x: 0, y: 844 });
    expect(exitPlan('side', { dx: -90, dy: 0, ms: 100 }, { x: -90, y: 0 }, screen).x).toBe(-390);
    expect(exitPlan('side', { dx: 90, dy: 0, ms: 100 }, { x: 90, y: 0 }, screen).x).toBe(390);
  });
  it('a quick flick glides fast, a slow carry not slower than the cap', () => {
    const quick = exitPlan('side', { dx: 200, dy: 0, ms: 60 }, { x: 200, y: 0 }, screen);
    const slow = exitPlan('side', { dx: 130, dy: 0, ms: 3000 }, { x: 130, y: 0 }, screen);
    expect(quick.ms).toBe(120);
    expect(slow.ms).toBeLessThanOrEqual(240);
    expect(slow.ms).toBeGreaterThanOrEqual(quick.ms);
  });
});

describe('a quick flick of the wrist throws a card even when it was not carried far (D-100)', () => {
  const trail = (...points: [number, number, number][]) => points.map(([x, y, t]) => ({ x, y, t }));

  it('reads the speed of the last 100 ms, not of the whole drag', () => {
    const slowThenFast = trail([0, 0, 0], [10, 0, 400], [20, 0, 800], [60, 0, 840], [100, 0, 860]);
    expect(releaseVelocity(slowThenFast).vx).toBeCloseTo(2, 5); // 80 px in the last 40 ms
    expect(releaseVelocity(trail([0, 0, 0]))).toEqual({ vx: 0, vy: 0 });
    expect(releaseVelocity([])).toEqual({ vx: 0, vy: 0 });
  });
  it('throws a sheet down or sideways when the finger leaves fast, never the wrong way', () => {
    expect(flings('down', { vx: 0, vy: 0.9 }, { dx: 2, dy: 30 })).toBe(true);
    expect(flings('down', { vx: 0, vy: 0.2 }, { dx: 0, dy: 30 })).toBe(false); // too slow
    expect(flings('down', { vx: 0, vy: 0.9 }, { dx: 0, dy: 10 })).toBe(false); // barely moved
    expect(flings('side', { vx: -0.8, vy: 0 }, { dx: -30, dy: 3 })).toBe(true);
    expect(flings('side', { vx: 0.8, vy: 0 }, { dx: -30, dy: 3 })).toBe(false); // came back
    expect(flings('side', { vx: 0.8, vy: 0 }, { dx: 30, dy: 40 })).toBe(false); // mostly vertical
  });
  it('the glide uses the speed at release when it is known', () => {
    const screen = { width: 390, height: 844 };
    const fast = exitPlan('side', { dx: 60, dy: 0, ms: 900 }, { x: 60, y: 0 }, screen, 3);
    const average = exitPlan('side', { dx: 60, dy: 0, ms: 900 }, { x: 60, y: 0 }, screen);
    expect(fast.ms).toBe(120);
    expect(average.ms).toBeGreaterThan(fast.ms);
  });
});
