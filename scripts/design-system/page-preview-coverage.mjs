/** Source relationship census. Import overlap never counts as a page preview. */
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import ts from '@typescript/tooling';
import prettier from 'prettier';
import { toId, storyNameFromExport } from 'storybook/internal/csf';
import { routePreviews, boundaryPreviews, layoutPreviews } from './route-previews.mjs';
import { hasQueryEditorBranch, missingEditorPreviews } from './editor-route-previews.mjs';
const root = path.resolve(import.meta.dirname, '../..');
// Route layouts that only scope a client provider (for example React Query) render no visual output.
const providerOnlyJsx = new Set(['ReactQueryProvider']);
const walk = (directory) =>
  readdirSync(path.join(root, directory), { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? walk(`${directory}/${entry.name}`)
      : /\.[jt]sx?$/.test(entry.name)
        ? [`${directory}/${entry.name}`]
        : [],
  );
const files = ['app', 'features', 'components', 'stories'].flatMap(walk).sort();
const fileSet = new Set(files);
const resolve = (file, module) => {
  const base = module.startsWith('@/')
    ? module.slice(2)
    : module.startsWith('.')
      ? path.posix.normalize(path.posix.join(path.posix.dirname(file), module))
      : null;
  return (
    base &&
    [base, ...['.tsx', '.ts', '/index.tsx', '/index.ts'].map((suffix) => base + suffix)].find((target) =>
      fileSet.has(target),
    )
  );
};
function scan(file) {
  const text = readFileSync(path.join(root, file), 'utf8');
  const source = ts.createSourceFile(
    file,
    text,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const dependencies = [];
  const jsx = new Set();
  const redirects = [];
  let storyTitle = null;
  const variants = [];
  function visit(node) {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier) &&
      !node.isTypeOnly &&
      !node.importClause?.isTypeOnly
    ) {
      const target = resolve(file, node.moduleSpecifier.text);
      if (target) dependencies.push(target);
    }
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      const target = resolve(file, node.arguments[0].text);
      if (target) dependencies.push(target);
    }
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) jsx.add(node.tagName.getText(source));
    if (ts.isCallExpression(node) && /^(redirect|permanentRedirect)$/.test(node.expression.getText(source)))
      redirects.push({
        line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
        expression: node.getText(source),
      });
    if (
      file.includes('.stories.') &&
      ts.isPropertyAssignment(node) &&
      node.name.getText(source) === 'title' &&
      ts.isStringLiteral(node.initializer) &&
      node.initializer.text.startsWith('Pages/')
    )
      storyTitle = node.initializer.text;
    if (
      file.includes('.stories.') &&
      ts.isVariableStatement(node) &&
      node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
    )
      for (const declaration of node.declarationList.declarations)
        if (ts.isIdentifier(declaration.name)) variants.push(declaration.name.text);
    ts.forEachChild(node, visit);
  }
  visit(source);
  return {
    file,
    sha256: createHash('sha256').update(text).digest('hex'),
    dependencies: [...new Set(dependencies)].sort(),
    jsx: [...jsx].sort(),
    redirects,
    storyTitle,
    variants,
    source: text,
  };
}
const records = new Map(files.map((file) => [file, scan(file)]));
const stories = [...records.values()].filter((item) => item.file.includes('.stories.'));
// Read titles other than Pages from their literal meta property too, without evaluating JSX/functions.
for (const story of stories)
  story.storyTitle ??=
    story.source.match(/\btitle:\s*['"]((?:Core|Feature|Composition|Foundations)\/[^'"]+)['"]/)?.[1] ?? null;
const storyLink = (title, variant) => `http://localhost:6010/?path=/story/${toId(title, storyNameFromExport(variant))}`;
for (const preview of [...routePreviews, ...boundaryPreviews, ...layoutPreviews]) {
  const story = stories.find((entry) => entry.storyTitle === preview.storyTitle);
  if (!story?.variants.includes(preview.variant))
    throw new Error(`Missing mapped page story ${preview.storyTitle}/${preview.variant}`);
}
const routePath = (file) =>
  '/' +
  file
    .replace(/^app\//, '')
    .split('/')
    .slice(0, -1)
    .filter((segment) => !/^\(.*\)$/.test(segment) && !segment.startsWith('@'))
    .join('/');
const family = (route) =>
  route.startsWith('/admin')
    ? 'Administration'
    : route.startsWith('/my')
      ? 'Account'
      : /^\/(login|verify|onboarding|account|oauth)/.test(route)
        ? 'Identity'
        : /^\/(privacy|terms)/.test(route)
          ? 'Governance'
          : /^\/forms/.test(route)
            ? 'Forms'
            : route.startsWith('/s/')
              ? 'Share'
              : route.includes('lab')
                ? 'Development'
                : 'Public';
const closure = (file) => {
  const seen = new Set();
  const queue = [file];
  while (queue.length) {
    const current = queue.shift();
    if (seen.has(current)) continue;
    seen.add(current);
    for (const target of records.get(current)?.dependencies ?? [])
      if (/^(features|app)\//.test(target)) queue.push(target);
  }
  return [...seen].sort();
};
const entryPattern = /\/(page|layout|error|global-error|not-found|loading|template|default)\.tsx$/;
const entrypoints = [...records.values()].filter((record) => entryPattern.test(record.file));
const entryFiles = new Set(entrypoints.map((entry) => entry.file));
const editorGaps = missingEditorPreviews(
  entrypoints
    .filter((entry) => entry.file.endsWith('/page.tsx'))
    .map((entry) => ({ ...entry, route: routePath(entry.file) })),
  routePreviews,
);
if (editorGaps.length)
  throw new Error(`Missing query editor branch previews: ${editorGaps.map((entry) => entry.file).join(', ')}`);
for (const preview of routePreviews.filter((entry) => entry.branch === 'edit')) {
  const story = stories.find((entry) => entry.storyTitle === preview.storyTitle);
  const route = entrypoints.find(
    (entry) => entry.file.endsWith('/page.tsx') && routePath(entry.file) === preview.route,
  );
  if (!story.dependencies.includes(preview.owner) || !closure(route.file).includes(preview.owner))
    throw new Error(
      `Editor preview must directly import the production route owner: ${preview.route} / ${preview.owner}`,
    );
}
const inherited = (file) => {
  const boundaries = [];
  let directory = path.posix.dirname(file);
  while (directory === 'app' || directory.startsWith('app/')) {
    for (const kind of ['layout', 'error', 'loading', 'not-found', 'template', 'default']) {
      const candidate = `${directory}/${kind}.tsx`;
      if (candidate !== file && entryFiles.has(candidate)) boundaries.push(candidate);
    }
    directory = path.posix.dirname(directory);
  }
  if (file !== 'app/global-error.tsx' && entryFiles.has('app/global-error.tsx'))
    boundaries.push('app/global-error.tsx');
  return [...new Set(boundaries)].sort();
};
const pages = entrypoints.map((record) => {
  const kind = record.file.match(entryPattern)[1];
  const route = routePath(record.file);
  const graph = closure(record.file);
  const graphSet = new Set(graph);
  const owners = graph.filter(
    (file) =>
      file !== record.file &&
      file.endsWith('.tsx') &&
      !/\.(test|stories|spec)\./.test(file) &&
      records.get(file)?.jsx.length,
  );
  const mapped = (
    kind === 'page'
      ? routePreviews.filter((item) => item.route === route)
      : (kind === 'layout' ? layoutPreviews : boundaryPreviews).filter((item) => item.file === record.file)
  ).map((item) => {
    const story = stories.find((entry) => entry.storyTitle === item.storyTitle);
    return {
      ...item,
      coverage:
        item.coverage ??
        (item.route?.startsWith('/my/') ? 'section-view' : kind === 'page' ? 'page-view' : 'boundary-view'),
      storySource: story.file,
      preview: storyLink(item.storyTitle, item.variant),
      availableStates: story.variants.map((variant) => ({ variant, preview: storyLink(item.storyTitle, variant) })),
    };
  });
  const related = stories
    .filter((story) =>
      story.dependencies.some(
        (target) =>
          graphSet.has(target) &&
          target.startsWith('features/') &&
          !/^features\/(site|application-error|date-time|translation)\//.test(target),
      ),
    )
    .map((story) => ({
      file: story.file,
      title: story.storyTitle,
      matchingOwners: story.dependencies.filter((target) => graphSet.has(target) && target.startsWith('features/')),
    }));
  const redirectOnly = record.redirects.length > 0 && record.jsx.length === 0 && owners.length === 0;
  const terminalNotFoundOnly =
    record.redirects.length === 0 &&
    record.jsx.length === 0 &&
    owners.length === 0 &&
    /\bnotFound\(\)\s*;/.test(record.source);
  const terminalInherited = inherited(record.file).filter(
    (file) =>
      file.endsWith('/layout.tsx') &&
      records.get(file)?.jsx.length === 0 &&
      /\bnotFound\(\)\s*;/.test(records.get(file)?.source ?? ''),
  );
  const developmentOnly =
    kind === 'page' &&
    /if\s*\(process\.env\.NODE_ENV\s*!==\s*['"]development['"]\)\s*\{\s*notFound\(\);\s*\}/.test(record.source);
  const disposition = terminalInherited.length
    ? 'disabled-by-terminal-layout'
    : developmentOnly
      ? 'development-only-entry'
      : terminalNotFoundOnly
        ? 'terminal-not-found-only'
        : record.file === 'app/layout.tsx'
          ? 'provider-document-layout'
          : kind === 'layout' && record.jsx.length > 0 && record.jsx.every((name) => providerOnlyJsx.has(name))
            ? 'provider-only-layout'
            : redirectOnly
              ? 'redirect-only'
              : mapped.some((item) => item.coverage === 'page-view')
                ? 'page-view-preview'
                : mapped.some((item) => item.coverage === 'boundary-view')
                  ? 'boundary-view-preview'
                  : mapped.some((item) => item.coverage === 'layout-view')
                    ? 'layout-view-preview'
                    : mapped.length
                      ? 'section-preview-only'
                      : kind === 'layout'
                        ? 'layout-preview-missing'
                        : related.length
                          ? 'feature-stories-only'
                          : 'preview-missing';
  return {
    file: record.file,
    sha256: record.sha256,
    kind,
    route,
    family: family(route),
    hasQueryEditorBranch: kind === 'page' && hasQueryEditorBranch(record.source),
    editorBranchPreview: mapped.find((item) => item.branch === 'edit') ?? null,
    reviewStatus: mapped.length ? 'manual-preview-source-mapping' : 'machine-import-and-jsx-census',
    disposition,
    directJsx: record.jsx,
    visualOwners: owners,
    dependencyGraph: graph,
    inheritedBoundaries: inherited(record.file),
    inheritedTerminalLayouts: terminalInherited,
    renderability: developmentOnly
      ? 'development-environment-only'
      : terminalNotFoundOnly
        ? 'terminal-boundary-only'
        : terminalInherited.length
          ? 'blocked-by-terminal-layout'
          : 'normal-or-conditional',
    redirects: record.redirects,
    previews: mapped,
    relatedFeatureStories: related,
    scopeNote:
      'Source view coverage only. A named story or importing child does not establish complete route state, permission, controller, network, SSR or browser parity.',
  };
});
const count = (items, key) =>
  Object.fromEntries(
    [...new Set(items.map((item) => item[key]))]
      .sort()
      .map((value) => [value, items.filter((item) => item[key] === value).length]),
  );
const pageEntries = pages.filter((item) => item.kind === 'page');
const output = {
  schemaVersion: 2,
  methodology:
    'All App Router visual entry files indexed by TypeScript imports/JSX; exact reviewed route/boundary maps count separately from mere Feature story overlap. Unmapped entrypoints remain explicit gaps. Static source census is not a browser pass.',
  sourceManifestHash: createHash('sha256')
    .update([...records.values()].map((item) => `${item.file}:${item.sha256}`).join('\n'))
    .digest('hex'),
  counts: {
    queryEditorBranches: pageEntries.filter((item) => item.hasQueryEditorBranch).length,
    editorBranchPreviews: pageEntries.filter((item) => item.hasQueryEditorBranch && item.editorBranchPreview).length,
    missingEditorBranches: editorGaps.length,
    visualEntrypoints: pages.length,
    pageEntrypoints: pageEntries.length,
    pageDispositions: count(pageEntries, 'disposition'),
    reachablePagePreviewGaps: pageEntries.filter((item) =>
      ['feature-stories-only', 'preview-missing', 'section-preview-only'].includes(item.disposition),
    ).length,
    entryKinds: count(pages, 'kind'),
    entryDispositions: count(pages, 'disposition'),
    reviewStatus: count(pages, 'reviewStatus'),
  },
  entrypoints: pages,
};
let markdown = `# Actual page preview coverage\n\nGenerated with \`node scripts/design-system/page-preview-coverage.mjs\`. [Complete machine-readable matrix](./page-preview-coverage.json).\n\nEvery **${pages.length} visual entrypoint / ${pageEntries.length} page** is indexed with source hash, JSX, imported production view/controller owners and inherited layout/error/not-found/loading boundaries. Import overlap with a Feature story is **not** an independent page preview. Reviewed mappings use the actual named production view; their scope gaps remain visible below. No route has a claim of full browser, server, permission or all-state parity.\n\n## Measured source coverage\n\n| Page disposition | Count |\n| --- | ---: |\n${Object.entries(
  output.counts.pageDispositions,
)
  .map(([key, value]) => `| ${key} | ${value} |`)
  .join(
    '\n',
  )}\n\n## Every page\n\n| Domain | Route / source | Disposition | Actual page preview / remaining scope | Related Feature story files |\n| --- | --- | --- | --- | ---: |\n`;
for (const item of pageEntries)
  markdown += `| ${item.family} | [\`${item.route}\`](../../${item.file}) | ${item.disposition}${item.inheritedTerminalLayouts.length ? ' (inherited terminal layout)' : ''} | ${item.previews.map((preview) => `[${preview.storyTitle} · ${preview.variant}](${preview.preview})<br/>${preview.scope}`).join('<br/>') || 'No reviewed independent page preview.'} | ${item.relatedFeatureStories.length} |\n`;
markdown += `\n## Query editor branches\n\nPublic previews never satisfy these branches. **${output.counts.editorBranchPreviews}/${output.counts.queryEditorBranches}** editor branches mapped; missing: **${output.counts.missingEditorBranches}**.\n\n| Route / query | Actual editor preview | Production owner |\n| --- | --- | --- |\n${pageEntries
  .filter((item) => item.hasQueryEditorBranch)
  .map(
    (item) =>
      `| \`${item.route}?${item.editorBranchPreview.query}\` | [${item.editorBranchPreview.storyTitle} · ${item.editorBranchPreview.variant}](${item.editorBranchPreview.preview}) | [${item.editorBranchPreview.owner}](../../${item.editorBranchPreview.owner}) |`,
  )
  .join('\n')}\n`;
markdown +=
  '\n## All remaining visual entrypoints\n\n| Kind | Source | Disposition | Actual preview / scope |\n| --- | --- | --- | --- |\n';
for (const item of pages.filter((entry) => entry.kind !== 'page'))
  markdown += `| ${item.kind} | [${item.file}](../../${item.file}) | ${item.disposition}${item.inheritedTerminalLayouts.length ? ' (inherited terminal layout)' : ''} | ${item.previews.map((preview) => `[${preview.storyTitle} · ${preview.variant}](${preview.preview}) ${preview.scope}`).join('<br/>') || 'No independent entrypoint preview. Child page/part catalogs do not establish this boundary.'} |\n`;
markdown +=
  '\n## Limits and next source work\n\nUnmapped administration tables/editors, account lists/security subflows, form controllers, public server-rendered artist/label/release pages and saved-page renderers still need dedicated route-domain adapters using production owners and deterministic local transports. Redirect-only routes need destination evidence, not invented interactive forms. Rich content, media, authorization, editor collaboration and upstream delivery are unrepresented where explicitly stated. All non-mapped entries above are machine-screened import/JSX records, not manual full-file or browser inspection.\n';
for (const [file, content, parser] of [
  ['docs/design-system/page-preview-coverage.json', JSON.stringify(output, null, 2) + '\n', 'json'],
  ['docs/design-system/page-preview-coverage.md', markdown, 'markdown'],
]) {
  const formatted = await prettier.format(content, {
    ...(await prettier.resolveConfig(path.join(root, '.prettierrc.json'))),
    parser,
  });
  if (process.argv.includes('--check')) {
    if (!existsSync(path.join(root, file)) || readFileSync(path.join(root, file), 'utf8') !== formatted) {
      console.error(`Stale ${file}`);
      process.exitCode = 1;
    }
  } else writeFileSync(path.join(root, file), formatted);
}
console.log(JSON.stringify(output.counts));
