import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { Linter } from 'eslint';
import { parser } from 'typescript-eslint';
import { createLayoutResolver, scanLayoutOwnership, strictLayoutConsumers } from './layout-policy.mjs';
import { layoutOwnershipPlugin } from '../../eslint-rules/layout-ownership.mjs';
const file = 'features/example/View.tsx';
const strict = [...strictLayoutConsumers][0];
const scan = (code, name = file, options) => scanLayoutOwnership(name, code, options);
const errors = (result) => result.filter((item) => item.severity === 'error');
const prefix = "import {LayoutStack as L} from '@/components/core/Layout';";

test('named aliases, root barrel and namespace Layout consumers reject external visual props', () => {
  for (const code of [
    `${prefix} const x=<L className='local'/>`,
    "import {LayoutInline as I} from '@/components/core';const x=<I style={{opacity:.5}}/>",
    "import * as Core from '@/components/core';const x=<Core.LayoutInset styles={{root:{padding:13}}}/>",
    "import * as Layout from '@/components/core/Layout';const x=<Layout.LayoutSpacer vars={()=>({})}/>",
  ])
    assert.equal(errors(scan(code)).length, 1, code);
});

test('static const, nested and no-argument helper spreads reject visual escape props', () => {
  for (const expression of [
    '{...{unstyled:true}}',
    '{...props}',
    '{...nested}',
    '{...visual()}',
    '{...block()}',
    '{...({style:{}} as any)}',
  ]) {
    const code = `${prefix} const props={classNames:{root:'x'}};const nested={...props};const visual=()=>({bg:'red'});function block(){return {p:13}};const x=<L ${expression}/>`;
    assert.equal(errors(scan(code)).length, 1, expression);
  }
});

test('unresolved spreads are explicit analysis warnings, not silently certified', () => {
  const result = scan(`${prefix} function View(props:unknown){return <L {...props}/>} `);
  assert.equal(result.length, 1);
  assert.equal(result[0].kind, 'unresolved-layout-spread');
  assert.equal(result[0].severity, 'warning');
});

test('public layout geometry and semantics remain allowed; static safe native attrs remain allowed', () => {
  assert.deepEqual(
    scan(`${prefix}const attrs={id:'list','aria-label':'List'};const x=<L gap='sm' as='section' {...attrs}/>`),
    [],
  );
  assert.deepEqual(
    scan(
      "import {LayoutGrid,LayoutGridItem} from '@/components/core/Layout';const x=<LayoutGrid columns={3}><LayoutGridItem span={2}/></LayoutGrid>",
    ),
    [],
  );
});

test('strict migrated consumers reject aliased, namespace and destructured Mantine layouts', () => {
  for (const code of [
    "import {Stack as S} from '@mantine/core';const x=<S/>",
    "import * as M from '@mantine/core';const x=<M.Grid.Col/>",
    "import * as M from '@mantine/core';const S=M['Stack'];const x=<S/>",
    "import * as M from '@mantine/core';const {Stack:S}=M;const x=<S/>",
    "const M=await import('@mantine/core');",
  ])
    assert.ok(
      errors(scan(code, strict)).some((item) => item.kind === 'raw-mantine-layout'),
      code,
    );
  assert.deepEqual(scan("import {Text} from '@mantine/core';const x=<Text>Label</Text>", strict), []);
  assert.deepEqual(scan("import {Stack} from '@mantine/core';const x=<Stack/>", file), []);
});

test('simple relative and alias re-export barrels preserve Core and Mantine ownership', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'geul-layout-policy-'));
  try {
    fs.mkdirSync(path.join(root, 'features/example'), { recursive: true });
    fs.writeFileSync(
      path.join(root, 'features/example/barrel.ts'),
      "export {LayoutStack as Local} from '@/components/core/Layout'; export {Stack as Raw} from '@mantine/core';",
    );
    fs.writeFileSync(path.join(root, 'features/example/all.ts'), "export * from './barrel';");
    const resolver = createLayoutResolver(root);
    assert.equal(
      errors(scan("import {Local as L} from './all';const x=<L p={7}/>", file, { root, resolver })).length,
      1,
    );
    assert.equal(
      errors(
        scan("import * as C from '@/features/example/all';const x=<C.Local className='x'/>", file, { root, resolver }),
      ).length,
      1,
    );
    assert.equal(
      errors(scan("import {Raw} from '@/features/example/all';const x=<Raw/>", strict, { root, resolver })).length,
      1,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('private CSS selectors, aliases, state attrs and owned module imports are rejected', () => {
  for (const [name, code] of [
    ['features/example/style.css', '[data-geul-layout="stack"] {opacity:.5}'],
    ['features/example/style.css', '.x {--_layout-gap:7px}'],
    ['features/example/style.css', '.x {gap:var(--_layout-gap)}'],
    [file, "import classes from '@/components/core/Layout/Layout.module.css'"],
    [file, "const css=import('@/components/core/Layout/Layout.module.css')"],
    [file, "const x=<div data-geul-layout='stack'/>"],
    [file, `${prefix}const x=<L data-geul-dense='x'/>`],
    [file, "const x=document.querySelector('[data-geul-layout]');"],
    [file, "const x=document.body.style.setProperty('--_layout-gap','7px');"],
  ])
    assert.ok(errors(scan(code, name)).length, code);
});

test('Core Layout owner, tests and stories are excluded; malformed source fails closed', () => {
  for (const name of [
    'components/core/Layout/Layout.tsx',
    'features/example/View.test.tsx',
    'features/example/View.type-test.tsx',
    'features/example/View.stories.tsx',
  ])
    assert.deepEqual(scan(`${prefix}const x=<L style={{}}/>`, name), []);
  assert.equal(
    errors(scan(`${prefix}const x=<L style=`)).some((item) => item.kind === 'layout-parse-error'),
    true,
  );
  assert.equal(
    errors(scan('.x {', 'features/example/style.css')).some((item) => item.kind === 'layout-parse-error'),
    true,
  );
});

test('authored runtime geometry is not an interface layout violation', () => {
  assert.deepEqual(
    scan("map.fitBounds(bounds,{padding:80,duration:instantTransitions?0:300});const artwork={room:{color:'#000'}};"),
    [],
  );
});

test('ESLint uses the same policy and reports aliases and helper spread violations', () => {
  const linter = new Linter();
  const result = linter.verify(
    `${prefix}const visual=()=>({style:{}});const x=<L {...visual()}/>`,
    [
      {
        files: ['**/*.tsx'],
        languageOptions: {
          parser,
          parserOptions: { ecmaVersion: 'latest', sourceType: 'module', ecmaFeatures: { jsx: true } },
        },
        plugins: { 'layout-ownership': layoutOwnershipPlugin },
        rules: { 'layout-ownership/no-escape': 'error' },
      },
    ],
    { filename: file },
  );
  assert.equal(result.length, 1);
  assert.equal(result[0].ruleId, 'layout-ownership/no-escape');
});

test('lexically shadowed constants cannot certify visual spread props in another scope', () => {
  const code = `${prefix} const props={style:{}};function unrelated(){const props={id:'safe'};return props}const x=<L {...props}/>`;
  assert.equal(errors(scan(code)).length, 1);
  const inner = `${prefix} const props={id:'safe'};function View(){const props={style:{}};return <L {...props}/>}`;
  assert.equal(errors(scan(inner)).length, 1);
  const parameter = `${prefix} const props={id:'safe'};function View(props:any){return <L {...props}/>} `;
  assert.equal(scan(parameter)[0].kind, 'unresolved-layout-spread');
});

test('literal computed spread keys reject reserved attrs and styling', () => {
  for (const key of ['style', 'data-geul-layout', 'data-geul-escape'])
    assert.ok(errors(scan(`${prefix}const props={['${key}']:true};const x=<L {...props}/>`)).length, key);
});

test('relative owned CSS module imports are rejected; other subsystem data markers remain allowed', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'geul-layout-css-'));
  try {
    fs.mkdirSync(path.join(root, 'components/core/Layout'), { recursive: true });
    fs.writeFileSync(path.join(root, 'components/core/Layout/Layout.module.css'), '.root{}');
    assert.equal(
      errors(scan("import styles from '../../components/core/Layout/Layout.module.css'", file, { root })).length,
      1,
    );
    assert.deepEqual(scan("const x=<html data-geul-font='default'/>"), []);
    assert.deepEqual(scan('.font[data-geul-font] {font-family:inherit}', 'lib/styles/font.css'), []);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('Container inset is a legal public spacing contract and works in both scanners', () => {
  const code = "import {LayoutContainer} from '@/components/core/Layout';const x=<LayoutContainer inset='md'/>";
  assert.deepEqual(scan(code), []);
  const result = new Linter().verify(
    code,
    [
      {
        files: ['**/*.tsx'],
        languageOptions: {
          parser,
          parserOptions: { ecmaVersion: 'latest', sourceType: 'module', ecmaFeatures: { jsx: true } },
        },
        plugins: { 'layout-ownership': layoutOwnershipPlugin },
        rules: { 'layout-ownership/no-escape': 'error' },
      },
    ],
    { filename: file },
  );
  assert.deepEqual(result, []);
});

test('unknown spread fragments do not hide confirmed visual overrides in the same object', () => {
  const result = scan(
    `${prefix}function View(dynamic:any){const props={...dynamic,style:{opacity:.5}};return <L {...props}/>} `,
  );
  assert.equal(errors(result).length, 1);
  assert.ok(result.some((item) => item.kind === 'unresolved-layout-spread'));
});
