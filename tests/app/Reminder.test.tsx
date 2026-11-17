import 'fake-indexeddb/auto';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { App } from '@/app/App';
import { createDb, createStore } from '@/data';

const NOW = () => Date.UTC(2026, 9, 13, 12, 0);

const memoryStorage = () => {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
  };
};

let dbName = '';
beforeEach(() => {
  dbName = `rem-${Math.random().toString(36).slice(2)}`;
});
afterEach(cleanup);

const open = (reminders: boolean) =>
  render(
    <App
      create={() => createDb(dbName)}
      now={NOW}
      storage={memoryStorage()}
      reminders={reminders}
    />,
  );

async function newEvent() {
  fireEvent.click(await screen.findByRole('button', { name: 'Add event' }));
  return screen.findByRole('dialog', { name: 'New event' });
}

async function stored() {
  const db = createDb(dbName);
  const events = await createStore(db).listEvents();
  db.close();
  return events;
}

describe('the reminder field (D-161)', () => {
  it('is not offered in the browser: nothing there could ring', async () => {
    open(false);
    const dialog = await newEvent();
    expect(within(dialog).queryByLabelText('Reminder')).toBeNull();
  });

  it('the event card offers no file to hand to another calendar app', async () => {
    const db = createDb(dbName);
    const store = createStore(db);
    const cal = await store.createCalendar({ name: 'P', color: 'blue' });
    await store.createEvent({
      calendarId: cal.id,
      title: 'Lunch',
      allDay: false,
      start: '2026-10-13T13:00',
      end: '2026-10-13T14:00',
      tzid: 'UTC',
    });
    db.close();
    open(true);
    fireEvent.click(await screen.findByRole('button', { name: /Lunch/ }));
    const card = await screen.findByRole('dialog', { name: 'Lunch' });
    expect(
      within(card).queryByRole('button', { name: 'Download a file with an alert' }),
    ).toBeNull();
  });

  it('is offered natively, starts at the default and is saved with the event', async () => {
    open(true);
    const dialog = await newEvent();
    const select = within(dialog).getByLabelText('Reminder') as HTMLSelectElement;
    expect(select.value).toBe('10');
    fireEvent.change(within(dialog).getByLabelText('Title'), { target: { value: 'Dentist' } });
    fireEvent.change(select, { target: { value: '60' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(async () => {
      const [e] = await stored();
      expect(e?.reminderMinutes).toBe(60);
    });
  });

  it('can be taken off again, and "no reminder" saves no field at all', async () => {
    open(true);
    let dialog = await newEvent();
    fireEvent.change(within(dialog).getByLabelText('Title'), { target: { value: 'Call' } });
    fireEvent.change(within(dialog).getByLabelText('Reminder'), { target: { value: '10' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    fireEvent.click(await screen.findByRole('button', { name: /Call/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Edit event' }));
    dialog = await screen.findByRole('dialog', { name: 'Edit event' });
    const select = within(dialog).getByLabelText('Reminder') as HTMLSelectElement;
    expect(select.value).toBe('10');
    fireEvent.change(select, { target: { value: '' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(async () => {
      const [e] = await stored();
      expect(e && 'reminderMinutes' in e).toBe(false);
    });
  });

  it('keeps an unusual value an event came with, instead of dropping it', async () => {
    const db = createDb(dbName);
    const store = createStore(db);
    const cal = await store.createCalendar({ name: 'Personal', color: 'blue' });
    await store.createEvent({
      calendarId: cal.id,
      title: 'Odd',
      allDay: false,
      start: '2026-10-13T15:00',
      end: '2026-10-13T16:00',
      tzid: 'Asia/Riyadh',
      reminderMinutes: 45,
    });
    db.close();
    open(true);
    fireEvent.click(await screen.findByRole('button', { name: /Odd/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Edit event' }));
    const dialog = await screen.findByRole('dialog', { name: 'Edit event' });
    const select = within(dialog).getByLabelText('Reminder') as HTMLSelectElement;
    expect(select.value).toBe('45');
  });
});
