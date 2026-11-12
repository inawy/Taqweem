import { readFileSync } from 'node:fs';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SettingsProvider, defaultSettings } from '@/features/settings';
import { Sidebar } from '@/ui/shell/Sidebar';

// jsdom has no layout, so a test cannot measure a gap. What it can do is make sure the rule that
// makes the gap really targets the buttons as they are in the page (D-154 targeted their wrong
// parent and did nothing).
const css = readFileSync('src/ui/styles/shell.css', 'utf8');

describe('sidebar shortcut buttons (D-154)', () => {
  it('are blocks of the full width with a gap, and the rule names their real parent', () => {
    const { container } = render(
      <SettingsProvider
        storage={{ getItem: () => JSON.stringify(defaultSettings('en')), setItem: () => undefined }}
        languages={['en']}
      >
        <Sidebar
          calendars={[]}
          onToggleCalendar={() => undefined}
          onOpenGoTo={() => undefined}
          onOpenOccasions={() => undefined}
        />
      </SettingsProvider>,
    );
    const buttons = [...container.querySelectorAll('.goto-btn')];
    expect(buttons).toHaveLength(2);
    for (const b of buttons) expect(b.parentElement?.classList.contains('sidebar-body')).toBe(true);

    const rule = /\.sidebar-body > \.goto-btn \{([^}]*)\}/.exec(css)?.[1] ?? '';
    expect(rule).toContain('display: block');
    expect(rule).toContain('inline-size: 100%');
    expect(rule).toMatch(/margin-block-start: \d+px/);
  });

  it('the add-calendar button has the width of the other buttons, its label centred (D-156)', () => {
    const rule = /\.calendar-add \{([^}]*)\}/.exec(css)?.[1] ?? '';
    expect(rule).toContain('inline-size: 100%');
    expect(rule).toContain('justify-content: center');
    expect(rule).not.toContain('inline-flex');
  });
});
