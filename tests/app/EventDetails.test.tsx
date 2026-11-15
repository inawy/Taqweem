import 'fake-indexeddb/auto';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { App } from '@/app/App';
import { createDb, createStore } from '@/data';
import { makeNewEvent } from '../helpers/factories';

const NOW = () => Date.UTC(2026, 9, 13, 12, 0);
const storage = () => {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
  };
};

let dbName = '';
beforeEach(() => {
  dbName = `det-${Math.random().toString(36).slice(2)}`;
});
afterEach(cleanup);

async function seed(): Promise<void> {
  const db = createDb(dbName);
  const store = createStore(db);
  const calendar = await store.createCalendar({ name: 'Personal', color: 'blue' });
  await store.createEvent(
    makeNewEvent({
      calendarId: calendar.id,
      title: 'Team sync',
      location: 'Room 4',
      notes: '<b>not bold</b>\nsecond line',
    }),
  );
  db.close();
}

const open = (saveFile?: (file: { name: string; text: string }) => void) =>
  render(
    <App
      create={() => createDb(dbName)}
      now={NOW}
      storage={storage()}
      {...(saveFile ? { saveFile } : {})}
    />,
  );

describe('the event card: send to the phone (D-159)', () => {
  it('downloads a file with the chosen alarm and says who carries it out', async () => {
    await seed();
    const saved: { name: string; text: string }[] = [];
    open((f) => saved.push(f));
    fireEvent.click(await screen.findByRole('button', { name: /Team sync/ }));
    const card = await screen.findByRole('dialog', { name: 'Team sync' });
    expect(
      within(card).getByText(/carried out by the calendar app that opens the file/),
    ).toBeTruthy();
    fireEvent.click(within(card).getByRole('button', { name: 'Download a file with an alert' }));
    expect(saved).toHaveLength(1);
    expect(saved[0]?.name).toBe('nawy-today-event.ics');
    expect(saved[0]?.text).toContain('SUMMARY:Team sync');
    expect(saved[0]?.text).toContain('TRIGGER:-PT10M');

    fireEvent.change(within(card).getByLabelText('Alert'), { target: { value: '60' } });
    fireEvent.click(within(card).getByRole('button', { name: 'Download a file with an alert' }));
    expect(saved[1]?.text).toContain('TRIGGER:-PT60M');
    expect(saved[1]?.text.match(/BEGIN:VEVENT/g)).toHaveLength(1);
  });
});

describe('the event card', () => {
  it('shows what the event is before anything can be changed', async () => {
    await seed();
    open();
    fireEvent.click(await screen.findByRole('button', { name: /Team sync/ }));
    const card = await screen.findByRole('dialog', { name: 'Team sync' });
    expect(within(card).getByText('Room 4')).toBeTruthy();
    expect(within(card).getByText('Personal')).toBeTruthy();
    // Notes are text, never markup.
    expect(within(card).getByText(/<b>not bold<\/b>/)).toBeTruthy();
    expect(card.querySelector('b')).toBeNull();
    expect(screen.queryByRole('dialog', { name: 'Edit event' })).toBeNull();
  });

  it('Edit opens the editor in its place', async () => {
    await seed();
    open();
    fireEvent.click(await screen.findByRole('button', { name: /Team sync/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Edit event' }));
    expect(await screen.findByRole('dialog', { name: 'Edit event' })).toBeTruthy();
    expect(screen.queryByRole('dialog', { name: 'Team sync' })).toBeNull();
  });

  it('Escape closes it and changes nothing', async () => {
    await seed();
    open();
    fireEvent.click(await screen.findByRole('button', { name: /Team sync/ }));
    const card = await screen.findByRole('dialog', { name: 'Team sync' });
    fireEvent.keyDown(card, { code: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByRole('button', { name: /Team sync/ })).toBeTruthy();
  });

  it('Delete removes the event straight from the card, with an undo', async () => {
    await seed();
    open();
    fireEvent.click(await screen.findByRole('button', { name: /Team sync/ }));
    const card = await screen.findByRole('dialog', { name: 'Team sync' });
    fireEvent.click(within(card).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: /Team sync/ })).toBeNull());
    fireEvent.click(await screen.findByRole('button', { name: 'Undo' }));
    expect(await screen.findByRole('button', { name: /Team sync/ })).toBeTruthy();
  });
});
