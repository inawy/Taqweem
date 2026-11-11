import 'fake-indexeddb/auto';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '@/app/App';
import { createDb, createSnapshotDb } from '@/data';

let dbName = '';
let snapName = '';
beforeEach(() => {
  const id = Math.random().toString(36).slice(2);
  dbName = `print-${id}`;
  snapName = `print-snaps-${id}`;
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('print (D-142)', () => {
  it('the menu button asks the browser to print the current view', async () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined);
    render(
      <App
        create={() => createDb(dbName)}
        createSnapshots={() => createSnapshotDb(snapName)}
        now={() => Date.UTC(2026, 9, 13, 12, 0)}
        storage={{ getItem: () => null, setItem: () => undefined }}
      />,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Print this view' }));
    expect(print).toHaveBeenCalledTimes(1);
  });
});
