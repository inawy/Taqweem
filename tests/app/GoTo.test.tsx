import 'fake-indexeddb/auto';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { App } from '@/app/App';
import { createDb, createSnapshotDb } from '@/data';

let dbName = '';
let snapName = '';
beforeEach(() => {
  const id = Math.random().toString(36).slice(2);
  dbName = `goto-${id}`;
  snapName = `goto-snaps-${id}`;
});
afterEach(cleanup);

const open = () =>
  render(
    <App
      create={() => createDb(dbName)}
      createSnapshots={() => createSnapshotDb(snapName)}
      now={() => Date.UTC(2026, 9, 13, 12, 0)}
      storage={{ getItem: () => null, setItem: () => undefined }}
    />,
  );

describe('go to date (D-141)', () => {
  it('G opens it, a typed date moves the calendar there, and shortcuts pause while it is open', async () => {
    open();
    await screen.findByRole('heading', { level: 1, name: 'October 2026' });
    fireEvent.keyDown(window, { code: 'KeyG' });
    const dialog = await screen.findByRole('dialog', { name: 'Go to date' });
    fireEvent.keyDown(window, { code: 'KeyC' });
    expect(screen.queryByRole('dialog', { name: 'New event' })).toBeNull();
    const field = within(dialog).getByLabelText('Go to date') as HTMLInputElement;
    expect(field.value).toBe('2026-10-13');
    fireEvent.change(field, { target: { value: '2030-03-05' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Go' }));
    expect(screen.queryByRole('dialog', { name: 'Go to date' })).toBeNull();
    expect(await screen.findByRole('heading', { level: 1, name: 'March 2030' })).toBeTruthy();
  });

  it('is reachable from the menu, and Escape closes it without moving', async () => {
    open();
    await screen.findByRole('heading', { level: 1, name: 'October 2026' });
    fireEvent.click(screen.getAllByRole('button', { name: 'Go to date' })[0]!);
    const dialog = await screen.findByRole('dialog', { name: 'Go to date' });
    fireEvent.keyDown(dialog, { code: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Go to date' })).toBeNull();
    expect(screen.getByRole('heading', { level: 1, name: 'October 2026' })).toBeTruthy();
  });

  it('refuses an empty date and stays open', async () => {
    open();
    fireEvent.keyDown(window, { code: 'KeyG' });
    const dialog = await screen.findByRole('dialog', { name: 'Go to date' });
    fireEvent.change(within(dialog).getByLabelText('Go to date'), { target: { value: '' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Go' }));
    expect(within(dialog).getByRole('alert').textContent).toBe('Enter a valid date.');
    expect(screen.getByRole('dialog', { name: 'Go to date' })).toBeTruthy();
  });
});
