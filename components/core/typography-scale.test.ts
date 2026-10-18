import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import postcss from 'postcss';
import { describe, expect, it } from 'vitest';
import { derivedTokenRoles, primitiveTokens, printTokens, responsiveTokens } from './design-tokens';

/** Resolves the shared type roles the way the generated CSS cascades them for one rendering state. */
function typeRoles(state: 'base' | 'sm' | 'print') {
  const roles: Record<string, string> = {};
  for (const [name, value] of Object.entries(primitiveTokens.fontSize)) {
    roles[`font-size-${name}`] = value;
  }
  for (const [name, value] of Object.entries(primitiveTokens.heading)) {
    roles[`heading-${name}`] = value;
  }
  for (const [name, value] of Object.entries(primitiveTokens.lineHeight)) {
    roles[`line-height-${name}`] = value;
  }
  for (const [role, scale] of Object.entries(derivedTokenRoles)) {
    if (role in roles) {
      roles[role] = `var(--geul-${scale})`;
    }
  }
  // Paper pages are wider than `sm`, and the print block is generated after every responsive block.
  if (state !== 'base') {
    Object.assign(roles, responsiveTokens.sm);
  }
  if (state === 'print') {
    Object.assign(roles, printTokens);
  }
  const px = (name: string): number => {
    const value = roles[name];
    const reference = /^var\(--geul-([\w-]+)\)$/u.exec(value);
    if (reference) {
      return px(reference[1]);
    }
    const amount = Number.parseFloat(value);
    if (value.endsWith('rem')) {
      return amount * 16;
    }
    if (value.endsWith('pt')) {
      return (amount * 4) / 3;
    }
    if (value.endsWith('px')) {
      return amount;
    }
    throw new Error(`${name} has no absolute size: ${value}`);
  };
  return px;
}

const states = ['base', 'sm', 'print'] as const;
/** The title's minimum step above body h1 (one 1.125 ratio). */
const STEP = 1.125;

describe('shared type scale', () => {
  it.each(states)('keeps the document title at least one scale step above body h1 (%s)', (state) => {
    const size = typeRoles(state);
    expect(size('heading-title') / size('heading-h1')).toBeGreaterThanOrEqual(STEP);
    expect(size('heading-title') - size('heading-h1')).toBeGreaterThanOrEqual(4);
  });

  it.each(states)('orders title > h1 > h2 > h3 > h4 > h5 > h6 and keeps h1–h3 above body text (%s)', (state) => {
    const size = typeRoles(state);
    const order = ['title', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'].map((name) => size(`heading-${name}`));
    for (let index = 1; index < order.length; index += 1) {
      expect(order[index - 1]).toBeGreaterThan(order[index]);
    }
    expect(size('heading-h3')).toBeGreaterThan(size('font-size-lg'));
    expect(size('heading-h4')).toBe(size('font-size-lg'));
  });

  it('uses the approved screen and paper sizes', () => {
    const names = ['heading-title', 'heading-h1', 'heading-h2', 'heading-h3', 'font-size-md'];
    const sizes = (state: (typeof states)[number]) => names.map((name) => typeRoles(state)(name));
    expect(sizes('base')).toEqual([20, 16, 15, 14, 12]);
    expect(sizes('sm')).toEqual([24, 18, 16, 14, 12]);
    // Paper: 15 / 12 / 11 / 10 / 9pt.
    expect(sizes('print').map((value) => (value * 3) / 4)).toEqual([15, 12, 11, 10, 9]);
  });

  it('renders authored headings with the same roles in the published view and the editor', () => {
    // Published headings are keyed on the authored level (`data-heading-level`), whatever element the
    // page outline gives them; materialized HTML without the attribute falls back to the element.
    const css = readFileSync(resolve(process.cwd(), 'lib/styles/document-content.css'), 'utf8');
    const rules: postcss.Rule[] = [];
    postcss.parse(css).walkRules((rule) => {
      if (rule.parent?.type === 'root') {
        rules.push(rule);
      }
    });
    for (let level = 1; level <= 6; level += 1) {
      const authored = rules.find(
        (candidate) =>
          candidate.selector.includes(`.prose :is(h1, h2, h3, h4, h5, h6)[data-heading-level='${level}']`) &&
          candidate.selector.includes(`[data-content-type='heading'][data-level='${level}']`),
      );
      // The element fallback stays at class-level specificity so a Core Heading inside `.prose` keeps its role.
      const fallback = rules.find(
        (candidate) => candidate.selector === `.prose :where(h${level}:not([data-heading-level]))`,
      );
      for (const rule of [authored, fallback]) {
        expect(rule, `h${level}`).toBeDefined();
        const declarations = Object.fromEntries(
          rule!.nodes.flatMap((node) => (node.type === 'decl' ? [[node.prop, node.value]] : [])),
        );
        expect(declarations['font-size']).toBe(`var(--geul-heading-h${level})`);
        expect(declarations['line-height']).toBe('var(--geul-heading-line-height)');
      }
    }
    // No other root rule sizes a body heading by its element alone (that would follow the demoted element).
    const elementSized = rules.filter(
      (rule) =>
        /\.prose h[1-6](?![\w:[])/u.test(rule.selector) &&
        rule.nodes.some((node) => node.type === 'decl' && node.prop === 'font-size'),
    );
    expect(elementSized.map((rule) => rule.selector)).toEqual([]);
  });

  it('leads running document text with one document role for every script, on screen and paper', () => {
    expect(primitiveTokens.lineHeight.document).toBe('1.6');
    expect(printTokens['line-height-document']).toBe('1.6');
    const css = readFileSync(resolve(process.cwd(), 'lib/styles/document-content.css'), 'utf8');
    const lineHeights = new Map<string, string>();
    postcss.parse(css).walkDecls('line-height', (declaration) => {
      const rule = declaration.parent as postcss.Rule;
      lineHeights.set(rule.selector, declaration.value);
    });
    const leadingOf = (fragment: string) =>
      [...lineHeights.entries()].find(([selector]) => selector.includes(fragment))?.[1];
    for (const fragment of [
      '.prose p,',
      ".tiptap-editor [data-content-type='paragraph']",
      ":is(.prose blockquote, .tiptap-editor [data-content-type='quote'])",
      '.prose li',
      ".tiptap-editor [data-content-type='bulletListItem']",
      '.prose .check-list-item',
      '.prose [data-callout-copy], .tiptap-editor',
    ]) {
      expect(leadingOf(fragment), fragment).toBe('var(--geul-line-height-document)');
    }
    // Dense text keeps the interface role.
    expect(leadingOf('.prose table')).toBe('var(--geul-line-height-md)');
  });
});
