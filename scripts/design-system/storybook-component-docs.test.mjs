import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import guidance from '../../stories/design-system/components/component-guidance.mjs';
import {
  createSourceResolver,
  extractImplementationDefaults,
  extractPublicApi,
  parseComponentStory,
  collectComponentTokenReferences,
  readDesignTokenDefinitions,
  validateComponentCoverage,
} from './storybook-component-docs.mjs';

function fixtureRoot(t, sources) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'geul-component-docs-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const [file, source] of Object.entries(sources)) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), source);
  }
  return root;
}
const fixture = (t, sources) => createSourceResolver(fixtureRoot(t, sources));
const prop = (result, name) => result.api.find((item) => item.name === name);

test('CSF parsing preserves actual names and export IDs without evaluating render code', () => {
  const story = parseComponentStory(
    'Button.stories.tsx',
    `
    const meta = {title: 'Core/Actions/Button', component: Button, excludeStories: ['helper']} satisfies Meta;
    export default meta;
    export const LongLabel = {name: '긴 문구', render: () => { throw new Error('must not execute'); }};
    export const Pending = {};
    export const helper = () => null;
  `,
  );
  assert.equal(story.component, 'Button');
  assert.deepEqual(story.stateStories, [
    { id: 'core-actions-button--long-label', name: '긴 문구' },
    { id: 'core-actions-button--pending', name: 'Pending' },
  ]);
});

test('include/exclude regular expressions restrict the documented state exports', () => {
  const story = parseComponentStory(
    'Choice.stories.tsx',
    `
    export default {title: 'Core/Input/Checkbox', includeStories: /^State/, excludeStories: /Hidden$/};
    export const StateChecked = {};
    export const StateHidden = {};
    export const helper = {};
  `,
  );
  assert.deepEqual(story.stateStories, [{ id: 'core-input-checkbox--state-checked', name: 'State Checked' }]);
});

test('generic instantiation in CSF identifies the production component rather than a fixture', () => {
  const story = parseComponentStory(
    'MultiSelect.stories.tsx',
    `
    export default { title: 'Core/Input/MultiSelectComboboxView', component: MultiSelectComboboxView<ExampleItem> };
    export const Default = {};
  `,
  );
  assert.equal(story.component, 'MultiSelectComboboxView');
});

test('malformed or dynamic metadata fails instead of silently dropping a Core group', () => {
  assert.throws(() => parseComponentStory('broken.tsx', 'export default { title:'), /broken/);
  assert.throws(
    () => parseComponentStory('dynamic.tsx', 'export default {title: computeTitle()}'),
    /literal story title/,
  );
});

test('barrels and aliased local interfaces resolve; omitted presentation props stay omitted', (t) => {
  const resolver = fixture(t, {
    'core/base.ts': `export interface Base { id?: string; style?: never; value: string; }`,
    'core/Button.ts': `import type {Base as Native} from './base'; export interface ButtonProps extends Omit<Native, 'id'> { label: string; }`,
    'core/index.ts': `export type {ButtonProps as PublicProps} from './Button';`,
  });
  const result = extractPublicApi(resolver, 'core/index.ts', 'PublicProps');
  assert.equal(prop(result, 'id'), undefined);
  assert.equal(prop(result, 'style').type, 'never');
  assert.equal(prop(result, 'value').required, true);
  assert.equal(prop(result, 'label').required, true);
  assert.deepEqual(result.unresolved, []);
  assert.deepEqual(result.sourceFiles, ['core/Button.ts', 'core/base.ts']);
});

test('ordinary TypeScript generic arrows are parsed as TS rather than JSX', (t) => {
  const resolver = fixture(t, {
    'core/runner.ts': `export const identity = <Value>(value: Value): Value => value; export interface RunnerProps { value: string; }`,
  });
  assert.equal(prop(extractPublicApi(resolver, 'core/runner.ts', 'RunnerProps'), 'value').type, 'string');
});

test('local scalar aliases expose their actual allowed values without expanding external types', (t) => {
  const resolver = fixture(t, {
    'core/roles.ts': `export type Tone = 'neutral' | 'danger'; export type Small = 'xs' | 'sm'; export type Size = Small | 'md';`,
    'core/Input.ts': `import type {Tone, Size} from './roles'; export interface InputProps { tone?: Tone; size?: Size; event?: ExternalEvent; }`,
  });
  const result = extractPublicApi(resolver, 'core/Input.ts', 'InputProps');
  assert.equal(prop(result, 'tone').type, "'neutral' | 'danger'");
  assert.equal(prop(result, 'size').type, "'xs' | 'sm' | 'md'");
  assert.equal(prop(result, 'event').type, 'ExternalEvent');
  assert.ok(result.sourceFiles.includes('core/roles.ts'));
});

test('union required and forbidden branch handling does not claim all names or href are optional', (t) => {
  const resolver = fixture(t, {
    'core/Icon.ts': `
      type Name = { label: string; 'aria-label'?: never } | { label?: never; 'aria-label': string };
      type Shared = { disabled?: boolean };
      export type IconProps = Shared & Name & ({ href: string; type?: never } | { href?: never; type?: 'button' });
    `,
  });
  const result = extractPublicApi(resolver, 'core/Icon.ts', 'IconProps');
  assert.equal(prop(result, 'label').required, false);
  assert.equal(prop(result, 'label').type, 'string');
  assert.match(prop(result, 'label').description, /union branch/);
  assert.equal(prop(result, 'href').required, false);
  assert.match(prop(result, 'href').description, /union branch/);
  assert.equal(prop(result, 'type').type, "'button'");
  assert.equal(prop(result, 'disabled').required, false);
});

test('external inherited and unknown mapped types are explicitly unresolved, never made up', (t) => {
  const resolver = fixture(t, {
    'core/Input.ts': `import type {AriaAttributes} from 'react'; type Derived<T> = {[K in keyof T]: T[K]}; export interface InputProps extends AriaAttributes, Derived<unknown> { value: string; }`,
  });
  const result = extractPublicApi(resolver, 'core/Input.ts', 'InputProps');
  assert.equal(prop(result, 'value').required, true);
  assert.equal(prop(result, 'aria-label'), undefined);
  assert.ok(result.unresolved.some((item) => item.includes('AriaAttributes')));
  assert.ok(result.unresolved.some((item) => item.includes('[K in keyof T]')));
});

test('implementation defaults exclude unrelated functions, fixtures and internal fallbacks', () => {
  const source = `
    const args = { tone: 'danger' };
    function unrelated({tone = 'warning'}: OtherProps) {}
    function ButtonInner({tone = 'neutral', size: requestedSize, loading = false}: ButtonProps) {
      const size = requestedSize ?? 'sm';
    }
    export const Other = forwardRef<HTMLDivElement, OtherProps>(({tone = 'positive'}, ref) => null);
  `;
  assert.deepEqual(
    [...extractImplementationDefaults('Button.tsx', source, 'ButtonProps')],
    [
      ['tone', "'neutral'"],
      ['loading', 'false'],
    ],
  );
});

test('forwardRef destructuring defaults are extracted using the exact public props generic', () => {
  const source = `export const Text = forwardRef<HTMLElement, TextProps>(({size = 'md', as = 'div'}, ref) => null);`;
  assert.deepEqual(
    [...extractImplementationDefaults('Text.tsx', source, 'TextProps')],
    [
      ['size', "'md'"],
      ['as', "'div'"],
    ],
  );
});

test('coverage rejects omitted, stale, duplicate and outdated state documents', () => {
  const stories = [
    { title: 'Core/Actions/Button', stateStories: [{ id: 'core-actions-button--default', name: 'Default' }] },
  ];
  const valid = {
    title: 'Core/Actions/Button',
    sourceFiles: ['Button.tsx'],
    summary: 'purpose',
    api: [],
    stateStories: stories[0].stateStories,
    usage: ['use'],
    accessibility: ['name'],
    constraints: ['closed'],
    relatedDocs: ['contract.md'],
  };
  assert.deepEqual(validateComponentCoverage(stories, [valid], { [valid.title]: {} }), []);
  assert.match(validateComponentCoverage(stories, []).join('\n'), /Missing component documentation/);
  assert.match(validateComponentCoverage(stories, [valid, valid]).join('\n'), /Duplicate component documentation/);
  assert.match(
    validateComponentCoverage(stories, [{ ...valid, title: 'Core/Actions/OldButton' }]).join('\n'),
    /Stale component documentation/,
  );
  assert.match(validateComponentCoverage(stories, [{ ...valid, stateStories: [] }]).join('\n'), /state story IDs/);
  assert.match(
    validateComponentCoverage(stories, [valid], { [valid.title]: {}, 'Core/Actions/Deleted': {} }).join('\n'),
    /Stale component guidance/,
  );
});

test('component tokens follow direct CSS imports and local CSS imports without traversing TS barrels', (t) => {
  const root = fixtureRoot(t, {
    'node_modules/@echovisionlab/design-system/src/tokens.css': `:root { --geul-gap: 8px; --geul-surface: #fff; --geul-ink: var(--geul-surface); } [data-geul-theme='dark'] { --geul-surface: #000; }`,
    'components/core/Button.tsx': `import classes from './Button.module.css'; import {anything} from './Unrelated'; export const value = {color: 'var(--geul-ink)'};`,
    'components/core/Button.module.css': `@import 'Shared.css'; .root { gap: var(--geul-gap); }`,
    'components/core/Shared.css': `@import url('./Button.module.css'); .shared { background: var(--geul-surface); }`,
    'components/core/Unrelated.tsx': `import './Unrelated.css'; export const anything = 1;`,
    'components/core/Unrelated.css': `.unrelated { color: var(--geul-unrelated); }`,
    'components/core/Button.stories.tsx': `import './Unrelated.css'; const fake = 'var(--geul-story-only)';`,
  });
  const result = collectComponentTokenReferences(root, [
    'components/core/Button.tsx',
    'components/core/Button.stories.tsx',
  ]);
  assert.deepEqual(
    result.tokenReferences.map((item) => item.name),
    ['--geul-gap', '--geul-ink', '--geul-surface'],
  );
  assert.deepEqual(result.styleSources, [
    {
      file: 'components/core/Button.module.css',
      importedBy: ['components/core/Button.tsx', 'components/core/Shared.css'],
    },
    { file: 'components/core/Shared.css', importedBy: ['components/core/Button.module.css'] },
  ]);
  assert.deepEqual(result.tokenReferences.find((item) => item.name === '--geul-ink').sources, [
    { file: 'components/core/Button.tsx', line: 1, property: 'color' },
  ]);
  assert.deepEqual(result.tokenReferences.find((item) => item.name === '--geul-gap').sources, [
    { file: 'components/core/Button.module.css', line: 1, property: 'gap' },
  ]);
  const surface = result.tokenReferences.find((item) => item.name === '--geul-surface');
  assert.equal(surface.registered, true);
  assert.deepEqual(
    surface.definitions.map((item) => [item.value, item.context]),
    [
      ['#fff', ':root'],
      ['#000', "[data-geul-theme='dark']"],
    ],
  );
  assert.equal(
    result.tokenReferences.find((item) => item.name === '--geul-ink').definitions[0].value,
    'var(--geul-surface)',
  );
});

test('static TS references exclude comments and computed token names remain unresolved', (t) => {
  const root = fixtureRoot(t, {
    'node_modules/@echovisionlab/design-system/src/tokens.css': `:root { --geul-surface: #fff; }`,
    'components/core/Example.ts': [
      `// var(--geul-comment-only)`,
      `const known = 'var(--geul-surface)';`,
      'const dynamic = `var(--geul-${role})`;',
      `const concat = 'var(' + '--geul-' + role + ')';`,
      'const stable = `var(--geul-surface) ${opacity}`;',
      `const fallback = 'var(--geul-unknown, var(--geul-surface))';`,
    ].join('\n'),
  });
  const result = collectComponentTokenReferences(root, ['components/core/Example.ts']);
  assert.deepEqual(
    result.tokenReferences.map((item) => item.name),
    ['--geul-surface', '--geul-unknown'],
  );
  assert.deepEqual(
    result.computedTokenReferences.map((item) => item.line),
    [3, 4],
  );
  assert.ok(result.computedTokenReferences[0].expression.includes('${role}'));
  assert.equal(result.tokenReferences.find((item) => item.name === '--geul-unknown').registered, false);
  assert.deepEqual(result.tokenReferences.find((item) => item.name === '--geul-unknown').definitions, []);
  assert.match(result.tokenReferenceLimitations.join('\n'), /Missing central declaration: --geul-unknown/);
  assert.deepEqual(
    result.tokenReferences.find((item) => item.name === '--geul-surface').sources.map((item) => item.line),
    [2, 5, 6],
  );
});

test('CSS fallback references, aliases and at-rule context preserve declaration provenance', (t) => {
  const root = fixtureRoot(t, {
    'node_modules/@echovisionlab/design-system/src/tokens.css': `:root { --geul-gap: var(--geul-small); --geul-small: 4px; } @media (any-pointer: coarse) { :root { --geul-gap: 44px; } }`,
    'components/core/Example.tsx': `import '@/components/core/Example.css';`,
    'components/core/Example.css': `/* var(--geul-comment) */ @supports (gap: var(--geul-gap)) { .root { gap: var(--geul-missing, var(--geul-small)); } }`,
  });
  const result = collectComponentTokenReferences(root, ['components/core/Example.tsx']);
  assert.deepEqual(
    result.tokenReferences.map((item) => item.name),
    ['--geul-gap', '--geul-missing', '--geul-small'],
  );
  const gap = result.tokenReferences.find((item) => item.name === '--geul-gap');
  assert.equal(gap.sources[0].property, '@supports');
  assert.deepEqual(
    gap.definitions.map((item) => item.context),
    [':root', '@media (any-pointer: coarse) → :root'],
  );
  assert.deepEqual(result.styleSources, [
    { file: 'components/core/Example.css', importedBy: ['components/core/Example.tsx'] },
  ]);
});

test('missing direct or transitive local CSS files fail instead of publishing incomplete token docs', (t) => {
  const root = fixtureRoot(t, {
    'node_modules/@echovisionlab/design-system/src/tokens.css': `:root { --geul-gap: 4px; }`,
    'components/core/Direct.tsx': `import './Missing.css';`,
    'components/core/Transitive.tsx': `import './Present.css';`,
    'components/core/Present.css': `@import './Missing.css'; .root {gap: var(--geul-gap);}`,
  });
  assert.throws(
    () => collectComponentTokenReferences(root, ['components/core/Direct.tsx']),
    /missing local CSS import/,
  );
  assert.throws(
    () => collectComponentTokenReferences(root, ['components/core/Transitive.tsx']),
    /missing local CSS import/,
  );
});

test('remote CSS imports and repository escapes are recorded but never fetched', (t) => {
  const root = fixtureRoot(t, {
    'node_modules/@echovisionlab/design-system/src/tokens.css': `:root { --geul-gap: 4px; }`,
    'components/core/Example.tsx': `import './Example.css';`,
    'components/core/Example.css': `@import url('https://example.invalid/theme.css'); @import '../../../outside.css'; .root { gap: var(--geul-gap); }`,
  });
  const result = collectComponentTokenReferences(root, ['components/core/Example.tsx']);
  assert.deepEqual(
    result.styleSources.map((item) => item.file),
    ['components/core/Example.css'],
  );
  assert.ok(result.tokenReferenceLimitations.some((item) => item.includes('https://example.invalid/theme.css')));
  assert.ok(result.tokenReferenceLimitations.some((item) => item.includes('../../../outside.css')));
});

test('missing token authority and malformed styles fail closed', (t) => {
  const root = fixtureRoot(t, {
    'components/core/Example.tsx': `import './Example.css';`,
    'components/core/Example.css': `.root { gap: var(--geul-gap);`,
  });
  assert.throws(() => readDesignTokenDefinitions(root), /Missing design token declaration file/);
  assert.throws(
    () => collectComponentTokenReferences(root, ['components/core/Example.tsx'], new Map()),
    /Unclosed block/,
  );
  assert.throws(
    () => collectComponentTokenReferences(root, ['components/core/Missing.tsx'], new Map()),
    /Missing component token source/,
  );
});
