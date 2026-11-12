import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// jsdom has no layout, so this can only pin the rule that keeps the two shortcut buttons apart.
const css = readFileSync('src/ui/styles/shell.css', 'utf8');

describe('sidebar shortcut buttons (D-154)', () => {
  it('are blocks of the full width with a gap, not bare inline buttons', () => {
    const rule = /\.sidebar > \.goto-btn \{([^}]*)\}/.exec(css)?.[1] ?? '';
    expect(rule).toContain('display: block');
    expect(rule).toContain('inline-size: 100%');
    expect(rule).toMatch(/margin-block-start: \d+px/);
  });
});
