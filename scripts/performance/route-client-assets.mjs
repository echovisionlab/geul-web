import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { gzipSync } from 'node:zlib';

// Read-only Next 16.3.1 artifact inspection. Manifest membership is a potential
// asset set; only supplied rendered RSC or browser requests narrow that set.
const [rootArgument, route = '(general)/page', ...options] = process.argv.slice(2);
if (!rootArgument) throw new Error('Expected secret-free build root and optional app route');
const root = resolve(rootArgument);
const option = (name) => {
  const index = options.indexOf(name);
  return index < 0 ? null : options[index + 1];
};
const normalizeAsset = (value) => {
  const path = value
    .replace(/^https?:\/\/[^/]+/, '')
    .split(/[?#]/)[0]
    .replace(/^\//, '');
  if (!/^(?:_next\/)?static\/chunks\/[^\s]+\.(?:js|css)$/.test(path) || path.includes('..')) return null;
  return path.replace(/^_next\//, '');
};
const manifestPath = resolve(root, '.next/server/app', `${route}_client-reference-manifest.js`);
if (!manifestPath.startsWith(`${root}/.next/server/app/`)) throw new Error('Invalid app route');
const manifestSource = readFileSync(manifestPath, 'utf8');
const literal = manifestSource.match(/globalThis\.__RSC_MANIFEST\[[^\n]+?\]\s*=\s*(\{[\s\S]*\});\s*$/);
if (!literal) throw new Error('Unsupported client reference manifest format');
const manifest = JSON.parse(literal[1]);
const moduleAssets = Object.entries(manifest.clientModules).map(([module, entry]) => ({
  module,
  id: entry.id,
  assets: [...new Set(entry.chunks.map(String).map(normalizeAsset).filter(Boolean))],
}));
const sets = { manifestPotential: new Set(moduleAssets.flatMap((entry) => entry.assets)) };
const rscPath = option('--rsc');
const renderedReferences = [];
if (rscPath) {
  const rsc = readFileSync(resolve(rscPath), 'utf8');
  for (const match of rsc.matchAll(/(?:^|\n)[0-9a-f]+:I(\[[^\n]+\])/g)) {
    const record = JSON.parse(match[1]);
    renderedReferences.push({
      id: record[0],
      export: record[2],
      assets: record[1].map(String).map(normalizeAsset).filter(Boolean),
    });
  }
  sets.renderedRscReferences = new Set(renderedReferences.flatMap((entry) => entry.assets));
}
const requestedPath = option('--requested-assets');
if (requestedPath) {
  sets.browserRequested = new Set(
    readFileSync(resolve(requestedPath), 'utf8').split(/\r?\n/).map(normalizeAsset).filter(Boolean),
  );
}
const markers = {
  formRenderer: ['"FormRenderer"'],
  phone: ['"AsYouType"', '"PHONE_COUNTRIES"'],
  adminFactories: ['"createAdminClient"', '"createEmailLayoutClient"', '"createSiteSettingClient"'],
  immersiveRuntime: ['"ImmersiveSceneRenderer"'],
  mapRuntime: ['"MapLibreMapRuntime"', 'maplibregl'],
  spotlightRuntime: ['"PostSpotlightRuntime"'],
};
const fileCache = new Map();
function inspect(asset) {
  if (fileCache.has(asset)) return fileCache.get(asset);
  const path = resolve(root, '.next', asset);
  const data = readFileSync(path);
  const source = asset.endsWith('.js') ? data.toString('utf8') : '';
  const result = {
    asset,
    rawBytes: data.length,
    gzipBytes: gzipSync(data, { level: 9 }).length,
    sha256: createHash('sha256').update(data).digest('hex'),
    markers: Object.fromEntries(
      Object.entries(markers).map(([name, values]) => [name, values.filter((value) => source.includes(value))]),
    ),
  };
  fileCache.set(asset, result);
  return result;
}
const reports = {};
for (const [name, assets] of Object.entries(sets)) {
  const files = [...assets].sort().map(inspect);
  reports[name] = {
    files: files.length,
    rawBytes: files.reduce((total, file) => total + file.rawBytes, 0),
    gzipBytes: files.reduce((total, file) => total + file.gzipBytes, 0),
    markerAssets: Object.fromEntries(
      Object.keys(markers).map((marker) => [
        marker,
        files.filter((file) => file.markers[marker].length).map((file) => file.asset),
      ]),
    ),
    assets: files,
  };
}
console.log(
  JSON.stringify(
    {
      kind: 'next-route-asset-membership-and-literal-marker-audit-not-http-transfer',
      assetScope: 'Next static/chunks JavaScript and CSS only; fonts, tiles, workers and API requests excluded',
      root,
      route,
      buildId: readFileSync(resolve(root, '.next/BUILD_ID'), 'utf8').trim(),
      manifest: relative(root, manifestPath),
      manifestModifiedAt: statSync(manifestPath).mtime.toISOString(),
      lockfileSha256: createHash('sha256')
        .update(readFileSync(resolve(root, 'pnpm-lock.yaml')))
        .digest('hex'),
      limitations: [
        'Manifest potential set includes optional client references; it is not initial loading.',
        'Rendered RSC references are module records, not every runtime/dynamic request.',
        'Browser requested set must be a sanitized list from this exact build, without cookies or headers.',
        'Literal markers demonstrate payload presence; absence alone is not execution coverage.',
        'Gzip level 9 is a reproducible artifact measure, not observed CDN encoding or request overhead.',
      ],
      focusedModules: moduleAssets.filter((entry) =>
        /features\/(?:page\/blocks\/(?:form|map|immersive-scene)\/View|form\/FormRenderer|post\/PostSpotlight)|lib\/api\/browser/.test(
          entry.module,
        ),
      ),
      renderedReferences,
      reports,
    },
    null,
    2,
  ),
);
