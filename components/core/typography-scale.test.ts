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
/** One step on the shared text scale (md 16 → lg 18). */
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
});
