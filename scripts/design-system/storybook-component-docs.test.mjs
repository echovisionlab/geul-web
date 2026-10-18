import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import guidance from '../../stories/design-system/components/component-guidance.mjs';
import {
  createSourceResolver,
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

test('malformed or dynamic metadata fails instead of silently dropping a Core group', () => {
  assert.throws(() => parseComponentStory('broken.tsx', 'export default { title:'), /broken/);
  assert.throws(
    () => parseComponentStory('dynamic.tsx', 'export default {title: computeTitle()}'),
    /literal story title/,
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

test('missing direct or transitive local CSS files fail instead of publishing incomplete token docs', (t) => {
  const root = fixtureRoot(t, {
    'lib/styles/design-tokens.css': `:root { --geul-gap: 4px; }`,
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
    'lib/styles/design-tokens.css': `:root { --geul-gap: 4px; }`,
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
