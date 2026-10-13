import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import postcss from 'postcss';
import {
  authoredEditorPalettes,
  derivedTokenRoles,
  primitiveTokens,
  semanticThemes,
} from '../../components/core/design-tokens.ts';

const repository = new URL('../../', import.meta.url);
const css = readFileSync(new URL('lib/styles/design-tokens.css', repository), 'utf8');
const rules = [];
postcss.parse(css).walkRules((rule) => rules.push(rule));
const values = (rule) =>
  Object.fromEntries(rule.nodes.filter((node) => node.type === 'decl').map(({ prop, value }) => [prop, value]));

test('generated authored palettes preserve durable names in explicit and system themes', () => {
  for (const [selector, mode] of [
    [':root', 'light'],
    ["html:not([data-geul-theme='light'])", 'dark'],
    ["[data-geul-theme='light']", 'light'],
    ["[data-geul-theme='dark']", 'dark'],
  ]) {
    const rule = rules.find((candidate) => candidate.selector === selector);
    assert.ok(rule, selector);
    const declarations = values(rule);
    for (const [name, color] of Object.entries(authoredEditorPalettes[mode])) {
      assert.equal(declarations[`--editor-${name}`], color, `${selector}: ${name}`);
    }
  }
});

test('print projects the light semantic roles over explicit dark themes and custom presets', () => {
  const print = rules.find((rule) => rule.parent.type === 'atrule' && rule.parent.params === 'print');
  assert.ok(print);
  assert.deepEqual(
    print.selectors.map((selector) => selector.trim()),
    [':root', '[data-geul-theme]'],
  );
  const declarations = Object.fromEntries(
    print.nodes.filter((node) => node.type === 'decl').map((node) => [node.prop, node]),
  );
  for (const [name, color] of Object.entries(semanticThemes.light)) {
    assert.equal(declarations[`--geul-${name}`]?.important, true, name);
    assert.equal(declarations[`--geul-${name}`]?.value.replace(/\s+/gu, ' '), color.replace(/\s+/gu, ' '), name);
  }
});

test('responsive anchor clearance follows the same Core header breakpoint', () => {
  const responsive = rules.find(
    (rule) => rule.parent.type === 'atrule' && rule.parent.params === `(min-width: ${primitiveTokens.breakpoints.sm})`,
  );
  assert.ok(responsive);
  assert.equal(values(responsive)['--geul-chrome-scroll-offset'], 'var(--geul-chrome-header-height-sm)');
  assert.equal(
    values(rules.find((rule) => rule.selector === ':root'))['--geul-chrome-scroll-offset'],
    'var(--geul-chrome-header-height-base)',
  );
});

test('breakpoints are projected to PostCSS and JavaScript, not to unusable CSS variables', () => {
  const declarations = values(rules.find((rule) => rule.selector === ':root'));
  assert.deepEqual(
    Object.keys(declarations).filter((name) => name.startsWith('--geul-breakpoints-')),
    [],
  );
  const projection = JSON.parse(readFileSync(new URL('lib/styles/design-breakpoints.json', repository), 'utf8'));
  for (const [name, value] of Object.entries(primitiveTokens.breakpoints)) {
    assert.equal(projection[`mantine-breakpoint-${name}`], value, name);
  }
});

test('layer scale is ordered and projected to CSS', () => {
  const declarations = values(rules.find((rule) => rule.selector === ':root'));
  const order = ['sticky', 'backdrop', 'modal', 'banner', 'floating', 'popup', 'toast', 'tooltip', 'progress'];
  assert.deepEqual(Object.keys(primitiveTokens.layer), order);
  const numbers = order.map((name) => Number(primitiveTokens.layer[name]));
  for (let index = 1; index < numbers.length; index++) {
    assert.ok(numbers[index] > numbers[index - 1], `${order[index]} must stack above ${order[index - 1]}`);
  }
  for (const name of order) assert.equal(declarations[`--geul-layer-${name}`], primitiveTokens.layer[name]);
});

test('generated CSS and breakpoint projections match their authority', () => {
  const check = spawnSync(process.execPath, ['scripts/design-system/generate-tokens.mjs', '--check'], {
    cwd: repository,
    encoding: 'utf8',
  });
  assert.equal(check.status, 0, `${check.stdout}\n${check.stderr}`);
});

test('derived geometry and typography roles follow their foundation in JS and CSS', () => {
  const foundation = Object.fromEntries(
    Object.entries(primitiveTokens)
      .filter(([category]) => category !== 'colors')
      .flatMap(([category, entries]) => {
        const prefix = category.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`);
        return Object.entries(entries).map(([name, value]) => [`${prefix}-${name}`, value]);
      }),
  );
  const declarations = values(rules.find((rule) => rule.selector === ':root'));
  for (const [role, scale] of Object.entries(derivedTokenRoles)) {
    assert.equal(foundation[role], foundation[scale], `${role} must follow ${scale}`);
    assert.equal(declarations[`--geul-${role}`], `var(--geul-${scale})`);
    assert.ok(!Object.hasOwn(derivedTokenRoles, scale), 'Roles reference foundations directly, not alias chains');
  }
});

test('responsive headings precede the paper type scale so print replaces every screen size', async () => {
  const { printTokens, responsiveTokens } = await import('../../components/core/design-tokens.ts');
  const media = [];
  postcss.parse(css).walkAtRules('media', (rule) => media.push(rule));
  const responsiveIndex = media.findIndex((rule) => rule.params === `(min-width: ${primitiveTokens.breakpoints.sm})`);
  const paperIndex = media.findIndex(
    (rule) => rule.params === 'print' && rule.nodes.some((node) => values(node)['--geul-font-size-md']),
  );
  assert.ok(responsiveIndex >= 0 && paperIndex > responsiveIndex);
  const responsive = values(media[responsiveIndex].nodes[0]);
  for (const [role, value] of Object.entries(responsiveTokens.sm)) assert.equal(responsive[`--geul-${role}`], value);
  const paper = values(media[paperIndex].nodes[0]);
  for (const [role, value] of Object.entries(printTokens)) assert.equal(paper[`--geul-${role}`], value);
  assert.equal(
    values(rules.find((rule) => rule.selector === ':root'))['--geul-heading-title'],
    primitiveTokens.heading.title,
  );
});
