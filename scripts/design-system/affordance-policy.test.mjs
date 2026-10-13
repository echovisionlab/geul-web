import assert from 'node:assert/strict';
import { test } from 'node:test';
import { scanAffordancePlacement } from './affordance-policy.mjs';
const imports =
  "import {Button as Action, TextButton, IconButton, LayoutInline as Row, Disclosure} from '@/components/core'; import {IconChevronDown as Down, IconChevronUp, IconChevronLeft} from '@tabler/icons-react';";
const scan = (jsx) => scanAffordancePlacement('features/example/View.tsx', imports + jsx);
test('rejects conditional opening chevrons in an aliased leading slot', () => {
  assert.equal(
    scan('<Action leftSection={opened ? <IconChevronUp/> : <Down/>}>Details</Action>')[0]?.kind,
    'opening-indicator-left',
  );
});
test('accepts owned trailing indicators and directional back navigation', () => {
  assert.deepEqual(
    scan(
      '<Action indicator="menu">Options</Action><TextButton indicator="disclosure">Replies</TextButton><Action leftSection={<IconChevronLeft/>}>Back</Action>',
    ),
    [],
  );
});
test('rejects a real drag handle after its row content', () => {
  assert.equal(
    scan('<Row><span>Name</span><IconButton interaction="drag-handle" label="Move"/></Row>')[0]?.kind,
    'drag-handle-trailing',
  );
});
test('rejects a handle in trailing disclosure actions while accepting the leading slot', () => {
  assert.equal(
    scan('<Disclosure label="Name" actions={<IconButton interaction="drag-handle" label="Move"/>}/>')[0]?.kind,
    'drag-handle-trailing',
  );
  assert.deepEqual(
    scan('<Disclosure label="Name" leadingActions={<IconButton interaction="drag-handle" label="Move"/>}/>'),
    [],
  );
});
test('ignores owner implementations, fixtures and unrelated icons', () => {
  assert.deepEqual(
    scanAffordancePlacement('components/core/Button/Button.tsx', imports + '<Action leftSection={<Down/>}/>'),
    [],
  );
  assert.deepEqual(
    scanAffordancePlacement('features/example/View.test.tsx', imports + '<Action leftSection={<Down/>}/>'),
    [],
  );
  assert.deepEqual(scan('<Row><span>Name</span><IconButton label="Menu"/></Row>'), []);
});
