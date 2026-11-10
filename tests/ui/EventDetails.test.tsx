import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { SettingsProvider, defaultSettings } from '@/features/settings';
import { EventDetails } from '@/ui/editor/EventDetails';
import { makeCalendar, makeEvent } from '../helpers/factories';
import type { CalEvent } from '@/core/model';

afterEach(cleanup);

const show = (event: CalEvent) =>
  render(
    <SettingsProvider
      storage={{ getItem: () => JSON.stringify(defaultSettings('en')), setItem: () => undefined }}
      languages={['en']}
    >
      <EventDetails
        event={event}
        calendar={makeCalendar({ color: 'blue' })}
        when="Tuesday"
        recurring={false}
        onEdit={() => undefined}
        onDuplicate={() => undefined}
        onDelete={() => undefined}
        onClose={() => undefined}
      />
    </SettingsProvider>,
  );

const bar = (container: HTMLElement) =>
  container.querySelector<HTMLElement>('.details-bar')?.style.background ?? '';

describe('EventDetails colour (D-132)', () => {
  it('draws the event’s own colour, else its calendar’s', () => {
    const own = show(makeEvent({ color: 'red' }));
    expect(bar(own.container)).toContain('--cal-red-bar');
    cleanup();
    const inherited = show(makeEvent());
    expect(bar(inherited.container)).toContain('--cal-blue-bar');
  });
});
