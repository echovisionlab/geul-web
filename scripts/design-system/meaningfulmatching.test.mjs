import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { collectLoadingInventory } from './loading-inventory.mjs';

function fixture(t, files, domains = []) {
  const root = mkdtempSync(path.join(tmpdir(), 'loading-inventory-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const domain of domains) mkdirSync(path.join(root, 'features', domain), { recursive: true });
  for (const [file, source] of Object.entries(files)) {
    const target = path.join(root, file);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, source);
  }
  return { root, report: collectLoadingInventory({ root }) };
}
const pageLoader = 'export function PageLoader() { return <div role="status">Waiting</div>; }';
const rowsIn = (report, file, kind) =>
  report.candidates.filter((row) => row.file === file && (!kind || row.kind === kind));

test('aliased shared PageLoader resolves to its definition with owner and source identity', (t) => {
  const file = 'features/map/Map.tsx';
  const { report } = fixture(t, {
    'features/site/PageLoader/PageLoader.tsx': pageLoader,
    'features/map/useMapLoadingState.ts': 'export function useMapLoadingState() { return "connecting"; }',
    [file]: `import { PageLoader as Wait } from '@/features/site/PageLoader/PageLoader';
import { useMapLoadingState } from './useMapLoadingState';
export function Map() { const phase = useMapLoadingState(); return <Wait message={phase} />; }`,
  });
  const [row] = rowsIn(report, file, 'jsx-surface');
  assert.deepEqual(row.sharedSurface, ['site/PageLoader']);
  assert.equal(row.importTarget.target, 'features/site/PageLoader/PageLoader.tsx');
  assert.equal(row.importTarget.origins[0].symbol, 'PageLoader');
  assert.equal(row.owner, 'Feature/map');
  assert.equal(row.enclosingFunction, 'Map');
  assert.equal(row.line, 3);
  assert.match(row.snippet, /message=\{phase\}/);
  assert.equal(row.classification, 'manual-required');
  assert.equal(row.sha256, report.sourceManifest.find((source) => source.file === file).sha256);
  assert.equal(
    report.sources.find((source) => source.file === file).imports[1].target,
    'features/map/useMapLoadingState.ts',
  );
});

test('namespace, renamed/default/local/star and namespace barrel exports retain shared identity', (t) => {
  const file = 'app/page.tsx';
  const { report } = fixture(t, {
    'features/site/PageLoader/PageLoader.tsx': pageLoader,
    'features/site/reexport.ts': `export { PageLoader as Busy } from './PageLoader/PageLoader';`,
    'features/site/star.ts': `export * from './reexport';`,
    'features/site/default.ts': `import { Busy } from './star'; export default Busy;`,
    'features/site/index.ts': `export { default as Gate } from './default'; export * as Slots from './star';`,
    'features/site/member.ts': `import * as UI from './PageLoader/PageLoader'; export default UI.PageLoader;`,
    'features/site/parenthesized.ts': `import { PageLoader } from './PageLoader/PageLoader'; export default (PageLoader);`,
    'app/member.tsx': `import Wait from '@/features/site/member'; export default () => <Wait />;`,
    'app/parenthesized.tsx': `import Wait from '@/features/site/parenthesized'; export default () => <Wait />;`,
    [file]: `import React from 'react';
import * as UI from '@/features/site';
import { Gate as Imported } from '@/features/site';
const Local = Imported;
export default function Page() { return <React.Suspense fallback={<UI.Gate />}><Local /><UI.Slots.Busy /></React.Suspense>; }`,
  });
  assert.deepEqual(
    rowsIn(report, file, 'jsx-surface').map((row) => [row.tag, row.sharedSurface]),
    [
      ['React.Suspense', ['react/Suspense']],
      ['UI.Gate', ['site/PageLoader']],
      ['Local', ['site/PageLoader']],
      ['UI.Slots.Busy', ['site/PageLoader']],
    ],
  );
  assert.equal(rowsIn(report, file, 'suspense-fallback')[0].fallback.shape, 'jsx');
  assert.ok(rowsIn(report, file, 'jsx-surface')[1].importTarget.origins[0].via.length >= 4);
  for (const alias of ['member', 'parenthesized']) {
    const rows = rowsIn(report, `app/${alias}.tsx`, 'jsx-surface');
    assert.equal(rows.length, 1, `${alias} default export must retain the Wait consumer`);
    const [row] = rows;
    assert.equal(row.tag, 'Wait');
    assert.deepEqual(row.sharedSurface, ['site/PageLoader']);
    assert.equal(row.importTarget.status, 'resolved');
    assert.equal(row.importTarget.origins[0].file, 'features/site/PageLoader/PageLoader.tsx');
    assert.equal(row.importTarget.origins[0].symbol, 'PageLoader');
  }
});

test('reexport cycles and unresolved imports remain reviewable without inventing shared surfaces', (t) => {
  const file = 'app/page.tsx';
  const { report } = fixture(t, {
    'features/cycle/a.ts': `export * from './b';`,
    'features/cycle/b.ts': `export * from './a';`,
    'features/site/PageLoader/PageLoader.tsx': pageLoader,
    'features/site/factory.ts': `import { PageLoader } from './PageLoader/PageLoader'; export default choose(PageLoader);`,
    'features/site/computed.ts': `import * as UI from './PageLoader/PageLoader'; export default UI['PageLoader'];`,
    [file]: `import { Loader } from '@/features/cycle/a';
import { Skeleton as Missing } from './missing';
import FactoryLoader from '@/features/site/factory';
import ComputedLoader from '@/features/site/computed';
export default () => <><Loader /><Missing /><FactoryLoader /><ComputedLoader /></>;`,
  });
  const rows = rowsIn(report, file, 'jsx-surface');
  assert.deepEqual(
    rows.map((row) => row.tag),
    ['Loader', 'Missing', 'FactoryLoader', 'ComputedLoader'],
  );
  assert.ok(rows.every((row) => row.importTarget.status === 'unresolved' && !row.sharedSurface.length));
});

test('dynamic fallback callbacks distinguish null, empty, default missing and unresolved options', (t) => {
  const file = 'features/editor/Lazy.tsx';
  const { report } = fixture(t, {
    'features/editor/Editor.tsx': 'export default function Editor() { return <main />; }',
    [file]: `import chunk from 'next/dynamic'; import * as React from 'react';
const Null = chunk(() => import('./Editor'), { loading: () => null });
const Empty = chunk(() => import('./Editor'), { loading() { return <></>; } });
const Default = chunk(() => import('./Editor'));
const Unknown = chunk(() => import('./Editor'), options);
const Lazy = React.lazy(() => import('./Editor'));
export default () => <React.Suspense fallback={null}><Null /><Empty /><Default /><Unknown /><Lazy /></React.Suspense>;`,
  });
  const dynamic = rowsIn(report, file, 'dynamic-call');
  assert.equal(dynamic.length, 4);
  assert.deepEqual(dynamic[0].fallback, { shape: 'callback', callbackReturns: [{ shape: 'null', snippet: 'null' }] });
  assert.equal(dynamic[1].fallback.callbackReturns[0].shape, 'empty-fragment');
  assert.equal(dynamic[2].fallback.shape, 'missing');
  assert.equal(dynamic[2].optionsUnresolved, false);
  assert.equal(dynamic[3].optionsUnresolved, true);
  assert.equal(dynamic[0].imports[0].target, 'features/editor/Editor.tsx');
  assert.equal(rowsIn(report, file, 'lazy-call')[0].fallback.shape, 'supplied-by-suspense');
  assert.equal(rowsIn(report, file, 'suspense-fallback')[0].fallback.shape, 'null');
});

test('pending text and null render branches are separate from unrelated helper null results', (t) => {
  const file = 'features/search/View.tsx';
  const { report } = fixture(t, {
    [file]: `function parse(value) { if (!value) return null; return value.id; }
export function View({ isLoading, savePending }) {
  if (savePending) return <p>Saving changes</p>;
  return <section>{isLoading ? <p>Loading results</p> : <></>}{isLoading && 'Waiting'}{isLoading ? null : <main />}</section>;
}`,
  });
  const [helper] = rowsIn(report, file, 'blank-return');
  assert.equal(helper.enclosingFunction, 'parse');
  assert.equal(helper.context, 'non-render-or-unproven');
  assert.equal(helper.conditions[0].pending, false);
  assert.deepEqual(
    rowsIn(report, file, 'pending-text').map((row) => row.snippet),
    ['Saving changes', 'Loading results'],
  );
  const branches = rowsIn(report, file, 'pending-branch');
  assert.equal(branches.length, 4);
  assert.ok(branches.some((row) => row.outcomes.includes('null')));
  assert.ok(branches.some((row) => row.outcomes.includes('empty-fragment')));
  assert.ok(branches.some((row) => row.outcomes.includes('text')));
  assert.ok(branches.every((row) => row.enclosingFunction === 'View'));
});

test('prefix and suffix pending props, state slots and native progress are found without native image loading', (t) => {
  const file = 'components/Controls.tsx';
  const { report } = fixture(t, {
    [file]: `export function Controls(props) {
 const state = { loadingContent: <div role="status">Please wait</div> };
 return <><Button isLoadingMore={props.loading} savePending={props.saving} pendingDelete={props.deleting} aria-busy />
 <progress value={30} max={100} /><img loading="lazy" /><Image loading="eager" /><Panel {...props} /></>;
}`,
  });
  assert.deepEqual(
    rowsIn(report, file, 'pending-prop').map((row) => row.prop),
    ['isLoadingMore', 'savePending', 'pendingDelete', 'aria-busy'],
  );
  assert.equal(rowsIn(report, file, 'pending-property')[0].property, 'loadingContent');
  assert.equal(rowsIn(report, file, 'status-region').length, 1);
  assert.ok(rowsIn(report, file, 'jsx-surface').some((row) => row.tag === 'progress'));
  assert.equal(rowsIn(report, file, 'jsx-spread').length, 1);
});

test('all production roots include providers and contexts; fixtures are excluded from both scanning and resolution', (t) => {
  const files = {
    'app/page.tsx': `import { PageLoader as Loader } from '../features/demo/Wait.test'; export default () => <Loader />;`,
    'features/demo/real.mjs': 'export const real = 1;',
    'components/Other.jsx': 'export const Other = () => <progress />;',
    'lib/providers/Gate.tsx': 'export const Gate = () => <Spinner />;',
    'lib/contexts/Gate.tsx': 'export const Gate = () => null;',
  };
  const excluded = [
    'Wait.test.tsx',
    'Wait.spec.mts',
    'Wait.type-test.tsx',
    'Wait.story.tsx',
    'Wait.stories.jsx',
    'Wait.fixture.ts',
    'Wait.story-fixtures.ts',
    'Wait.test-fixture.ts',
    'local-story-fixtures.ts',
    '__tests__/Wait.tsx',
    'fixtures/Wait.tsx',
    '__fixtures__/Wait.tsx',
    'spec/Wait.tsx',
    'test-utils/Wait.tsx',
    'types.d.ts',
  ];
  for (const suffix of excluded) files[`features/demo/${suffix}`] = 'export const PageLoader = () => <Spinner />;';
  const { report } = fixture(t, files, ['zero']);
  assert.equal(report.totals.sourceFiles, 5);
  assert.equal(report.totals.excludedSourceFiles, excluded.length);
  assert.deepEqual(
    report.sourceManifest.map((row) => row.file),
    Object.keys(files).slice(0, 5).sort(),
  );
  assert.equal(rowsIn(report, 'app/page.tsx', 'jsx-surface')[0].importTarget.status, 'unresolved');
  assert.equal(report.domains.find((domain) => domain.domain === 'zero').candidates, 0);
  assert.equal(report.domains.find((domain) => domain.domain === 'zero').sourceFiles, 0);
  assert.equal(report.domains.find((domain) => domain.domain === 'demo').sourceFiles, 1);
  assert.equal(report.roots.find((row) => row.root === 'lib').sourceFiles, 2);
});

test('lexical triage exposes imperative adapters and metadata separately from AST candidates', (t) => {
  const file = 'components/media/adapter.ts';
  const { report } = fixture(t, {
    [file]: `import styles from './Spinner.module.css';
export function decorate(element) { element.className = styles.spinner; }
// Metadata fallback is unrelated to visible waiting.
`,
  });
  assert.equal(report.totals.candidates, 0);
  assert.equal(report.totals.lexicalSignalFiles, 1);
  assert.equal(report.totals.lexicalSignalLines, 3);
  assert.deepEqual(
    report.sources[0].lexicalSignals.map((signal) => signal.terms),
    [['spinner'], ['spinner'], ['fallback']],
  );
});

test('reports are deterministic, bounded and sensitive to production content, including zero-match files', (t) => {
  const { root, report } = fixture(t, {
    'features/zero/plain.ts': 'export const answer = 42;',
    'app/page.tsx': `export default () => <Spinner label="${'x'.repeat(600)}" />;`,
  });
  assert.deepEqual(collectLoadingInventory({ root }), report);
  assert.equal(report.domains.find((domain) => domain.domain === 'zero').candidates, 0);
  assert.ok(report.candidates.every((row) => row.snippet.length <= 240));
  writeFileSync(path.join(root, 'features/zero/plain.ts'), 'export const answer = 43;');
  const changed = collectLoadingInventory({ root });
  assert.notEqual(changed.sourceIdentity.sourceManifestHash, report.sourceIdentity.sourceManifestHash);
  assert.notEqual(
    changed.sourceManifest.find((row) => row.file === 'features/zero/plain.ts').sha256,
    report.sourceManifest.find((row) => row.file === 'features/zero/plain.ts').sha256,
  );
});

test('CLI root option emits only JSON and invalid options fail without writing artifacts', (t) => {
  const { root, report } = fixture(t, { 'app/page.tsx': 'export default () => <Spinner />;' });
  const script = new URL('./loading-inventory.mjs', import.meta.url);
  const result = spawnSync(process.execPath, [script.pathname, '--root', root], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, '');
  assert.deepEqual(JSON.parse(result.stdout), report);
  const invalid = spawnSync(process.execPath, [script.pathname, '--write'], { encoding: 'utf8' });
  assert.equal(invalid.status, 1);
  assert.equal(invalid.stdout, '');
  assert.match(invalid.stderr, /Use --help/);
});
