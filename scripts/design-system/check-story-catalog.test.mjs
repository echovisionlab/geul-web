import assert from 'node:assert/strict';
import test from 'node:test';
import { readStory, validateStoryCatalog } from './check-story-catalog.mjs';

const story = (title, file = 'example.stories.tsx') =>
  readStory(file, `const meta = {title: '${title}'} satisfies Meta; export default meta; export const Default = {};`);

test('design-system documents have one stable subject and checked story links', () => {
  const entry = story('Design System/Components');
  assert.deepEqual(
    validateStoryCatalog([entry], [{ file: 'Overview.tsx', id: 'design-system-components--default' }]),
    [],
  );
  assert.ok(validateStoryCatalog([story('Design System/Components/Button')]).length);
});

test('fixed states and playgrounds share one subject without intermediate folders', () => {
  const entry = readStory(
    'Button.stories.tsx',
    `const meta = {title: 'Core/Actions/Button'};
    export default meta; export const Disabled = {}; export const Playground = {};`,
  );
  assert.deepEqual(
    validateStoryCatalog([entry], [{ file: 'Overview.tsx', id: 'core-actions-button--playground' }]),
    [],
  );
});
test('checks generated documentation IDs against the configured name and source title', () => {
  const entries = [story('Core/Actions/Button')];
  assert.deepEqual(validateStoryCatalog(entries, [{ file: 'link.tsx', id: 'core-actions-button--documentation' }]), []);
  for (const id of ['core-actions-button--docs', 'core-actions-missing--documentation']) {
    assert.ok(
      validateStoryCatalog(entries, [{ file: 'link.tsx', id }]).some((finding) =>
        finding.includes('Broken story link'),
      ),
    );
  }
  assert.deepEqual(validateStoryCatalog(entries, [{ file: 'link.tsx', id: 'core-actions-button--docs' }], 'Docs'), []);
});
test('rejects duplicate subjects, including spelling that yields the same ID', () => {
  const entries = [story('Core/Actions/IconButton', 'a.tsx'), story('Core/Actions/Icon Button', 'b.tsx')];
  assert.ok(validateStoryCatalog(entries).some((finding) => finding.includes('Duplicate subject')));
  assert.ok(validateStoryCatalog([entries[0], entries[0]]).some((finding) => finding.includes('Duplicate story ID')));
});
test('rejects repeated folders, generic state folders and excessive depth', () => {
  assert.ok(validateStoryCatalog([story('Feature/Mermaid/Mermaid')]).some((finding) => finding.includes('Repeated')));
  assert.ok(
    validateStoryCatalog([story('Core/Actions/Button/States')]).some((finding) => finding.includes('not in folders')),
  );
  assert.ok(validateStoryCatalog([story('Pages/Page/Editor/Extra')]).some((finding) => finding.includes('Unexpected')));
});
test('rejects a component title that is also used as a parent folder', () => {
  assert.ok(
    validateStoryCatalog([story('Core/Input/Select'), story('Core/Input/Select/Interactive')]).some((finding) =>
      finding.includes('also a parent folder'),
    ),
  );
});
test('checks root names, categories, literal metadata and syntax', () => {
  for (const entry of [
    story('Other/Button'),
    story('Core/Other/Button'),
    readStory('a.tsx', 'export default {title: computeTitle()};'),
    readStory('a.tsx', 'export default {title:'),
  ])
    assert.ok(validateStoryCatalog([entry]).length);
});
test('rejects stale fixture links after a title or variant rename', () => {
  assert.ok(
    validateStoryCatalog(
      [story('Core/Actions/Button')],
      [{ file: 'Overview.tsx', id: 'core-actions-button-states--default' }],
    ).some((finding) => finding.includes('Broken story link')),
  );
});
test('does not generate links to exported fixture helpers excluded by Storybook', () => {
  const entry = readStory(
    'a.tsx',
    `export function Preview() {};
    export default {title: 'Pages/Public/Documents', excludeStories: ['Preview']}; export const Post = {};`,
  );
  assert.deepEqual(entry.ids, ['pages-public-documents--post']);
});

test('rejects preview hooks inside localized React fixtures but allows top-level story hooks', () => {
  const imports = `import {useArgs as storyArgs} from 'storybook/preview-api';
    import {localizedRender as localized} from '@/.storybook/fixture-i18n';`;
  const broken = readStory(
    'a.tsx',
    `${imports} export default {title: 'Core/Actions/Button',
    render: localized((args) => {const [, update] = storyArgs(); return <Button {...args}/>;})};`,
  );
  assert.ok(validateStoryCatalog([broken]).some((finding) => finding.includes('cannot run inside localizedRender')));
  const valid = readStory(
    'a.tsx',
    `${imports} export default {title: 'Core/Actions/Button',
    render: (args) => {const [, update] = storyArgs(); return <Button {...args}/>;}};`,
  );
  assert.deepEqual(validateStoryCatalog([valid]), []);
});

test('rejects mixed React and Storybook state hooks in one render scope', () => {
  const entry = readStory(
    'a.tsx',
    `import {useState} from 'react'; import {useArgs} from 'storybook/preview-api';
    export default {title: 'Core/Media/ImageCropper', render: (args) => {useArgs(); useState(null); return <div/>;}};`,
  );
  assert.ok(validateStoryCatalog([entry]).some((finding) => finding.includes('Do not combine React')));
  const separate = readStory(
    'a.tsx',
    `import {useState} from 'react'; import {useArgs} from 'storybook/preview-api';
    function Fixture(){useState(null);return <div/>;}
    export default {title: 'Core/Media/ImageCropper', render: (args) => {useArgs(); return <Fixture/>;}};`,
  );
  assert.deepEqual(validateStoryCatalog([separate]), []);
});
