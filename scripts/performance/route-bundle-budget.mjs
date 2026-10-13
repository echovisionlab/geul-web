import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { brotliCompressSync, constants, gzipSync } from 'node:zlib';

// Per-route first-load client JS/CSS from an existing Next 16 Turbopack build.
// It reads `.next` only; run `pnpm build` (or next-client-build.mjs) first.
//
// First load = build-manifest rootMainFiles + every entryJSFiles/entryCSSFiles
// list in the route's client reference manifest (root/segment layouts, error,
// not-found and the page). Legacy nomodule polyfills and lazy chunks
// (next/dynamic, import()) are excluded. Sizes are per-file gzip level 9 and
// brotli quality 11, not observed CDN transfer.
//
//   node scripts/performance/route-bundle-budget.mjs [root]
//     [--check <budget.json>] [--write-budget <budget.json>] [--json <out.json>] [--top <n>]
//     [--from-json <report.json>]   reuse a saved --json report instead of reading a build

const args = process.argv.slice(2);
const option = (name) => {
  const index = args.indexOf(name);
  return index < 0 ? null : args[index + 1];
};
const positional = args.filter((value, index) => !value.startsWith('--') && !args[index - 1]?.startsWith('--'));
const root = resolve(positional[0] || '.');
const next = resolve(root, '.next');
const appServer = resolve(next, 'server/app');
const checkPath = option('--check');
const writePath = option('--write-budget');
const jsonPath = option('--json');
const top = Number(option('--top') ?? 15);
const fromJson = option('--from-json');

function measureBuild() {
  const buildManifest = JSON.parse(readFileSync(resolve(next, 'build-manifest.json'), 'utf8'));
  const rootMainFiles = buildManifest.rootMainFiles ?? [];

  const fileCache = new Map();
  function measure(asset) {
    let result = fileCache.get(asset);
    if (!result) {
      const data = readFileSync(resolve(next, asset));
      result = {
        raw: data.length,
        gzip: gzipSync(data, { level: 9 }).length,
        brotli: brotliCompressSync(data, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }).length,
      };
      fileCache.set(asset, result);
    }
    return result;
  }
  const sum = (assets) => {
    const total = { files: 0, raw: 0, gzip: 0, brotli: 0 };
    for (const asset of assets) {
      const size = measure(asset);
      total.files += 1;
      total.raw += size.raw;
      total.gzip += size.gzip;
      total.brotli += size.brotli;
    }
    return total;
  };

  function manifests(directory) {
    const found = [];
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) found.push(...manifests(path));
      else if (entry.name === 'page_client-reference-manifest.js') found.push(path);
    }
    return found;
  }

  const routes = {};
  for (const path of manifests(appServer).sort()) {
    const source = readFileSync(path, 'utf8');
    const literal = source.match(/globalThis\.__RSC_MANIFEST\[[^\n]+?\]\s*=\s*(\{[\s\S]*\});\s*$/);
    if (!literal) throw new Error(`Unsupported client reference manifest format: ${relative(root, path)}`);
    const manifest = JSON.parse(literal[1]);
    const route = `/${relative(appServer, path).replace(/\/?page_client-reference-manifest\.js$/, '')}`;
    if (route === '/_global-error') continue;
    const js = new Set(rootMainFiles);
    for (const files of Object.values(manifest.entryJSFiles ?? {})) for (const file of files) js.add(file);
    const css = new Set();
    for (const files of Object.values(manifest.entryCSSFiles ?? {})) for (const file of files) css.add(file.path);
    routes[route] = { jsAssets: [...js].sort(), cssAssets: [...css].sort() };
  }
  const routeNames = Object.keys(routes);
  if (!routeNames.length) throw new Error('No app routes found; build the application first');

  const intersect = (key) => routeNames.map((route) => new Set(routes[route][key])).reduce((a, b) => a.intersection(b));
  const sharedJs = [...intersect('jsAssets')].sort();
  const sharedCss = [...intersect('cssAssets')].sort();
  const report = {
    kind: 'next-route-first-load-client-assets-gzip9-brotli11-not-http-transfer',
    root,
    buildId: readFileSync(resolve(next, 'BUILD_ID'), 'utf8').trim(),
    shared: { js: sum(sharedJs), css: sum(sharedCss), jsAssets: sharedJs, cssAssets: sharedCss },
    routes: Object.fromEntries(
      routeNames.map((route) => {
        const { jsAssets, cssAssets } = routes[route];
        const sharedSet = new Set(sharedJs);
        return [
          route,
          {
            js: sum(jsAssets),
            css: sum(cssAssets),
            routeOnlyJs: sum(jsAssets.filter((asset) => !sharedSet.has(asset))),
            jsAssets,
            cssAssets,
          },
        ];
      }),
    ),
  };
  return report;
}

const report = fromJson ? JSON.parse(readFileSync(resolve(fromJson), 'utf8')) : measureBuild();
const routeNames = Object.keys(report.routes);

const kb = (bytes) => `${(bytes / 1024).toFixed(1)} kB`;
const rows = Object.entries(report.routes).sort((a, b) => b[1].js.gzip - a[1].js.gzip);
console.log(`Build ${report.buildId}: ${routeNames.length} routes`);
console.log(
  `Shared first-load JS ${kb(report.shared.js.gzip)} gzip / ${kb(report.shared.js.brotli)} br (${report.shared.js.files} files); CSS ${kb(report.shared.css.gzip)} gzip`,
);
console.log(
  `Largest ${Math.min(top, rows.length)} routes by first-load JS (gzip / brotli, route-only gzip, CSS gzip):`,
);
for (const [route, value] of rows.slice(0, top)) {
  console.log(
    `  ${route.padEnd(56)} ${kb(value.js.gzip).padStart(10)} ${kb(value.js.brotli).padStart(10)} ${kb(value.routeOnlyJs.gzip).padStart(10)} ${kb(value.css.gzip).padStart(9)}`,
  );
}

if (jsonPath) writeFileSync(resolve(jsonPath), `${JSON.stringify(report, null, 2)}\n`);

// Headroom: 3% or 4 KiB gzip, whichever is larger, rounded up to 1 KiB.
const percentile75 = (values) => [...values].sort((a, b) => a - b)[Math.floor((values.length - 1) * 0.75)];
const withHeadroom = (bytes) => Math.ceil(Math.max(bytes * 1.03, bytes + 4096) / 1024) * 1024;
if (writePath) {
  const budget = {
    description:
      'Per-route first-load client gzip budget (bytes) for scripts/performance/route-bundle-budget.mjs. Regenerate with `pnpm perf:bundle:update` after an intentional, reviewed size change.',
    measuredBuildId: report.buildId,
    headroom: 'max(3%, 4 KiB) rounded up to 1 KiB',
    shared: { jsGzip: withHeadroom(report.shared.js.gzip), cssGzip: withHeadroom(report.shared.css.gzip) },
    // New routes must fit the 75th-percentile route until they are added with --write-budget.
    unbudgetedRoute: {
      jsGzip: withHeadroom(percentile75(rows.map(([, value]) => value.js.gzip))),
      cssGzip: withHeadroom(percentile75(rows.map(([, value]) => value.css.gzip))),
    },
    routes: Object.fromEntries(
      Object.entries(report.routes).map(([route, value]) => [
        route,
        { jsGzip: withHeadroom(value.js.gzip), cssGzip: withHeadroom(value.css.gzip) },
      ]),
    ),
  };
  writeFileSync(resolve(writePath), `${JSON.stringify(budget, null, 2)}\n`);
  console.log(`Wrote budget ${relative(process.cwd(), resolve(writePath))}`);
}

if (checkPath) {
  const budget = JSON.parse(readFileSync(resolve(checkPath), 'utf8'));
  const failures = [];
  const compare = (label, actual, limit) => {
    if (limit != null && actual > limit) failures.push(`${label}: ${kb(actual)} > budget ${kb(limit)}`);
  };
  compare('shared JS', report.shared.js.gzip, budget.shared?.jsGzip);
  compare('shared CSS', report.shared.css.gzip, budget.shared?.cssGzip);
  for (const [route, value] of Object.entries(report.routes)) {
    const limit = budget.routes?.[route] ?? budget.unbudgetedRoute;
    const suffix = budget.routes?.[route] ? '' : ' (unbudgeted route)';
    compare(`${route} JS${suffix}`, value.js.gzip, limit?.jsGzip);
    compare(`${route} CSS${suffix}`, value.css.gzip, limit?.cssGzip);
  }
  const missing = Object.keys(budget.routes ?? {}).filter((route) => !report.routes[route]);
  if (missing.length) console.log(`Budgeted routes no longer built (prune with --write-budget): ${missing.join(', ')}`);
  if (failures.length) {
    console.error(`\nFirst-load budget exceeded (${failures.length}):`);
    for (const failure of failures) console.error(`  ${failure}`);
    console.error(
      '\nInspect with `node scripts/performance/route-bundle-budget.mjs . --json .artifacts/performance/routes.json`; see docs/performance/bundle-budget.md.',
    );
    process.exit(1);
  }
  console.log(`\nAll ${routeNames.length} routes within ${relative(process.cwd(), resolve(checkPath))}`);
}
