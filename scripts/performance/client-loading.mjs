import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { execFileSync } from 'node:child_process';
import { gzipSync } from 'node:zlib';

// Read-only compiled fixtures: outputs stay in memory, never become app routes.
const root = resolve(process.argv[2] || '.');
const require = createRequire(resolve(root, 'package.json'));
const { build, version: esbuildVersion } = require('esbuild');
const fixtures = {
  input: ['TextInput', 'components/core/Input/index.ts'],
  dialog: ['EditorSessionExpiredDialog', 'features/editor/EditorSessionExpiredDialog.tsx'],
  layout: ['ContentLayoutView', 'features/document-layout/index.ts'],
  video: ['VideoPlayer', 'features/media/VideoPlayer.tsx'],
  print: ['PrintCodeSource', 'features/editor/tiptap/code/PrintCodeSource.tsx'],
};
const hash = (path) =>
  createHash('sha256')
    .update(readFileSync(resolve(root, path)))
    .digest('hex');
let revision = null;
try {
  revision = execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
} catch {
  // A secret-free snapshot intentionally contains no Git metadata.
}
const results = {};
for (const [name, [symbol, path]] of Object.entries(fixtures)) {
  const result = await build({
    absWorkingDir: root,
    stdin: { contents: `export { ${symbol} } from './${path}';`, resolveDir: root, sourcefile: `${name}.tsx` },
    bundle: true,
    write: false,
    outdir: resolve(root, '.artifacts/performance-memory-only'),
    format: 'esm',
    platform: 'browser',
    target: 'es2022',
    splitting: true,
    minify: true,
    metafile: true,
    define: { 'process.env.NODE_ENV': '"production"' },
    external: ['next/*', 'server-only', '@echovisionlab/*'],
    loader: { '.css': 'empty', '.woff': 'empty', '.woff2': 'empty', '.ttf': 'empty' },
    logLevel: 'error',
  });
  const outputs = result.metafile.outputs;
  const entry = Object.keys(outputs).find((key) => outputs[key].entryPoint === `${name}.tsx`);
  if (!entry) throw new Error(`Missing fixture entry: ${name}`);
  const initial = new Set();
  const visit = (key) => {
    if (initial.has(key)) return;
    initial.add(key);
    for (const edge of outputs[key].imports) {
      if (!edge.external && edge.kind !== 'dynamic-import') visit(edge.path);
    }
  };
  visit(entry);
  const files = result.outputFiles.map((file) => ({
    key: relative(root, file.path),
    rawBytes: file.contents.length,
    gzipBytes: gzipSync(file.contents, { level: 9 }).length,
  }));
  const total = (rows) => rows.reduce((sum, file) => sum + file.gzipBytes, 0);
  const initialInputs = [...new Set([...initial].flatMap((key) => Object.keys(outputs[key].inputs)))];
  const sourceHash = createHash('sha256');
  for (const path of Object.keys(result.metafile.inputs).sort()) {
    if (path === `${name}.tsx` || path.startsWith('node_modules/') || path.startsWith('(')) continue;
    sourceHash.update(path).update(readFileSync(resolve(root, path)));
  }
  results[name] = {
    entry: path,
    initialGzipBytes: total(files.filter((file) => initial.has(file.key))),
    allChunksGzipBytes: total(files),
    initialModules: initialInputs.length,
    sourceFingerprint: sourceHash.digest('hex'),
    initialHeavyModules: initialInputs.filter((path) =>
      /video\.js|shiki|oniguruma|DateTimeInput|FileDropzone|ContentLayoutFormView|mantine\/dates|mantine\/dropzone/.test(
        path,
      ),
    ),
    files,
  };
}
const catalogueModule = await build({
  absWorkingDir: root,
  entryPoints: ['lib/i18n/client-messages.ts'],
  bundle: true,
  write: false,
  format: 'esm',
  platform: 'node',
  logLevel: 'error',
});
const { selectClientMessages } = await import(
  `data:text/javascript;base64,${Buffer.from(catalogueModule.outputFiles[0].contents).toString('base64')}`
);
const catalogues = {};
for (const locale of ['en', 'ko']) {
  const messages = JSON.parse(readFileSync(resolve(root, `messages/${locale}.json`), 'utf8'));
  catalogues[locale] = {};
  for (const [name, context] of Object.entries({
    homepage: { pathWithSearch: '/', hasSession: false },
    postDetail: { pathWithSearch: '/posts/example', hasSession: false },
    authenticatedControl: { pathWithSearch: '/posts/example', hasSession: true },
  })) {
    const selected = selectClientMessages(messages, context);
    const serialized = Buffer.from(JSON.stringify(selected));
    catalogues[locale][name] = {
      rawBytes: serialized.length,
      gzipBytes: gzipSync(serialized, { level: 9 }).length,
      retainedProgramEventAdmin: Object.hasOwn(selected, 'programEventAdmin'),
    };
  }
}
console.log(
  JSON.stringify(
    {
      kind: 'esbuild-isolated-client-fixtures-not-production-or-http-transfer',
      root,
      revision,
      node: process.version,
      esbuild: esbuildVersion,
      packageHash: hash('package.json'),
      lockfileHash: hash('pnpm-lock.yaml'),
      config: { css: 'excluded', externals: ['next/*', 'server-only', '@echovisionlab/*'], gzipLevel: 9 },
      results,
      catalogues,
    },
    null,
    2,
  ),
);
