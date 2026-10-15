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

test('every generated Core group prioritizes docs/default/playground and retains all other CSF exports', () => {
  assert.ok(registry.components.length > 0);
  for (const component of registry.components) {
    const stories = component.stateStories.map(({ id, name }) => entry(component.title, id, name));
    const docs = entry(component.title, `${component.title}--documentation`, 'Documentation', 'docs');
    const expected = [
      docs,
      ...stories.filter(({ id }) => id.endsWith('--default')),
      ...stories.filter(({ id }) => id.endsWith('--playground')),
      ...stories.filter(({ id }) => !id.endsWith('--default') && !id.endsWith('--playground')),
    ];
    assert.deepEqual([...stories, docs].sort(sortStories), expected, component.title);
  }
});

test('actual export IDs determine priority even when display names are overridden', () => {
  const entries = [
    entry('Core/Actions/Button', 'button--recipe', 'Default'),
    entry('Core/Actions/Button', 'button--default', 'Adopted baseline'),
    entry('Core/Actions/Button', 'button--playground-pending', 'Playground Pending'),
    entry('Core/Actions/Button', 'button--playground', 'Interactive example'),
  ];
  assert.deepEqual(
    entries.sort(sortStories).map(({ id }) => id),
    ['button--default', 'button--playground', 'button--recipe', 'button--playground-pending'],
  );
});

test('non-Core siblings retain their original order', () => {
  const entries = [
    entry('Pages/Example', 'pages-example--error', 'Error'),
    entry('Pages/Example', 'pages-example--default', 'Default'),
    entry('Pages/Example', 'pages-example--playground', 'Playground'),
  ];
  assert.deepEqual([...entries].sort(sortStories), entries);
});

test('existing category priorities, title prefixes and numeric English ordering remain intact', () => {
  const titles = [
    'Pages/Test',
    'Feature/Test',
    'Composition/Test',
    'Core/Actions/Button',
    'Foundations/Tokens',
    'Design System/Handbook',
  ];
  assert.deepEqual(
    titles
      .map((title) => entry(title, title, 'Example'))
      .sort(sortStories)
      .map(({ title }) => title),
    [...titles].reverse(),
  );
  const ordered = ['Core/Actions', 'Core/Actions/Button', 'Core/Input/TextInput', 'Core/Media/MediaImage'];
  assert.deepEqual(
    [...ordered]
      .reverse()
      .map((title) => entry(title, title, 'Example'))
      .sort(sortStories)
      .map(({ title }) => title),
    ordered,
  );
  assert.ok(
    sortStories(entry('Core/Input/Example 2', 'two', 'Example'), entry('Core/Input/Example 10', 'ten', 'Example')) < 0,
  );
  assert.ok(
    sortStories(
      entry('Foundations/Overview', 'overview', 'Example'),
      entry('Foundations/Tokens', 'tokens', 'Example'),
    ) < 0,
  );
});
