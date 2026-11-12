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
    expect(within(dialog).getAllByRole('combobox')).toHaveLength(11);
    expect(within(dialog).getByLabelText('Show Hijri date')).toBeTruthy();
  });

  it('offers the Hijri correction only while the Hijri date is shown (D-150)', async () => {
    open();
    await screen.findByRole('heading', { level: 1 });
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    const dialog = screen.getByRole('dialog', { name: 'Settings' });
    expect(within(dialog).queryByLabelText('Hijri date correction')).toBeNull();
    fireEvent.click(within(dialog).getByLabelText('Show Hijri date'));
    const select = within(dialog).getByLabelText('Hijri date correction') as HTMLSelectElement;
    expect(select.value).toBe('0');
    fireEvent.change(select, { target: { value: '-1' } });
    expect(select.value).toBe('-1');
  });

  it('working hours: choosing a start reveals an end that must be later (D-129)', async () => {
    open();
    await screen.findByRole('heading', { level: 1 });
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    const dialog = screen.getByRole('dialog', { name: 'Settings' });
    expect(within(dialog).queryByLabelText('Working hours until')).toBeNull();
    fireEvent.change(within(dialog).getByLabelText(/^Working hours from/), {
      target: { value: '9' },
    });
    const until = within(dialog).getByLabelText('Working hours until') as HTMLSelectElement;
    expect(until.value).toBe('17');
    expect(Array.from(until.options).map((o) => o.value)[0]).toBe('10');
    fireEvent.change(until, { target: { value: '15' } });
    expect((within(dialog).getByLabelText('Working hours until') as HTMLSelectElement).value).toBe(
      '15',
    );
    fireEvent.change(within(dialog).getByLabelText(/^Working hours from/), {
      target: { value: 'off' },
    });
    expect(within(dialog).queryByLabelText('Working hours until')).toBeNull();
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
