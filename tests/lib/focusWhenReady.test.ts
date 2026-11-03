import { afterEach, describe, expect, it, vi } from 'vitest';
import { focusWhenReady } from '@/lib/focusWhenReady';

describe('focusWhenReady', () => {
  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('focuses at once when the browser allows it', () => {
    const button = document.createElement('button');
    document.body.append(button);
    focusWhenReady(button);
    expect(document.activeElement).toBe(button);
  });

  it('keeps trying on the next frames while the browser refuses, then stops', () => {
    vi.useFakeTimers();
    const button = document.createElement('button');
    document.body.append(button);
    const real = button.focus.bind(button);
    let calls = 0;
    button.focus = (options?: FocusOptions) => {
      calls += 1;
      if (calls >= 3) real(options); // refused twice, as for an element still hidden
    };
    focusWhenReady(button);
    expect(document.activeElement).not.toBe(button);
    vi.advanceTimersByTime(100);
    expect(document.activeElement).toBe(button);
    expect(calls).toBe(3);
  });

  it('gives up after the given number of frames, and can be cancelled', () => {
    vi.useFakeTimers();
    const button = document.createElement('button');
    document.body.append(button);
    let calls = 0;
    button.focus = () => {
      calls += 1;
    };
    focusWhenReady(button, 4);
    vi.advanceTimersByTime(500);
    expect(calls).toBe(4);

    calls = 0;
    const cancel = focusWhenReady(button, 10);
    cancel();
    vi.advanceTimersByTime(500);
    expect(calls).toBe(1);
  });

  it('does nothing for a missing element', () => {
    expect(() => focusWhenReady(null)()).not.toThrow();
  });
});
