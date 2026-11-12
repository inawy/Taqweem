import 'fake-indexeddb/auto';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { App } from '@/app/App';
import { createDb, createSnapshotDb } from '@/data';

let dbName = '';
let snapName = '';
beforeEach(() => {
  const id = Math.random().toString(36).slice(2);
  dbName = `occ-${id}`;
  snapName = `occ-snaps-${id}`;
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

describe('upcoming occasions (D-151)', () => {
  it('lists them from the menu and a tap goes to the day', async () => {
    open();
    await screen.findByRole('heading', { level: 1, name: 'October 2026' });
    fireEvent.click(screen.getAllByRole('button', { name: 'Upcoming occasions' })[0]!);
    const dialog = await screen.findByRole('dialog', { name: 'Upcoming occasions' });
    const rows = within(dialog)
      .getAllByRole('button', { name: /./ })
      .filter((b) => b.classList.contains('occasion-row'));
    expect(rows.length).toBeGreaterThan(5);
    expect(within(dialog).getByText(/Umm al-Qura/)).toBeTruthy();
    fireEvent.click(rows[0]!);
    expect(screen.queryByRole('dialog', { name: 'Upcoming occasions' })).toBeNull();
    // The first occasion after 13 Oct 2026 is not in October: the calendar moved.
    expect(screen.queryByRole('heading', { level: 1, name: 'October 2026' })).toBeNull();
  });

  it('Escape closes it without moving', async () => {
    open();
    await screen.findByRole('heading', { level: 1, name: 'October 2026' });
    fireEvent.click(screen.getAllByRole('button', { name: 'Upcoming occasions' })[0]!);
    const dialog = await screen.findByRole('dialog', { name: 'Upcoming occasions' });
    fireEvent.keyDown(dialog, { code: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Upcoming occasions' })).toBeNull();
    expect(screen.getByRole('heading', { level: 1, name: 'October 2026' })).toBeTruthy();
  });
});
