import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { draftForNew } from '@/features/events';
import { SettingsProvider, defaultSettings } from '@/features/settings';
import { EventEditor, timeZoneOptions } from '@/ui/editor/EventEditor';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const open = () =>
  render(
    <SettingsProvider
      storage={{ getItem: () => JSON.stringify(defaultSettings('ar')), setItem: () => undefined }}
      languages={['ar']}
    >
      <EventEditor
        mode="new"
        initial={draftForNew({ date: '2026-11-03', calendarId: 'c1', tzid: 'Asia/Riyadh' })}
        calendars={[
          { id: 'c1', name: 'x', color: 'blue', visible: true, createdAt: 1, updatedAt: 1 },
        ]}
        fmt={{ locale: 'ar' }}
        weekStart={7}
        onSave={() => Promise.resolve({ ok: true })}
        onClose={() => undefined}
      />
    </SettingsProvider>,
  );

describe('the time zone list in the editor', () => {
  it('starts short, so opening the editor stays cheap', () => {
    const short = timeZoneOptions('Asia/Riyadh', false);
    expect(short).toContain('Asia/Riyadh');
    expect(short).toContain('UTC');
    expect(short.length).toBeLessThanOrEqual(3);
    expect(timeZoneOptions('Asia/Riyadh', true).length).toBeGreaterThan(short.length);
  });

  it('shows the event zone at once and the whole list shortly after', () => {
    vi.useFakeTimers();
    open();
    const select = screen.getByDisplayValue('Asia/Riyadh') as HTMLSelectElement;
    const before = select.options.length;
    expect(before).toBeLessThanOrEqual(3);
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(select.options.length).toBeGreaterThan(before);
    expect(select.value).toBe('Asia/Riyadh');
  });
});
