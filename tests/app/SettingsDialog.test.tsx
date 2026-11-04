import 'fake-indexeddb/auto';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { App } from '@/app/App';
import { createDb } from '@/data';

afterEach(cleanup);

const memoryStorage = () => {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
  };
};

const open = () =>
  render(
    <App
      create={() => createDb(`sd-${Math.random().toString(36).slice(2)}`)}
      now={() => Date.UTC(2026, 9, 13, 12)}
      storage={memoryStorage()}
    />,
  );

describe('settings live in their own dialog (D-095)', () => {
  it('the side panel keeps no setting boxes, only a button that opens them', async () => {
    open();
    await screen.findByRole('heading', { level: 1 });
    const panel = document.querySelector('.sidebar') as HTMLElement;
    expect(within(panel).queryAllByRole('combobox')).toHaveLength(0);
    expect(within(panel).getByRole('button', { name: 'Settings' })).toBeTruthy();

    fireEvent.click(within(panel).getByRole('button', { name: 'Settings' }));
    const dialog = screen.getByRole('dialog', { name: 'Settings' });
    expect(within(dialog).getAllByRole('combobox')).toHaveLength(6);
    expect(within(dialog).getByLabelText('Show Hijri date')).toBeTruthy();
  });

  it('Escape closes it and the keyboard shortcuts work again', async () => {
    open();
    await screen.findByRole('heading', { level: 1 });
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    const dialog = screen.getByRole('dialog', { name: 'Settings' });
    // While it is open a letter must not change the view behind it.
    fireEvent.keyDown(window, { code: 'KeyD' });
    expect(screen.getAllByRole('button', { name: 'Month', pressed: true }).length).toBe(1);
    fireEvent.keyDown(dialog, { code: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Settings' })).toBeNull();
    fireEvent.keyDown(window, { code: 'KeyD' });
    expect(screen.getAllByRole('button', { name: 'Day', pressed: true }).length).toBe(1);
  });
});
