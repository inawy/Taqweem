import { readFileSync } from 'node:fs';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { SettingsProvider, defaultSettings } from '@/features/settings';
import { Sidebar } from '@/ui/shell/Sidebar';

afterEach(cleanup);

// jsdom has no layout, so a test cannot measure a gap. What it can do is make sure the rule that
// makes the gap really targets the buttons as they are in the page (D-154 targeted their wrong
// parent and did nothing).
const css = readFileSync('src/ui/styles/shell.css', 'utf8');

const renderSidebar = () =>
  render(
    <SettingsProvider
      storage={{ getItem: () => JSON.stringify(defaultSettings('en')), setItem: () => undefined }}
      languages={['en']}
    >
      <Sidebar
        calendars={[]}
        onToggleCalendar={() => undefined}
        onOpenSettings={() => undefined}
        onOpenGoTo={() => undefined}
        onOpenOccasions={() => undefined}
        onOpenData={() => undefined}
        onOpenAbout={() => undefined}
      />
    </SettingsProvider>,
  );

describe('sidebar tools behind "More" (D-154, D-157)', () => {
  it('keeps the tools out of the panel until "More" is opened', () => {
    const { container } = renderSidebar();
    const toggle = screen.getByRole('button', { name: 'More' });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    for (const name of ['Go to date', 'Upcoming occasions', 'Data & backups', 'Print this view']) {
      expect(screen.queryByRole('button', { name })).toBeNull();
    }
    expect(container.querySelector('.more-tools')).toBeNull();
    // Settings stays where it was: one tap, not two.
    expect(screen.getByRole('button', { name: 'Settings' })).toBeTruthy();
  });

  it('opens them as full-width blocks in one place, and the rules name that place', () => {
    const { container } = renderSidebar();
    fireEvent.click(screen.getByRole('button', { name: 'More' }));
    const tools = container.querySelector('.more-tools');
    expect(tools).not.toBeNull();
    const names = [...(tools?.querySelectorAll('button') ?? [])].map((b) => b.textContent);
    expect(names).toEqual([
      'Upcoming occasions',
      'Go to date',
      'Data & backups',
      'Print this view',
      'About and privacy',
    ]);
    const toggle = screen.getByRole('button', { name: 'More' });
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(toggle.getAttribute('aria-controls')).toBe(tools?.id);
    expect(toggle.parentElement?.classList.contains('sidebar-settings')).toBe(true);

    const rule = /\.more-tools > \.btn \{([^}]*)\}/.exec(css)?.[1] ?? '';
    expect(rule).toContain('display: block');
    expect(rule).toContain('inline-size: 100%');
    expect(rule).toMatch(/margin-block-start: \d+px/);

    fireEvent.click(toggle);
    expect(container.querySelector('.more-tools')).toBeNull();
  });

  it('the add-calendar button has the width of the other buttons, its label centred (D-156)', () => {
    const rule = /\.calendar-add \{([^}]*)\}/.exec(css)?.[1] ?? '';
    expect(rule).toContain('inline-size: 100%');
    expect(rule).toContain('justify-content: center');
    expect(rule).not.toContain('inline-flex');
  });
});
