import assert from 'node:assert/strict';
import { test } from 'node:test';
import { scanFrameworkOwnership } from './framework-policy.mjs';
const file = 'features/example/View.tsx';
const kinds = (source) =>
  scanFrameworkOwnership(file, source)
    .filter((f) => f.severity === 'error')
    .map((f) => f.kind);
for (const source of [
  "import {Button as Raw} from '@mantine/core'",
  "import * as Raw from '@mantine/core'",
  "export {Button} from '@mantine/core'",
  "const ui=await import('@mantine/dates')",
  "const ui=require('@mantine/dropzone')",
  "import '@mantine/core/styles.css'",
]) {
  test('rejects vendor UI via ' + source, () => assert.ok(kinds(source).includes('vendor-ui')));
}
for (const source of [
  "import {Button} from 'react-aria-components'",
  "import {Button} from 'react-aria-components/Button'",
  "export {MenuItem} from 'react-aria-components'",
]) {
  test('rejects direct React Aria consumer ' + source, () => assert.ok(kinds(source).includes('raw-aria-ui')));
}
test('allows Core primitives and its one global locale/router owner', () => {
  assert.deepEqual(
    scanFrameworkOwnership('components/core/Button/Button.tsx', "import {Button} from 'react-aria-components'"),
    [],
  );
  assert.deepEqual(
    scanFrameworkOwnership(
      'lib/providers/DesignSystemProvider.tsx',
      "import {RouterProvider} from 'react-aria-components'",
    ),
    [],
  );
});
test('nonvisual hooks/form do not introduce vendor presentation', () =>
  assert.deepEqual(
    kinds("import {useForm} from '@mantine/form'; import {useDebouncedValue} from '@mantine/hooks'"),
    [],
  ));
for (const jsx of [
  '<Control style={{color:"red"}}/>',
  '<Control className="skin"/>',
  '<Control component="button"/>',
  '<Control vars={{}}/>',
  '<Control data-geul-input-size="xl"/>',
])
  test('rejects named alias escape ' + jsx, () =>
    assert.ok(
      kinds("import {TextInput as Control} from '@/components/core/Input';" + jsx).includes('core-visual-prop'),
    ),
  );
test('checks namespaced compound components', () =>
  assert.ok(
    kinds("import * as Core from '@/components/core';const x=<Core.Table.Tr style={{opacity:.5}}/>;").includes(
      'core-visual-prop',
    ),
  ));
test('resolves object spreads and computed keys without approving unknown forwarding', () => {
  assert.ok(
    kinds(
      "import {Button} from '@/components/core/Button';const first={['className']:'skin'};const props={...first};const x=<Button {...props}/>;",
    ).includes('core-visual-prop'),
  );
  const findings = scanFrameworkOwnership(
    file,
    "import {Button} from '@/components/core/Button';function View(props:ButtonProps){return <Button {...props}/>}",
  );
  assert.equal(findings[0]?.severity, 'warning');
});
test('local parameters shadow outer unsafe objects', () =>
  assert.deepEqual(
    kinds(
      "import {Button} from '@/components/core/Button';const props={className:'skin'};function View(props:ButtonProps){return <Button {...props}/>};",
    ),
    [],
  ));
test('Core CSS and state selectors have an owner', () => {
  assert.ok(kinds("import '@/components/core/Input/Input.module.css'").includes('core-style-import'));
  assert.equal(
    scanFrameworkOwnership('features/example/View.module.css', '[data-geul-input-size] {color:red}')[0]?.kind,
    'core-state-css',
  );
});
test('domain authored geometry is independent from control visual appearance', () =>
  assert.deepEqual(
    kinds(
      "import {TextInput} from '@/components/core/Input';const x=<div style={{width:160}}><TextInput size='sm' /></div>;",
    ),
    [],
  ));
test('accepts finite Core binding projection through an imported alias', () => {
  const source =
    "import {fieldBindings as fields} from '@/components/core/bindings';import {TextInput} from '@/components/core/Input';const x=<TextInput {...fields(form.getInputProps('name'))}/>";
  assert.deepEqual(scanFrameworkOwnership(file, source), []);
});
test('accepts the Core sortable item handle projection but not look-alike handles', () => {
  const hook =
    "import {useSortableItem} from '@/components/core/Sortable';import {IconButton} from '@/components/core/IconButton';";
  assert.deepEqual(
    scanFrameworkOwnership(
      file,
      `${hook}function Row(){const sortable=useSortableItem({id:'a'});return <IconButton interaction='drag-handle' {...sortable.handle} aria-label='Move'/>}`,
    ),
    [],
  );
  for (const source of [
    `${hook}function Row(props){const sortable=props.item;return <IconButton {...sortable.handle} aria-label='Move'/>}`,
    `${hook}function Row(sortable){return <IconButton {...sortable.handle} aria-label='Move'/>}`,
    "import {IconButton} from '@/components/core/IconButton';function useSortableItem(){return {handle:{className:'x'}}}function Row(){const sortable=useSortableItem();return <IconButton {...sortable.handle} aria-label='Move'/>}",
  ])
    assert.ok(scanFrameworkOwnership(file, source).some((f) => f.kind === 'unresolved-core-spread'));
});
test('resolves conditional spreads only when both branches are closed literals', () => {
  const core = "import {IconButton} from '@/components/core/IconButton';";
  assert.deepEqual(
    scanFrameworkOwnership(
      file,
      `${core}const x=<IconButton {...(on ? { pressed } : { tone, emphasis: 'low' })} label='A'/>`,
    ),
    [],
  );
  assert.ok(
    scanFrameworkOwnership(file, `${core}const x=<IconButton {...(on ? { pressed } : rest)} label='A'/>`).some(
      (f) => f.kind === 'unresolved-core-spread',
    ),
  );
  assert.ok(
    scanFrameworkOwnership(file, `${core}const x=<IconButton {...(on ? { className: 'x' } : {})} label='A'/>`).some(
      (f) => f.kind === 'core-visual-prop',
    ),
  );
});
test('rejects native interactive controls outside Core except hidden fields and named owners', () => {
  for (const source of [
    'const x=<button onClick={go}>Go</button>',
    "const x=<input type='text' />",
    'const x=<input type={kind} />',
    'const x=<select />',
    'const x=<textarea />',
    "const x=<div role='button' tabIndex={0} />",
  ])
    assert.ok(
      scanFrameworkOwnership(file, source).some((f) => f.kind === 'raw-native-control'),
      source,
    );
  assert.deepEqual(scanFrameworkOwnership(file, "const x=<input type='hidden' name='csrf' value={v} />"), []);
  assert.deepEqual(
    scanFrameworkOwnership('components/core/Button/Button.tsx', 'const x=<button>Go</button>').filter(
      (f) => f.kind === 'raw-native-control',
    ),
    [],
  );
  assert.deepEqual(
    scanFrameworkOwnership(
      'features/page/PageView/blocks/DefaultBlockView.tsx',
      "const x=<input type='checkbox' readOnly />",
    ),
    [],
  );
});
test('does not approve a consumer imitation or shadowed Core binding', () => {
  for (const source of [
    "import {TextInput} from '@/components/core/Input';function fieldBindings(x){return x}const x=<TextInput {...fieldBindings(props)}/>",
    "import {fieldBindings} from '@/components/core/bindings';import {TextInput} from '@/components/core/Input';function View(fieldBindings){return <TextInput {...fieldBindings(props)}/>}",
    "import {fieldBindings} from '@/components/core/bindings';import {TextInput} from '@/components/core/Input';function View({adapter:{fieldBindings}}){return <TextInput {...fieldBindings(props)}/>}",
    "import {fieldBindings} from '@/components/core/bindings';import {TextInput} from '@/components/core/Input';function View(props){const [fieldBindings]=props.adapters;return <TextInput {...fieldBindings(props)}/>}",
  ])
    assert.ok(scanFrameworkOwnership(file, source).some((f) => f.kind === 'unresolved-core-spread'));
});

test('rejects social and resize presentation escapes through family, barrel, and aliases', () => {
  for (const source of [
    "import {SocialIcon as Glyph} from '@/components/core/Social';const x=<Glyph style={{color:'red'}} />;",
    "import {SocialIconGlyph as Glyph} from '@/components/core/Social/SocialIconGlyph';const x=<Glyph strokeWidth={8} />;",
    "import {SocialIcon} from '@/components/core';const override={width:900};const x=<SocialIcon {...override} />;",
    "import * as Core from '@/components/core';const x=<Core.SocialIcon className='skin' />;",
    "import {ResizeHandle as Handle} from '@/components/core/ResizeHandle';const x=<Handle className='skin' />;",
  ])
    assert.ok(kinds(source).includes('core-visual-prop'));
});

test('accepts semantic social scale and resize placement with closed runtime bindings', () => {
  assert.deepEqual(
    kinds(
      "import {SocialIcon} from '@/components/core/Social';const x=<SocialIcon platform='github' size='lg' colorMode='hoverBrand' />;",
    ),
    [],
  );
  assert.deepEqual(
    kinds(
      "import {ResizeHandle} from '@/components/core/ResizeHandle';const x=<ResizeHandle placement='media-edge' visibility='active' />;",
    ),
    [],
  );
});

test('rejects external access to the private social brand projection', () => {
  assert.equal(
    scanFrameworkOwnership('features/example/View.module.css', '.icon { --_social-brand-dark: red; }')[0]?.kind,
    'core-private-css',
  );
});

test('rejects external TOC rail sizing overrides and references', () => {
  const findings = scanFrameworkOwnership(
    'features/example/View.module.css',
    '.rail { --_toc-bar-width: 99px; height: var(--_toc-row-height); }',
  );
  assert.equal(findings.length, 2);
  assert.ok(findings.every((finding) => finding.kind === 'core-private-css'));
});

test('rejects native product disclosure, including the former shader error pattern', () => {
  assert.ok(
    kinds('const x=<details><summary>Error <IconChevronDown /></summary>Diagnostic</details>;').includes(
      'raw-disclosure',
    ),
  );
  assert.equal(
    scanFrameworkOwnership(
      'features/editor/tiptap/shader/ShaderNode.tsx',
      'const x=<summary>Shader error</summary>;',
    )[0]?.kind,
    'raw-disclosure',
  );
});

test('preserves only Core and the named development diagnostic native disclosure owner', () => {
  assert.deepEqual(
    scanFrameworkOwnership('components/core/Disclosure/Diagnostic.tsx', 'const x=<summary>Details</summary>;'),
    [],
  );
  assert.deepEqual(
    scanFrameworkOwnership('app/editor-lab-local/EditorInteractionLab.tsx', 'const x=<summary>DOM</summary>;'),
    [],
  );
  assert.ok(
    scanFrameworkOwnership('app/editor-lab-local/OtherView.tsx', 'const x=<summary>Details</summary>;').some(
      (f) => f.kind === 'raw-disclosure',
    ),
  );
});
