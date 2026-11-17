import 'fake-indexeddb/auto';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '@/app/App';
import { createDb } from '@/data';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('the add button always stays on screen (D-165)', () => {
  it('on a phone it is not hidden by scrolling', async () => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query.includes('max-width: 599px'),
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }));
    const { container } = render(
      <App
        create={() => createDb(`fab-${Math.random().toString(36).slice(2)}`)}
        now={() => Date.UTC(2026, 9, 13, 12, 0)}
        storage={{ getItem: () => null, setItem: () => undefined }}
      />,
    );
    const fab = await screen.findByRole('button', { name: 'Add event' });
    const area = container.querySelector('.main') as HTMLElement;
    act(() => {
      area.scrollTop = 0;
      fireEvent.scroll(area);
      area.scrollTop = 400;
      fireEvent.scroll(area);
    });
    expect(fab.getAttribute('data-hidden')).toBeNull();
    expect(fab.getAttribute('tabindex')).toBeNull();
  });
});
