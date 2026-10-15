import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import ts from '@typescript/tooling';
import prettier from 'prettier';
import { toId, storyNameFromExport } from 'storybook/internal/csf';
import { routePreviews, boundaryPreviews, layoutPreviews } from './route-previews.mjs';
import { hasQueryEditorBranch } from './editor-route-previews.mjs';
import {
  phases,
  gates,
  features,
  routePlans,
  editorFeatures,
  additionalSurfaces,
  commonStates,
  corePlans,
  blockPlans,
  sectionPlans,
  fieldPlans,
} from './release-readiness-plan.mjs';

const root = path.resolve(import.meta.dirname, '../..');
const checkOnly = process.argv.includes('--check');
const walk = (directory) =>
  readdirSync(path.join(root, directory), { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? walk(`${directory}/${entry.name}`) : [`${directory}/${entry.name}`],
  );
const files = ['app', 'features', 'components', 'stories', 'lib']
  .flatMap(walk)
  .filter((file) => /\.[jt]sx?$/.test(file))
  .sort();
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
  const source = readFileSync(path.join(root, file), 'utf8');
  const tree = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const dependencies = new Set();
  const variants = [];
  let title = null;
  let jsx = false;
  const redirects = [];
  function visit(node) {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier) &&
      !node.isTypeOnly &&
      !node.importClause?.isTypeOnly
    ) {
      const target = resolve(file, node.moduleSpecifier.text);
      if (target) dependencies.add(target);
    }
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      const target = resolve(file, node.arguments[0].text);
      if (target) dependencies.add(target);
    }
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) jsx = true;
    if (ts.isCallExpression(node) && /^(redirect|permanentRedirect)$/.test(node.expression.getText(tree)))
      redirects.push(node.getText(tree));
    if (
      file.includes('.stories.') &&
      ts.isPropertyAssignment(node) &&
      node.name.getText(tree) === 'title' &&
      ts.isStringLiteral(node.initializer) &&
      /^(Pages|Core|Feature|Composition|Foundations)\//.test(node.initializer.text)
    )
      title = node.initializer.text;
    if (
      file.includes('.stories.') &&
      ts.isVariableStatement(node) &&
      node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)
    ) {
      for (const declaration of node.declarationList.declarations)
        if (ts.isIdentifier(declaration.name)) variants.push(declaration.name.text);
    }
    ts.forEachChild(node, visit);
  }
  visit(tree);
  return {
    file,
    source,
    tree,
    dependencies: [...dependencies].sort(),
    title,
    variants,
    jsx,
    redirects,
    hash: createHash('sha256').update(source).digest('hex'),
  };
}
const records = new Map(files.map((file) => [file, scan(file)]));
const stories = [...records.values()].filter((record) => record.file.includes('.stories.') && record.title);
function exactKeys(actual, expected, subject) {
  const missing = actual.filter((key) => !Object.hasOwn(expected, key));
  const stale = Object.keys(expected).filter((key) => !actual.includes(key));
  if (missing.length || stale.length)
    throw new Error(`${subject}: unplanned=${missing.join(', ')}; removed=${stale.join(', ')}`);
}
const featureIds = new Set(features.map((feature) => feature.id));
const phaseIds = new Set(phases.map(([id]) => id));
const validateFeatures = (ids, subject) => {
  const missing = ids.filter((id) => !featureIds.has(id));
  if (missing.length) throw new Error(`${subject}: unknown features ${missing.join(', ')}`);
};
for (const feature of features) {
  if (!existsSync(path.join(root, feature.source)))
    throw new Error(`Missing feature owner ${feature.id}: ${feature.source}`);
  if (!phaseIds.has(feature.phase)) throw new Error(`Invalid feature phase ${feature.id}`);
}
if (featureIds.size !== features.length) throw new Error('Duplicate feature IDs');
const routeOf = (file) =>
  '/' +
  file
    .replace(/^app\//, '')
    .split('/')
    .slice(0, -1)
    .filter((segment) => !/^\(.*\)$/.test(segment) && !segment.startsWith('@'))
    .join('/');
const entryPattern = /\/(page|layout|error|global-error|not-found|loading|template|default)\.tsx$/;
const entrypoints = [...records.values()].filter((record) => entryPattern.test(record.file));
const entryFiles = new Set(entrypoints.map((entry) => entry.file));
const pageSources = entrypoints.filter((entry) => entry.file.endsWith('/page.tsx'));
exactKeys(
  pageSources.map((entry) => routeOf(entry.file)),
  routePlans,
  'Page routes',
);
const closure = (file) => {
  const seen = new Set();
  const queue = [file];
  while (queue.length) {
    const current = queue.shift();
    if (seen.has(current)) continue;
    seen.add(current);
    for (const dependency of records.get(current)?.dependencies ?? []) {
      if (/^(features|app)\//.test(dependency)) queue.push(dependency);
    }
  }
  return [...seen].sort();
};
const inherited = (file) => {
  const found = [];
  let directory = path.posix.dirname(file);
  while (directory === 'app' || directory.startsWith('app/')) {
    for (const kind of ['layout', 'error', 'loading', 'not-found', 'template', 'default']) {
      const candidate = `${directory}/${kind}.tsx`;
      if (candidate !== file && entryFiles.has(candidate)) found.push(candidate);
    }
    directory = path.posix.dirname(directory);
  }
  if (file !== 'app/global-error.tsx' && entryFiles.has('app/global-error.tsx')) found.push('app/global-error.tsx');
  return [...new Set(found)].sort();
};
function previewLink(mapping) {
  const story = stories.find((item) => item.title === mapping.storyTitle);
  if (!story || !story.variants.includes(mapping.variant))
    throw new Error(`Missing story ${mapping.storyTitle}/${mapping.variant}`);
  return {
    title: mapping.storyTitle,
    variant: mapping.variant,
    source: story.file,
    path: `?path=/story/${toId(mapping.storyTitle, storyNameFromExport(mapping.variant))}`,
    composition: mapping.coverage ?? 'boundary-view',
    scope: mapping.scope,
  };
}
const allCoreIds = features.filter((feature) => feature.phase === '01').map((feature) => feature.id);
const gateState = () => Object.fromEntries(gates.map(([id]) => [id, 'pending']));
const pages = pageSources
  .map((entry) => {
    const route = routeOf(entry.file);
    const plan = routePlans[route];
    validateFeatures(plan.features, route);
    if (!phaseIds.has(plan.phase)) throw new Error(`Unknown phase ${route}`);
    const graph = closure(entry.file);
    const owners = graph.filter(
      (file) => file !== entry.file && records.get(file)?.jsx && !/\.(test|stories|spec)\./.test(file),
    );
    const boundaries = inherited(entry.file);
    const blockedBy = boundaries.filter(
      (file) =>
        file.endsWith('/layout.tsx') && !records.get(file).jsx && /\bnotFound\(\)\s*;/.test(records.get(file).source),
    );
    const developmentOnly =
      /if\s*\(process\.env\.NODE_ENV\s*!==\s*['"]development['"]\)\s*\{\s*notFound\(\);\s*\}/.test(entry.source);
    const disposition = blockedBy.length
      ? 'disabled-by-terminal-layout'
      : developmentOnly
        ? 'development-only'
        : !entry.jsx && !owners.length && entry.redirects.length
          ? 'redirect-only'
          : !entry.jsx && !owners.length && /\bnotFound\(\)\s*;/.test(entry.source)
            ? 'terminal-not-found-only'
            : 'service-view';
    const previews = routePreviews
      .filter((mapping) => mapping.route === route && mapping.branch !== 'edit')
      .map(previewLink);
    return {
      id: `page:${route}`,
      ...plan,
      route,
      source: entry.file,
      sourceHash: entry.hash,
      disposition,
      inheritedBoundaries: boundaries,
      blockedBy,
      redirects: entry.redirects,
      owners,
      previews,
      commonFeatures: allCoreIds,
      gates: gateState(),
      nativeAT: 'deferred',
      status: 'pending',
    };
  })
  .sort((a, b) => a.phase.localeCompare(b.phase) || a.route.localeCompare(b.route));

const editEntries = pageSources.filter((entry) => hasQueryEditorBranch(entry.source));
exactKeys(
  editEntries.map((entry) => routeOf(entry.file)),
  editorFeatures,
  'Query editor branches',
);
const editors = editEntries
  .map((entry) => {
    const route = routeOf(entry.file);
    const mapping = routePreviews.find((item) => item.route === route && item.branch === 'edit');
    if (!mapping) throw new Error(`Missing edit preview ${route}`);
    const ids = editorFeatures[route].split(' ');
    validateFeatures(ids, route);
    const graph = closure(entry.file);
    const story = stories.find((item) => item.title === mapping.storyTitle);
    if (!graph.includes(mapping.owner) || !story.dependencies.includes(mapping.owner))
      throw new Error(`Editor owner mismatch ${route}`);
    return {
      id: `edit:${route}`,
      phase: '03',
      label: `${routePlans[route].label.replace(/ view$/, '')} editor branch`,
      route,
      query: mapping.query,
      source: entry.file,
      owner: mapping.owner,
      features: ids,
      previews: [previewLink(mapping)],
      commonFeatures: allCoreIds,
      gates: gateState(),
      nativeAT: 'deferred',
      status: 'pending',
    };
  })
  .sort((a, b) => a.route.localeCompare(b.route));
const surfaces = additionalSurfaces.map((surface) => {
  if (!Object.hasOwn(routePlans, surface.route) || !existsSync(path.join(root, surface.source)))
    throw new Error(`Invalid additional surface ${surface.label}`);
  const ids = surface.features.split(' ');
  validateFeatures(ids, surface.label);
  return {
    ...surface,
    id: `surface:${surface.route}:${surface.query ?? surface.condition}`,
    phase: surface.query?.startsWith('edit=') ? '03' : '04',
    features: ids,
    previews: surface.storyTitle ? [previewLink(surface)] : [],
    commonFeatures: allCoreIds,
    gates: gateState(),
    nativeAT: 'deferred',
    status: 'pending',
  };
});
const boundaries = entrypoints
  .filter((entry) => !entry.file.endsWith('/page.tsx'))
  .map((entry) => {
    const kind = entry.file.match(entryPattern)[1];
    const mappings = (kind === 'layout' ? layoutPreviews : boundaryPreviews).filter(
      (mapping) => mapping.file === entry.file,
    );
    const ids =
      entry.file === 'app/layout.tsx'
        ? ['G01', 'G02', 'G03', 'C11', 'C12']
        : kind === 'layout'
          ? ['G01', 'C08', 'C10']
          : ['G04', 'C08', 'C12'];
    return {
      id: `boundary:${entry.file}`,
      phase: '02',
      kind,
      source: entry.file,
      sourceHash: entry.hash,
      disposition:
        !entry.jsx && /\bnotFound\(\)\s*;/.test(entry.source) ? 'terminal-not-found-only' : 'shared-boundary',
      features: ids,
      previews: mappings.map(previewLink),
      gates: gateState(),
      nativeAT: 'deferred',
      status: 'pending',
    };
  });
const coreFamilies = readdirSync(path.join(root, 'components/core'), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();
exactKeys(coreFamilies, corePlans, 'Core families');
const core = coreFamilies.map((name) => {
  const ids = corePlans[name].split(' ');
  validateFeatures(ids, name);
  return {
    id: `core:${name}`,
    phase: '01',
    name,
    source: `components/core/${name}`,
    features: ids,
    stories: stories
      .filter((story) => story.file.startsWith(`components/core/${name}/`))
      .map((story) => ({ source: story.file, title: story.title, variants: story.variants })),
    gates: gateState(),
    status: 'pending',
  };
});

function initializer(record, name) {
  let value = null;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === name)
      value = node.initializer;
    ts.forEachChild(node, visit);
  }
  visit(record.tree);
  if (!value) throw new Error(`Missing registry ${name}`);
  while (ts.isAsExpression(value) || ts.isSatisfiesExpression(value) || ts.isParenthesizedExpression(value))
    value = value.expression;
  return value;
}
function objectKeys(file, name) {
  const value = initializer(records.get(file), name);
  if (!ts.isObjectLiteralExpression(value)) throw new Error(`Not object registry ${name}`);
  return value.properties.map((property) => {
    if (!property.name || !(ts.isIdentifier(property.name) || ts.isStringLiteral(property.name)))
      throw new Error(`Unsupported registry key ${name}`);
    return property.name.text;
  });
}
const registrySource = 'features/editor/contract/block-registry.ts';
const richKinds = objectKeys(registrySource, 'richTextBlockRegistry');
const sectionKinds = objectKeys(registrySource, 'pageSectionRegistry');
exactKeys(richKinds, blockPlans, 'Rich text blocks');
exactKeys(sectionKinds, sectionPlans, 'Page section kinds');
const fieldSource = 'lib/types/form/model.ts';
const fieldArray = initializer(records.get(fieldSource), 'FIELD_TYPES');
if (!ts.isArrayLiteralExpression(fieldArray)) throw new Error('Invalid FIELD_TYPES');
const fieldKinds = fieldArray.elements.map((element) => {
  if (!ts.isObjectLiteralExpression(element)) throw new Error('Invalid field definition');
  const value = element.properties.find(
    (property) => ts.isPropertyAssignment(property) && property.name.getText() === 'value',
  )?.initializer;
  if (!value || !ts.isStringLiteral(value)) throw new Error('Invalid field kind');
  return value.text;
});
exactKeys(fieldKinds, fieldPlans, 'Form fields');
const catalog = (kinds, plans, source, type) =>
  kinds.map((kind) => {
    const [ids, detail] = plans[kind];
    validateFeatures(ids.split(' '), kind);
    return {
      id: `${type}:${kind}`,
      kind,
      source,
      features: ids.split(' '),
      detail,
      gates: gateState(),
      status: 'pending',
    };
  });
const blocks = catalog(richKinds, blockPlans, registrySource, 'block');
const sections = catalog(sectionKinds, sectionPlans, registrySource, 'section');
const fields = fieldKinds.map((kind) => ({
  id: `field:${kind}`,
  kind,
  source: fieldSource,
  features: ['E21', 'P07', 'P08', 'C03', 'C04'],
  detail: fieldPlans[kind],
  gates: gateState(),
  status: 'pending',
}));
const embedRoute = {
  id: 'embedded:/tools/p5-runner',
  route: '/tools/p5-runner',
  source: 'app/(general)/tools/p5-runner/route.ts',
  features: ['E06', 'P05'],
  status: 'pending',
  nativeAT: 'deferred',
  detail:
    'HTML route handler: embedded execution document at the configured runner host. Check it with parent-iframe name, alternative description, permissions/errors and navigation boundaries.',
};
if (!existsSync(path.join(root, embedRoute.source))) throw new Error('Missing embedded runner route');
const reviewSource = 'docs/design-system/release-readiness-reviews.json';
const reviews = JSON.parse(readFileSync(path.join(root, reviewSource), 'utf8'));
if (reviews.schemaVersion !== 1 || !reviews.rows || Array.isArray(reviews.rows) || typeof reviews.rows !== 'object')
  throw new Error('Invalid readiness review store');
const runSummary = reviews.runSummary ?? [];
if (!Array.isArray(runSummary) || runSummary.some((note) => typeof note !== 'string' || !note.trim()))
  throw new Error('Invalid readiness run summary');
const storybookOrigin = new URL(reviews.storybookOrigin ?? 'http://localhost:6012');
if (
  !['http:', 'https:'].includes(storybookOrigin.protocol) ||
  storybookOrigin.pathname !== '/' ||
  storybookOrigin.search ||
  storybookOrigin.hash
)
  throw new Error('Invalid readiness Storybook origin');
const reviewRows = [
  ...features,
  ...core,
  ...pages,
  ...editors,
  ...surfaces,
  ...boundaries,
  ...blocks,
  ...sections,
  ...fields,
  embedRoute,
];
const ids = new Set(reviewRows.map((item) => item.id));
if (ids.size !== reviewRows.length) throw new Error('Duplicate review row IDs');
for (const [id, notes] of Object.entries(reviews.notes ?? {})) {
  if (!ids.has(id) || !Array.isArray(notes) || notes.some((note) => typeof note !== 'string' || !note.trim()))
    throw new Error(`Invalid readiness notes: ${id}`);
}
const gateIds = new Set(gates.map(([id]) => id));
const validReviewStates = new Set(['pending', 'in-progress', 'needs-fix', 'checked', 'not-applicable']);
for (const [id, review] of Object.entries(reviews.rows)) {
  if (!ids.has(id)) throw new Error(`Review row no longer exists: ${id}`);
  if (!review || typeof review !== 'object' || Array.isArray(review)) throw new Error(`Invalid review ${id}`);
  for (const [gate, value] of Object.entries(review)) {
    if (!gateIds.has(gate) || !validReviewStates.has(value))
      throw new Error(`Invalid review gate ${id}/${gate}/${value}`);
  }
}
const summarize = (values) => {
  if (values.every((value) => value === 'not-applicable')) return 'not-applicable';
  if (values.includes('needs-fix')) return 'needs-fix';
  if (values.every((value) => ['checked', 'not-applicable'].includes(value))) return 'checked';
  return values.every((value) => value === 'pending') ? 'pending' : 'in-progress';
};
for (const item of reviewRows) {
  item.gates = { ...gateState(), ...(reviews.rows[item.id] ?? {}) };
  item.status = summarize(Object.values(item.gates));
  item.notes = reviews.notes?.[item.id] ?? [];
}
const countBy = (items, key) =>
  Object.fromEntries(
    [...new Set(items.map((item) => item[key]))]
      .sort()
      .map((value) => [value, items.filter((item) => item[key] === value).length]),
  );
const output = {
  schemaVersion: 1,
  baselineDate: '2026-10-11',
  scope:
    'Site-wide accessibility release preparation with existing visual UI/copy preserved within accessibility changes. Actual VoiceOver/Orca integration is checked separately later.',
  reviewSource,
  storybookOrigin: storybookOrigin.origin,
  runSummary,
  statusMeaning: {
    pending: 'Scope and review criteria are registered. Implementation/review is not complete.',
    deferred: 'Actual assistive-technology verification is deferred.',
  },
  phases,
  gates,
  commonStates,
  features,
  core,
  pages,
  editors,
  surfaces,
  boundaries,
  blocks,
  sections,
  fields,
  embedded: [embedRoute],
  counts: {
    pageEntrypoints: pages.length,
    visualEntrypoints: entrypoints.length,
    pageDispositions: countBy(pages, 'disposition'),
    queryEditorBranches: editors.length,
    additionalSurfaces: surfaces.length,
    sharedEntrypoints: boundaries.length,
    coreFamilies: core.length,
    featureContracts: features.length,
    richTextKinds: blocks.length,
    pageSectionKinds: sections.length,
    formFieldKinds: fields.length,
    embeddedHTMLRoutes: 1,
  },
};
const fileLink = (file, label = file) => `[${label}](../../${file})`;
const featureLinks = (ids) =>
  ids
    .map((id) => {
      const feature = features.find((item) => item.id === id);
      return `[${id}](#${id.toLowerCase()}-${feature.title
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\p{M}_\s-]/gu, '')
        .replace(/\s/g, '-')})`;
    })
    .join(' ');
const statusLabels = {
  pending: 'Pending',
  'in-progress': 'In progress',
  'needs-fix': 'Needs fix',
  checked: 'Checked',
  'not-applicable': 'Not applicable',
};
const stateLabel = (item) => statusLabels[item.status];
const reviewPair = (item) =>
  `${
    statusLabels[
      summarize(
        Object.entries(item.gates)
          .filter(([id]) => id !== 'D')
          .map(([, value]) => value),
      )
    ]
  } / ${statusLabels[item.gates.D]}`;
const escape = (value) => String(value).replaceAll('|', '\\|').replaceAll('\n', ' ');
const table = (headers, rows) =>
  `| ${headers.join(' | ')} |\n| ${headers.map(() => '---').join(' | ')} |\n${rows.map((row) => `| ${row.map(escape).join(' | ')} |`).join('\n')}\n`;
const preview = (items) =>
  items.map((item) => `[${item.title} · ${item.variant}](${storybookOrigin.origin}/${item.path})`).join('<br/>') ||
  'Full-composition mapping required';
let markdown = `# Accessibility release-readiness matrix\n\nReview actual pages, views and features in order. Prepare semantics and interaction while preserving the existing design and copy within each accessibility change. Actual macOS VoiceOver and Linux Orca integration remains a separate later stage.\n\n`;
markdown += `Baseline date: 2026-10-11. Current source registers **${pages.length} pages**, **${entrypoints.length} visual entrypoints**, **${editors.length} query editor branches** and **${surfaces.length} additional tab/preview/share branches**. Review **${core.length} Core families**, **${features.length} feature contracts**, **${blocks.length} body-block kinds**, **${sections.length} page-section kinds** and **${fields.length} form-field kinds** separately. Dynamic IDs, slugs and authored data are reviewed by applicable view structure/state, not an infinite inventory of individual URLs.\n\n`;
markdown += `Each row starts **Pending**. Existing Storybook stories are review entrypoints, not evidence of complete accessibility preparation. Detailed N/R/V/O/K/A/S/D/B states are in the [JSON matrix](./release-readiness.json); saved results use stable row IDs in the [review store](./release-readiness-reviews.json). Pending, In progress, Needs fix, Checked and Not applicable remain distinct. Accessibility and visual review are reported separately. Generation preserves saved states. Maintain the plan in ${fileLink('scripts/design-system/release-readiness-plan.mjs', 'review-plan source')} and regenerate with ${fileLink('scripts/design-system/release-readiness.mjs', 'generation and missing-reference check')}.\n\n`;
if (runSummary.length) {
  markdown += `## Saved verification record\n\nThese statements and row notes preserve an earlier run. They are not a fresh result for later source changes; current review evidence must identify its source and execution conditions.\n\n${runSummary.map((note) => `- ${note}`).join('\n')}\n\n`;
}
markdown += `## Change boundaries\n\n- Do not arbitrarily change visible text, button/field labels, placeholders, tooltips, dates, numbers, units, filenames, language codes or translation keys solely to add accessibility semantics.\n- Do not arbitrarily change layout, order, size, spacing, density, colors, icons, emphasis or design tokens. Consume existing Core/theme contracts; separately authorized visual work is reviewed at those owners.\n- Supply needed names, descriptions, groups, relationships and states at the semantic layer. Do not put everything into one long aria-label or ban aria-label entirely. Preserve visible-label wording in accessible names.\n- When aria-label replaces descendant content in a role's name, check whether meaningful content becomes inaccessible. Do not add names or tabIndex to every paragraph or generic container.\n- Do not add a general a11y-off option for required semantics or interaction. Decoration and context-specific optional announcements use explicit contracts.\n- ARIA does not fix contrast, focus visibility, obstruction or target geometry. Record the defect and design impact at the shared owner and review visual changes in the authorized scope.\n- Do not invent UI, commands or steps for review convenience. Recording creation inside the app and uploading a recording file are separate features.\n\n`;
markdown += `## Review sequence\n\n${table(['Phase', 'Subject', 'Work'], phases)}\nFollow the page/branch order below. For each row: **identify actual controls → check name/role/relationships/value → check order/keyboard → check data/permission states and transitions → compare the screen under identical conditions → connect Storybook regressions**. A shared-component correction does not replace per-page target names, columns, permissions and transition checks.\n\n`;
markdown += `## Gates for every row\n\n${table(['Gate', 'Area', 'Required preparation'], gates)}\nDocument reading order, Tab order, the VoiceOver navigation cursor and text insertion/selection cursors are separate contracts. ARIA snapshots and DOM-focus checks are not actual screen-reader speech verification. Inspect UI and document-content languages separately.\n\n`;
markdown += `## State and presentation combinations\n\n${table(['Axis', 'Applicable combinations'], commonStates)}\nFirst identify real data, permission and transition combinations, then define semantics and operation for each. Check narrow/wide layouts and light/dark on each actual View; other languages, RTL and zoom include long labels/values, hidden panels and layout boundaries. Typed local fixtures/transports reproduce server states. Provider and OS file-picker boundaries separate local UI preparation from actual integration checks.\n\n`;
markdown += `## Feature review\n\nFeature IDs link from page rows below. Inspect the actual fields, commands and kinds offered by each production owner. Core checks C01–C16 and shared gates also apply to each page.\n\n`;
for (const [id, title] of phases.filter(([phase]) => ['01', '02', '03', '04', '05'].includes(phase))) {
  markdown += `### ${title}\n\n`;
  for (const feature of features.filter((item) => item.phase === id)) {
    markdown += `#### ${feature.id} ${feature.title}\n\n**${feature.title}** · ${fileLink(feature.source, 'Owner')} · ${stateLabel(feature)}\n\n`;
    markdown += table(['States', 'Checks'], [[feature.states.join(' · '), feature.check]]) + '\n';
    if (feature.notes.length) markdown += feature.notes.map((note) => `- ${note}`).join('\n') + '\n\n';
  }
}
markdown += `## All Core families\n\nInspect actual exports and supported variants for each family. Storybook presence and N/R/V/O/K/A/S/D/B review states remain separate.\n\n`;
markdown +=
  table(
    ['Family', 'Feature contract', 'Current Storybook files', 'Semantics, interaction, state and visuals'],
    core.map((item) => [
      fileLink(item.source, item.name),
      featureLinks(item.features),
      item.stories.map((story) => fileLink(story.source)).join('<br/>') || 'Family mapping required',
      stateLabel(item),
    ]),
  ) + '\n';
markdown += `## Page review\n\nDistinguish served screens, redirects, disabled routes and development-only views from source. Keep disabled routes in scope so reactivation requires a plan. Review redirects at their actual destination, permissions and return path.\n\n`;
for (const [id, title] of phases.filter(([phase]) => ['00', '02', '03', '04', '05'].includes(phase))) {
  const list = pages.filter((page) => page.phase === id);
  if (!list.length) continue;
  markdown += `### ${title}\n\n`;
  markdown +=
    table(
      ['Order', 'Page and route', 'Features', 'Page-specific scope', 'Current Storybook', 'Accessibility / visual'],
      list.map((item) => [
        `${id}.${String(pages.indexOf(item) + 1).padStart(3, '0')}`,
        `${item.label}<br/>${fileLink(item.source, `\`${item.route}\``)}${item.disposition !== 'service-view' ? `<br/>${item.disposition}` : ''}`,
        featureLinks(item.features),
        item.detail,
        preview(item.previews),
        reviewPair(item),
      ]),
    ) + '\n';
}
markdown += `## Public-page editor branches\n\nPublic output and editor output have independent review rows. Confirm actual editor-profile availability first, then inspect every permitted block/command. Reproduce new empty documents, existing documents, metadata, settings, language, readonly and synchronization/permission states separately.\n\n`;
markdown +=
  table(
    [
      'Order',
      'Canonical editor route',
      'Actual editor owner',
      'Features',
      'Current Storybook',
      'Accessibility / visual',
    ],
    editors.map((item, index) => [
      `03.E${String(index + 1).padStart(2, '0')}`,
      `\`${item.route}?${item.query}\``,
      fileLink(item.owner),
      featureLinks(item.features),
      preview(item.previews),
      reviewPair(item),
    ]),
  ) + '\n';
markdown += `## Tabs and conditional output at the same URL\n\nThese rows require independent full-frame composition review. A partial-component or password-dialog preview does not complete review of a whole tab/body.\n\n`;
markdown +=
  table(
    ['Order', 'Surface', 'Route or condition', 'Features', 'Specific scope', 'Current mapping / state'],
    surfaces.map((item, index) => [
      `${item.phase}.S${String(index + 1).padStart(2, '0')}`,
      fileLink(item.source, item.label),
      `\`${item.route}${item.query ? `?${item.query}` : ''}\`${item.condition ? `<br/>${item.condition}` : ''}`,
      featureLinks(item.features),
      item.detail,
      `${preview(item.previews)}<br/>${reviewPair(item)}`,
    ]),
  ) + '\n';
markdown += `## Shared frames and boundaries\n\nReview every page with its inheritedBoundaries layout/error records. Root providers, global notifications, consent, language controls and confirmation dialogs also have independent review scope.\n\n`;
markdown +=
  table(
    ['Kind', 'Source', 'Features', 'Current Storybook / condition', 'Accessibility / visual'],
    boundaries.map((item) => [
      item.kind,
      fileLink(item.source),
      featureLinks(item.features),
      `${preview(item.previews)}${item.disposition === 'terminal-not-found-only' ? '<br/>Currently notFound-only' : ''}`,
      reviewPair(item),
    ]),
  ) + '\n';
markdown += `## Every body-block kind\n\nLink all current kinds from the ${fileLink(registrySource, 'production block registry')}. Within permitted profiles, review insertion, selection, editing, deletion, readonly, public output and applicable error/loading states for each.\n\n`;
markdown +=
  table(
    ['Block kind', 'Features', 'Kind-specific checks', 'Accessibility / visual'],
    blocks.map((item) => [`\`${item.kind}\``, featureLinks(item.features), item.detail, reviewPair(item)]),
  ) + '\n';
markdown += `## Every page-section kind\n\nInspect each actual Editor, SettingsEditor, CanvasPreview and View surface. Include permitted Columns children/compositions/order and page-root list/map/form output.\n\n`;
markdown +=
  table(
    ['Section kind', 'Features', 'Kind-specific checks', 'Accessibility / visual'],
    sections.map((item) => [`\`${item.kind}\``, featureLinks(item.features), item.detail, reviewPair(item)]),
  ) + '\n';
markdown += `## Every form-field kind\n\nInspect every type in ${fileLink(fieldSource, 'actual FIELD_TYPES')} through builder settings, public responses, submission details and analytics. Connect actual schema required/condition/validation/option/error states; preserve current labels and number/date formatting.\n\n`;
markdown +=
  table(
    ['Field type', 'Checks', 'Accessibility / visual'],
    fields.map((item) => [`\`${item.kind}\``, item.detail, reviewPair(item)]),
  ) + '\n';
markdown += `## Embedded execution documents and external boundaries\n\n${fileLink(embedRoute.source, '/tools/p5-runner')} is an HTML route handler rather than page.tsx. E06/P05 review parent-block/execution-document semantics, focus, permissions and errors. Names alone do not complete iframe, map, external-video, code-editor, chart or executable-canvas review. Inspect actual production settings, states, alternatives and operation. OS file selection and external authentication require later app integration checks. Product purchase/download flows are outside the specified scope; service-content attachments and audio controls remain in scope.\n\n`;
markdown += `## Conditions for completing a row\n\n- Check every applicable N/R/V/O/K/A/S/D/B gate at both owner and actual consumer. Explain Not applicable with an actual absent product feature.\n- Reproduce applicable states, including failure/retry/cancel, in Storybook and assert expected semantics, values, states, order, focus and outcomes. Do not invent UI for impossible state combinations.\n- Preserve the existing copy, formatting and design under identical conditions within accessibility-only work. Track accessibility and visual review separately; unresolved screen impact keeps the row open.\n- Axe alone does not complete a row. Inspect ambiguous names, relationships, keyboard paths and data alternatives in actual code/interaction.\n- Keep actual VoiceOver/Orca checks separate. Prepared implementation is not completed assistive-technology verification or legal certification.\n\nUse stable JSON matrix IDs as keys in the review store's rows. Record pending, in-progress, needs-fix, checked or not-applicable for N/R/V/O/K/A/S/D/B. Connect exceptions and fixes to actual code/work. Source or presentation-condition changes require affected checks to return to Pending. Do not add audit-only instructions or UI to production screens.\n\n`;
markdown += `## Scope maintenance\n\nGenerate with \`node scripts/design-system/release-readiness.mjs\`; use \`node scripts/design-system/release-readiness.mjs --check\` for missing plans, invalid references and stale documents. New pages, query editor branches, Core families, body kinds, page-section kinds and field types require explicit plans. Update additionalSurfaces or feature states with new tabs, menus and conditional branches. Static analysis does not identify every arbitrary query branch. This command checks scope/documents; it does not run accessibility tests.\n\nRead actual page source, production view/controller owners and exact existing Storybook mappings. Import overlap alone does not count as a complete page preview. Track frame, permission, network and native-environment differences per row as reproduction/integration work.\n\n`;
markdown += `## References\n\n- [Adobe React Aria quality, semantics and visual design](https://react-aria.adobe.com/quality) and [semantic testing](https://react-aria.adobe.com/testing)\n- [W3C names and descriptions](https://www.w3.org/WAI/ARIA/apg/practices/names-and-descriptions/) and [label in name](https://www.w3.org/WAI/WCAG22/Understanding/label-in-name.html)\n- [WCAG 2.2](https://www.w3.org/TR/WCAG22/) and [WCAG2ICT guidance](https://www.w3.org/WAI/standards-guidelines/wcag/non-web-ict/)\n- [ATAG authoring tools and generated content](https://www.w3.org/WAI/standards-guidelines/atag/)\n- [Apple VoiceOver evaluation criteria](https://developer.apple.com/help/app-store-connect/manage-app-accessibility/voiceover-evaluation-criteria)\n\nThe web implementation target is WCAG 2.2 AA; WCAG2ICT informs desktop interpretation. Legal applicability, private audits and Section 508 delivery requirements are separate decisions. This matrix records implementation preparation across the site.\n`;
const config = await prettier.resolveConfig(path.join(root, '.prettierrc.json'));
for (const [file, content, parser] of [
  ['docs/design-system/release-readiness.json', JSON.stringify(output, null, 2) + '\n', 'json'],
  ['docs/design-system/release-readiness.md', markdown, 'markdown'],
]) {
  const formatted = await prettier.format(content, { ...config, parser });
  if (checkOnly) {
    if (!existsSync(path.join(root, file)) || readFileSync(path.join(root, file), 'utf8') !== formatted) {
      console.error(`Stale ${file}`);
      process.exitCode = 1;
    }
  } else writeFileSync(path.join(root, file), formatted);
}
console.log(JSON.stringify(output.counts));
