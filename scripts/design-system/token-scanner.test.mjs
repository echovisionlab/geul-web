import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { Linter } from 'eslint';
import { authoredColorFiles, isProductionSource } from './token-policy.mjs';
import { baselineFrom, compareBaseline, readKnownTokens, scanSource } from './token-scanner.mjs';
import { createPolicyReader, designTokensPlugin } from '../../eslint-rules/design-tokens.mjs';

const known = new Set(['--geul-text-primary', '--geul-space-sm']);

test('the locale font authority owns only the two closed font roles and retains other checks', () => {
  const tokens = new Set([...known, '--font-family-sans', '--font-mono']);
  const valid = `:root { --font-family-sans: 'Noto Sans'; --font-mono: monospace; }
    html[data-font-profile='arabic'] { --font-family-sans: 'Noto Sans Arabic'; }`;
  assert.equal(scanSource('lib/styles/font-assignment.css', valid, tokens).findings.length, 0);
  assert.equal(scanSource('features/example.css', valid, tokens).findings.length, 3);
  const invalid = scanSource(
    'lib/styles/font-assignment.css',
    ':root { --font-extra: monospace; color: #123456; padding: 13px; }',
    tokens,
  );
  assert.deepEqual(
    invalid.findings.map(({ kind }) => kind),
    ['custom-token', 'raw-color', 'raw-spacing'],
  );
});

test('font roles come from the shared assignment and unknown font references fail without a baseline allowance', () => {
  const tokens = readKnownTokens(new URL('../../', import.meta.url).pathname);
  assert.ok(tokens.has('--font-mono'));
  assert.ok(tokens.has('--font-family-sans'));
  const valid = scanSource('components/core/Source.css', '.source { font-family: var(--font-mono); }', tokens);
  assert.equal(valid.findings.length, 0);
  for (const [file, source] of [
    ['components/core/Source.css', '.source { font-family: var(--font-family-mono), monospace; }'],
    ['features/editor/Source.tsx', "const options = { fontFamily: 'var(--font-family-mono)' };"],
    ['features/editor/Source.tsx', "element.style.setProperty('--font-family-mono', 'monospace');"],
  ]) {
    const { findings } = scanSource(file, source, tokens);
    assert.deepEqual(
      findings.map(({ kind, value }) => [kind, value]),
      [['unknown-token', '--font-family-mono']],
    );
    assert.deepEqual(baselineFrom(findings), {});
    assert.equal(compareBaseline(findings).added.length, 1);
  }
});

test('CSS declarations detect fixed and named colors, local definitions and unknown semantic references', () => {
  const result = scanSource(
    'components/core/Example.css',
    `
    /* #fff is only documentation */
    .control { color: var(--geul-text-primary); gap: var(--geul-space-sm); }
    .bad { background: red; border: 1px solid #fff; color: oklch(50% .2 20); --shared: var(--geul-typo); }
    .private { --_hover: var(--geul-text-primary); color: rgb(var(--geul-channel)); }
  `,
    known,
  );
  assert.deepEqual(
    result.findings.map(({ kind, value }) => [kind, value]),
    [
      ['raw-color', 'red'],
      ['raw-color', '#fff'],
      ['raw-color', 'oklch(50% .2 20)'],
      ['custom-token', '--shared'],
      ['unknown-token', '--geul-typo'],
      ['unknown-token', '--geul-channel'],
    ],
  );
});

test('authored editor roles require a generated definition and cannot be invented by consumers', () => {
  const tokens = new Set(['--editor-text-color-red']);
  assert.equal(
    scanSource('features/example.css', '.content { color: var(--editor-text-color-red); }', tokens).findings.length,
    0,
  );
  for (const [file, source] of [
    ['features/example.css', '.content { color: var(--editor-text-color-missing); }'],
    ['features/example.ts', "element.style.setProperty('--editor-text-color-missing', 'inherit');"],
  ]) {
    const { findings } = scanSource(file, source, tokens);
    assert.deepEqual(
      findings.map(({ kind, value }) => [kind, value]),
      [['unknown-token', '--editor-text-color-missing']],
    );
    assert.deepEqual(baselineFrom(findings), {});
  }
});

test('the validated branding adapter owns only its registered site identity role', () => {
  const tokens = new Set([...known, '--geul-brand-color']);
  const assignment = "const style = {'--geul-brand-color': normalizeSiteBrandColor(value)};";
  assert.equal(scanSource('lib/theme/site-brand.ts', assignment, tokens).findings.length, 0);
  assert.equal(scanSource('features/example.ts', assignment, tokens).findings[0]?.kind, 'custom-token');
  assert.equal(scanSource('lib/theme/site-brand.ts', assignment, known).findings[0]?.kind, 'custom-token');
  assert.equal(
    scanSource('lib/theme/site-brand.ts', "const style = {'--geul-text-primary': value};", tokens).findings[0]?.kind,
    'custom-token',
  );
});

test('TypeScript parses inline styles, templates and custom definitions but ignores comments and regex', () => {
  const result = scanSource(
    'features/example/View.tsx',
    `
    // #fff should not count
    const regex = /#[a-f0-9]{6}/;
    const view = <div style={{ color: '#fff', '--new-local': '1rem' }} />;
    const text = \`background: rgb(10 20 30); color: var(--geul-missing); \${view}\`;
  `,
    known,
  );
  assert.deepEqual(
    result.findings.map(({ kind, value }) => [kind, value]),
    [
      ['raw-color', '#fff'],
      ['custom-token', '--new-local'],
      ['raw-color', 'rgb(10 20 30)'],
      ['unknown-token', '--geul-missing'],
    ],
  );
});

test('migration allowance survives moved lines but catches duplicated occurrences and edits', () => {
  const original = scanSource('features/example.css', '.a {color: #fff}', known).findings;
  const baseline = baselineFrom(original);
  assert.equal(
    compareBaseline(scanSource('features/example.css', '\n\n.a {color: #fff}', known).findings, baseline).added.length,
    0,
  );
  assert.equal(
    compareBaseline(scanSource('features/example.css', '.a {color: #fff}.b {color: #fff}', known).findings, baseline)
      .added.length,
    1,
  );
  assert.equal(
    compareBaseline(scanSource('features/example.css', '.a {color: #000}', known).findings, baseline).added.length,
    1,
  );
  assert.equal(compareBaseline([], baseline).stale.length, 1);
});

test('unknown references and parse failures cannot be approved by a baseline', () => {
  for (const source of ['.a {color: var(--geul-typo)}', '.a { color: #fff;']) {
    const { findings } = scanSource('features/example.css', source, known);
    assert.deepEqual(baselineFrom(findings), {});
    assert.equal(compareBaseline(findings).added.length, 1);
  }
});

test('authored palettes remain distinct while definitions and semantic references are enforced', () => {
  assert.ok(authoredColorFiles.has('components/core/Social/brand-colors.ts'));
  const result = scanSource(
    'components/core/Social/brand-colors.ts',
    `const palette = {color: '#fff', '--new': 'var(--geul-typo)'};`,
    known,
  );
  assert.deepEqual(
    result.findings.map(({ kind }) => kind),
    ['custom-token', 'unknown-token'],
  );
  const reference = scanSource('components/core/Social/brand-colors.ts', `const color = 'var(--geul-typo)';`, known);
  assert.equal(reference.findings[0].kind, 'unknown-token');
});

test('dimension audit counts spacing without pretending every geometry value is a violation', () => {
  const result = scanSource(
    'features/example.css',
    '.a {padding: 4px 0; margin-top: 1rem; min-height: 20px; transform: translateX(2px)}',
    known,
  );
  assert.deepEqual(
    result.findings.map(({ kind, value }) => [kind, value]),
    [
      ['raw-spacing', '4px'],
      ['raw-spacing', '1rem'],
    ],
  );
  assert.deepEqual(
    result.dimensions.map(({ value }) => value),
    ['4px', '1rem', '20px'],
  );
});

test('scanner excludes stories, fixtures, tests, generated and vendor sources', () => {
  for (const file of [
    'features/ui/A.stories.tsx',
    'features/A.story-fixtures.ts',
    'features/A.test.ts',
    'components/core/Layout/Layout.type-test.tsx',
    'lib/generated/model.ts',
    'features/vendor/player.css',
    'features/fixtures/data.ts',
    'components/core/A.stories.module.css',
  ]) {
    assert.equal(isProductionSource(file), false, file);
  }
  assert.equal(isProductionSource('features/example/View.tsx'), true);
});

test('ESLint reports new interface literals using the same scanner and baseline policy', () => {
  const linter = new Linter();
  const config = [
    {
      files: ['**/*.ts'],
      plugins: { 'design-tokens': designTokensPlugin },
      rules: { 'design-tokens/no-new-literals': 'error' },
    },
  ];
  const result = linter.verify("const color = '#123456';", config, { filename: 'features/token-policy-fixture.ts' });
  assert.equal(result.length, 1);
  assert.equal(result[0].ruleId, 'design-tokens/no-new-literals');
  assert.equal(result[0].severity, 2);
});

test('spacing rules exempt zero, relative percentages and geometry; type sizes are their own finding', () => {
  const css =
    '.a {padding: 0 0px 10%; margin: inherit; gap: var(--geul-space-sm); font-size: 1rem; line-height: 1.5; width: 200px}';
  const findings = scanSource('features/example.css', css, known).findings;
  assert.deepEqual(
    findings.map(({ kind, value }) => [kind, value]),
    [
      ['raw-font-size', '1rem'],
      ['raw-font-size', '1.5'],
    ],
  );
  // print.css no longer owns literal paper typography: the token generator projects the paper scale.
  assert.equal(scanSource('lib/styles/print.css', css, known).findings.length, 2);
});

test('literal type sizes fail in every unit, keyword and print rule, while roles, zero and inherit pass', () => {
  const css = `.ok { font-size: var(--geul-font-size-sm); line-height: var(--geul-line-height-sm); }
    .ok2 { font-size: inherit; font: inherit; line-height: 0; font-size: 0; }
    .ok3 { font-size: max(var(--_input-font), var(--geul-font-size-md)); }
    .bad { font-size: 11pt; font-size: 90%; font-size: small; font-size: clamp(var(--geul-font-size-xs), 0.9vw, 1rem); }
    .bad2 { font: 600 12px/1.4 sans-serif; line-height: 1.45 !important; }
    @media print { .paper { font-size: 8.5pt; } }`;
  const tokens = new Set([
    ...known,
    '--geul-font-size-xs',
    '--geul-font-size-sm',
    '--geul-font-size-md',
    '--geul-line-height-sm',
  ]);
  assert.deepEqual(
    scanSource('features/example.css', css, tokens).findings.map(({ kind, value }) => [kind, value]),
    [
      ['raw-font-size', '11pt'],
      ['raw-font-size', '90%'],
      ['raw-font-size', 'small'],
      ['raw-font-size', '0.9vw'],
      ['raw-font-size', '1rem'],
      ['raw-font-size', '12px'],
      ['raw-font-size', '1.45'],
      ['raw-font-size', '8.5pt'],
    ],
  );
});

test('TS type sizes in style objects, option objects, DOM and canvas assignments are literal findings', () => {
  const source = `
    const a = <span style={{ fontSize: 12, lineHeight: '1.4', padding: 'var(--geul-spacing-xs)' }} />;
    const b = <span style={{ fontSize: 'var(--geul-font-size-xs)', lineHeight: 'var(--geul-line-height-xs)' }} />;
    const options = { fontSize: 13, lineHeight: tokens.lineHeight };
    label.style.fontSize = '11px';
    label.style.setProperty('font-size', '0.7rem');
    context.font = \`800 180px \${family}\`;
    label.style.fontSize = 'var(--geul-font-size-xs)';
  `;
  const tokens = new Set([...known, '--geul-spacing-xs', '--geul-font-size-xs', '--geul-line-height-xs']);
  assert.deepEqual(
    scanSource('features/example.tsx', source, tokens).findings.map(({ kind, value, context }) => [
      kind,
      value,
      context,
    ]),
    [
      ['raw-font-size', '12', 'fontSize'],
      ['raw-font-size', '1.4', 'lineHeight'],
      ['raw-font-size', '13', 'fontSize'],
      ['raw-font-size', '11px', 'fontSize'],
      ['raw-font-size', '0.7rem', 'font-size'],
      ['raw-font-size', '180px', 'font'],
    ],
  );
  // Authored artwork exceptions are named files, not a property-wide allowance.
  assert.equal(scanSource('lib/utils/og-image.tsx', source, tokens).findings.length, 0);
});

test('legacy variable file has no permission to introduce new tokens or raw color definitions', () => {
  const findings = scanSource('lib/styles/variables.css', ':root {--geul-new: #123456}', known).findings;
  assert.deepEqual(
    findings.map(({ kind }) => kind),
    ['raw-color', 'custom-token'],
  );
});

test('CSS asset fragments and displayed text are not mistaken for colors; token fallbacks are checked', () => {
  const findings = scanSource(
    'features/example.css',
    '.a { background: url("icon.svg#abcdef"); content: "#fff"; color: var(--geul-text-primary, red) }',
    known,
  ).findings;
  assert.deepEqual(
    findings.map(({ kind, value }) => [kind, value]),
    [['raw-color', 'red']],
  );
});

test('print media and page geometry are exempt from spacing while screen spacing and paper type remain enforced', () => {
  const findings = scanSource(
    'features/example.css',
    '@media print { .a {padding: 9px; font-size: 12px} } @page {margin: 10px} @media screen { .a {padding: 9px} }',
    known,
  ).findings;
  assert.deepEqual(
    findings.map(({ kind, value }) => [kind, value]),
    [
      ['raw-font-size', '12px'],
      ['raw-spacing', '9px'],
    ],
  );
});

test('runtime CSS setters require registered tokens while private and upstream variables remain permitted', () => {
  const findings = scanSource(
    'features/example.ts',
    `
    element.style.setProperty('--geul-text-primary', 'inherit');
    element.style.setProperty('--geul-unregistered', 'inherit');
    element.style['setProperty']('--unregistered', '1px');
    element.style.setProperty('--_private', '1px');
    element.style.setProperty('--mantine-color-text', 'inherit');
  `,
    known,
  ).findings;
  assert.deepEqual(
    findings.map(({ kind, value }) => [kind, value]),
    [
      ['unknown-token', '--geul-unregistered'],
      ['custom-token', '--unregistered'],
    ],
  );
});

test('theme bridge may reference canonical tokens but cannot introduce another literal palette', () => {
  const findings = scanSource(
    'theme.ts',
    `const color = '#123456'; const overrides = {'--mantine-color-text': 'var(--geul-text-primary)'};`,
    known,
  ).findings;
  assert.deepEqual(
    findings.map(({ kind, value }) => [kind, value]),
    [['raw-color', '#123456']],
  );
});

test('case-insensitive CSS units and function/property spelling cannot bypass enforcement', () => {
  const findings = scanSource(
    'features/example.css',
    '.a { PADDING: 13REM; color: VAR(--geul-unregistered) }',
    known,
  ).findings;
  assert.deepEqual(
    findings.map(({ kind, value }) => [kind, value]),
    [
      ['raw-spacing', '13rem'],
      ['unknown-token', '--geul-unregistered'],
    ],
  );
});

test('editor policy refreshes token and baseline changes and fails closed when allowance disappears', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'geul-token-policy-'));
  try {
    fs.mkdirSync(path.join(root, 'lib/styles'), { recursive: true });
    fs.mkdirSync(path.join(root, 'scripts/design-system'), { recursive: true });
    const css = path.join(root, 'lib/styles/design-tokens.css');
    const baseline = path.join(root, 'scripts/design-system/token-baseline.json');
    fs.writeFileSync(css, ':root {--geul-first: inherit}');
    fs.writeFileSync(baseline, JSON.stringify({ entries: {} }));
    const read = createPolicyReader(root);
    assert.deepEqual([...read().tokens], ['--geul-first']);
    fs.writeFileSync(css, ':root {--geul-first: inherit; --geul-second: inherit}');
    assert.ok(read().tokens.has('--geul-second'));
    const fonts = path.join(root, 'lib/styles/font-assignment.css');
    fs.writeFileSync(fonts, ':root {--font-mono: monospace}');
    assert.ok(read().tokens.has('--font-mono'));
    fs.writeFileSync(fonts, ':root {--font-family-sans: sans-serif}');
    assert.equal(read().tokens.has('--font-mono'), false);
    assert.ok(read().tokens.has('--font-family-sans'));
    fs.writeFileSync(css, ':root {--geul-first: inherit; --editor-text-color-red: #c62828}');
    assert.ok(read().tokens.has('--editor-text-color-red'));
    fs.writeFileSync(fonts, ':root {--font-family-sans: sans-serif; --font-typo: monospace}');
    assert.equal(read().tokens.has('--font-typo'), false);
    const unexpectedFont = scanSource('lib/styles/font-assignment.css', fs.readFileSync(fonts, 'utf8'), read().tokens);
    assert.deepEqual(
      unexpectedFont.findings.map(({ kind, value }) => [kind, value]),
      [['custom-token', '--font-typo']],
    );
    fs.writeFileSync(baseline, JSON.stringify({ entries: { approved: 1 } }));
    assert.deepEqual(read().baseline, { approved: 1 });
    fs.unlinkSync(baseline);
    assert.deepEqual(read().baseline, {});
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

const spacingKnown = new Set([...known, '--geul-spacing-xs', '--geul-spacing-md']);

test('logical inset offsets follow the spacing scale while em glyph offsets stay with their text', () => {
  const findings = scanSource(
    'features/example.css',
    `.error { position: absolute; inset: auto 8px 8px; }
     .mark { inset-inline-end: 1.625rem; inset-block-start: 0.3em; }
     .ok { inset: auto var(--geul-spacing-xs) var(--geul-spacing-xs); inset-inline-start: 0; }`,
    spacingKnown,
  ).findings;
  assert.deepEqual(
    findings.map(({ kind, value, context }) => [kind, value, context]),
    [
      ['raw-spacing', '8px', 'inset'],
      ['raw-spacing', '8px', 'inset'],
      ['raw-spacing', '1.625rem', 'inset-inline-end'],
    ],
  );
});

test('inline JSX style spacing rejects literals but accepts tokens, zero, auto and authored values', () => {
  const findings = scanSource(
    'features/example.tsx',
    `export const A = ({ gap, preview }) => (
      <>
        <div style={{ position: 'absolute', insetBlockStart: 8, insetInlineEnd: -4 }} />
        <div style={{ padding: preview ? '6px 8px' : 'var(--geul-spacing-xs)', marginTop: 24 }} />
        <div style={{ gap: \`\${gap}px\`, margin: 0, marginInline: 'auto', inset: 0 }} />
        <div style={{ paddingBlock: 'var(--geul-spacing-md)', width: 320 }} />
      </>
    );`,
    spacingKnown,
  ).findings;
  assert.deepEqual(
    findings.map(({ kind, value, context }) => [kind, value, context]),
    [
      ['raw-spacing', '8', 'style.insetBlockStart'],
      ['raw-spacing', '-4', 'style.insetInlineEnd'],
      ['raw-spacing', '6px', 'style.padding'],
      ['raw-spacing', '8px', 'style.padding'],
      ['raw-spacing', '24', 'style.marginTop'],
    ],
  );
  assert.equal(
    scanSource(
      'features/page/blocks/immersive-scene/SceneRenderer.tsx',
      "export const S = () => <div style={{ padding: 'clamp(32px, 7vw, 96px)' }} />;",
      spacingKnown,
    ).findings.length,
    0,
  );
});
