import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scanActionUsage } from './action-policy.mjs';

const imports = `import { Button as Action } from '@/components/core/Button'; import { DropdownMenu as Menu } from '@/components/core/DropdownMenu';`;
const scan = (source) => scanActionUsage('features/example/View.tsx', imports + source);

test('rejects inverse emphasis on an aliased, nested menu opener', () => {
  const findings = scan(`<Menu.Target><div><Action emphasis="strong">Options</Action></div></Menu.Target>`);
  assert.equal(findings[0]?.kind, 'opening-as-commit');
});
test('rejects conditional strong on current-page and toggle controls', () => {
  assert.equal(
    scan(`<Action aria-current={current ? 'page' : undefined} emphasis={current ? 'strong' : 'low'}>2</Action>`)[0]
      ?.kind,
    'selection-as-commit',
  );
  assert.equal(scan(`<Action aria-pressed={active} emphasis="strong">Center</Action>`)[0]?.kind, 'selection-as-commit');
});
test('preserves a principal submit, content navigation and functional overlay', () => {
  assert.deepEqual(
    scan(
      `<Action type="submit" emphasis="strong">Save</Action><Action href="/article">Article</Action><Action contrast="inverse" emphasis="strong">Close image</Action>`,
    ),
    [],
  );
});
test('quiet menu and selected controls pass', () => {
  assert.deepEqual(
    scan(
      `<Menu.Target><Action emphasis="medium">Options</Action></Menu.Target><Action aria-pressed={active} emphasis={active ? 'medium' : 'low'}>Center</Action>`,
    ),
    [],
  );
});
test('does not claim to resolve spread or callback emphasis', () => {
  assert.deepEqual(scan(`<Action aria-pressed={active} {...props} emphasis={getEmphasis()}>Center</Action>`), []);
});
test('non-production fixtures remain outside the guard', () => {
  assert.deepEqual(
    scanActionUsage(
      'features/example/View.stories.tsx',
      imports + `<Action aria-pressed emphasis="strong">Example</Action>`,
    ),
    [],
  );
});
