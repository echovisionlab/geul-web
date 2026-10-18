import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { getStorySortParameter } from 'storybook/internal/csf-tools';

const preview = readFileSync(new URL('../../.storybook/preview.tsx', import.meta.url), 'utf8');
// Use the same independent AST extraction/evaluation as the installed Storybook indexer.
const sortStories = getStorySortParameter(preview);
const registry = JSON.parse(
  readFileSync(
    new URL('../../stories/design-system/components/component-docs.generated.json', import.meta.url),
    'utf8',
  ),
);
const entry = (title, id, name, type = 'story') => ({ title, id, name, type, importPath: './example.stories.tsx' });

test('the inline callback survives independent serialization without module closures', () => {
  assert.equal(typeof sortStories, 'function');
  const reconstructed = (0, eval)(`(${sortStories.toString()})`);
  const entries = [
    entry('Core/Actions/Button', 'button--primary', 'Primary'),
    entry('Core/Actions/Button', 'button--playground', 'Playground'),
    entry('Core/Actions/Button', 'button--default', 'Default'),
    entry('Core/Actions/Button', 'button--documentation', 'Documentation', 'docs'),
  ];
  assert.deepEqual(
    entries.sort(reconstructed).map(({ name }) => name),
    ['Documentation', 'Default', 'Playground', 'Primary'],
  );
});
