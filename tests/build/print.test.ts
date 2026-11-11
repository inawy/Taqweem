import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// The print sheet (D-142) can only be checked for what it promises in text: jsdom does not print.
const css = readFileSync('src/ui/styles/print.css', 'utf8');
const main = readFileSync('src/main.tsx', 'utf8');

describe('print stylesheet', () => {
  it('is loaded by the app', () => {
    expect(main).toContain("'@/ui/styles/print.css'");
  });

  it('applies only when printing', () => {
    expect(css.trimStart().startsWith('/*')).toBe(true);
    const outside = css.replace(/\/\*[\s\S]*?\*\//g, '').trimStart();
    expect(outside.startsWith('@media print {')).toBe(true);
    expect(outside.trimEnd().endsWith('}')).toBe(true);
  });

  it('hides the controls and keeps the title and the colours', () => {
    for (const hidden of ['.sidebar', '.fab', '.toast', '.banner', '.modal-backdrop']) {
      expect(css).toContain(hidden);
    }
    expect(css).toContain('.topbar > :not(.topbar-title)');
    expect(css).toContain('print-color-adjust: exact');
  });

  it('lets the views grow instead of scrolling inside a fixed height', () => {
    expect(css).toMatch(/\.shell \{[^}]*block-size: auto/);
    expect(css).toMatch(/\.tg-scroll[^{]*\{[^}]*overflow: visible/);
  });

  it('shrinks the hour so a day or a week fits one page, and drops the now line', () => {
    expect(css).toMatch(/\.tg \{[^}]*--hour-h: \d+px !important/);
    expect(css).toMatch(/\.tg-body \{[^}]*break-inside: avoid/);
    expect(css).toMatch(/\.now-line \{[^}]*display: none/);
  });

  it('draws the hour lines as 24 equal slices, not a pixel-repeating gradient', () => {
    expect(css).toMatch(/\.tg-col \{[^}]*background-size: 100% calc\(100% \/ 24\)/);
  });

  it('prints the year three months across and never cuts a month in half', () => {
    expect(css).toMatch(/\.year \{[^}]*repeat\(3, minmax\(0, 1fr\)\)/);
    expect(css).toMatch(/\.year-month \{[^}]*break-inside: avoid/);
  });

  it('drops the touch sizes in the year so four rows of months fit', () => {
    expect(css).toMatch(/\.year-day \{[^}]*min-block-size: 22px/);
    expect(css).toMatch(/\.year-month-open \{[^}]*min-block-size: 28px/);
  });

  it('uses logical properties only', () => {
    expect(css).not.toMatch(
      /\b(left|right|margin-left|margin-right|padding-left|padding-right)\s*:/,
    );
  });
});
