import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// D-130: an event card contains its own resize handles and is dragged, so a press-down transform on
// the card itself (`:active`) is true for the entire gesture and makes the card jitter.
const css = ['editor', 'month', 'timegrid']
  .map((name) => readFileSync(`src/ui/styles/${name}.css`, 'utf8'))
  .join('\n')
  .replace(/\/\*[\s\S]*?\*\//g, '');

interface Rule {
  readonly selector: string;
  readonly body: string;
}

const rules: Rule[] = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({
  selector: (m[1] ?? '').trim(),
  body: m[2] ?? '',
}));

// `.bar` or `.block` as a whole class name (not `.block-resize`, not `.toast-bar`).
const isCard = (selector: string): boolean =>
  selector
    .split(',')
    .some((part) => /(^|[\s>+~])(button)?\.(bar|block)(?![\w-])/.test(part.trim()));

describe('event cards stay still while pressed (D-130)', () => {
  it('finds the card rules it is meant to check', () => {
    expect(rules.filter((r) => isCard(r.selector)).length).toBeGreaterThan(5);
  });

  it('no :active rule on a bar or a block changes its size', () => {
    for (const { selector, body } of rules) {
      if (isCard(selector) && selector.includes(':active')) {
        expect(body, selector).not.toMatch(/transform|scale|translate/);
      }
    }
  });

  it('bars and blocks do not animate transform', () => {
    for (const { selector, body } of rules) {
      if (isCard(selector)) expect(body, selector).not.toMatch(/transition:[^;]*transform/);
    }
  });
});
