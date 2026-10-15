/** Reproducible source index. This does not infer runtime permission or behavior coverage. */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from '@typescript/tooling';
import prettier from 'prettier';
import { isExportStory, storyNameFromExport, toId } from 'storybook/internal/csf';
import { routePreviews } from './route-previews.mjs';
import { featureCategories } from './feature-categories.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const roots = ['app', 'components/core', 'features', 'lib', 'stories', '.storybook'];
const sourceExtensions = /\.(?:[cm]?[jt]sx?)$/;
const sorted = (values) => [...new Set(values)].sort();
const isFixture = (file) => /\.(?:stories|story|test|spec|type-test)\.[jt]sx?$/.test(file);
const isCatalog = (file) => file.startsWith('stories/') || file.startsWith('.storybook/');
function walk(directory) {
  if (!existsSync(path.join(root, directory))) return [];
  return readdirSync(path.join(root, directory), { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name, 'en'))
    .flatMap((entry) => {
      const file = `${directory}/${entry.name}`;
      return entry.isDirectory() ? walk(file) : sourceExtensions.test(file) ? [file] : [];
    });
}
const files = sorted(roots.flatMap(walk));
const fileSet = new Set(files);
function resolve(from, module) {
  const base = module.startsWith('@/')
    ? module.slice(2)
    : module.startsWith('.')
      ? path.posix.normalize(path.posix.join(path.posix.dirname(from), module))
      : null;
  if (!base) return null;
  return (
    [
      base,
      ...['.tsx', '.ts', '.jsx', '.js', '/index.tsx', '/index.ts', '/index.jsx', '/index.js'].map(
        (suffix) => base + suffix,
      ),
    ].find((file) => fileSet.has(file)) ?? null
  );
}
const exported = (node) => node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword);
const nameOf = (node) => node?.getText() ?? '';
const short = (node) => node?.getText().replace(/\s+/g, ' ').slice(0, 220) ?? null;
function object(node) {
  if (!node) return null;
  if (ts.isSatisfiesExpression(node) || ts.isAsExpression(node) || ts.isParenthesizedExpression(node))
    return object(node.expression);
  return ts.isObjectLiteralExpression(node) ? node : null;
}
function property(node, name) {
  return object(node)?.properties.find(
    (item) => ts.isPropertyAssignment(item) && nameOf(item.name).replace(/['"]/g, '') === name,
  )?.initializer;
}
function scan(file) {
  const text = readFileSync(path.join(root, file), 'utf8');
  const sf = ts.createSourceFile(
    file,
    text,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const imports = [];
  const exports = [];
  const interfaces = [];
  const typeAliases = [];
  const jsx = [];
  const calls = [];
  const variables = new Map();
  const reexports = [];
  let defaultExport = null;
  for (const statement of sf.statements) {
    if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)) {
      const clause = statement.importClause;
      const symbols = [];
      if (clause?.name)
        symbols.push({ local: clause.name.text, imported: 'default', typeOnly: Boolean(clause.isTypeOnly) });
      if (clause?.namedBindings && ts.isNamespaceImport(clause.namedBindings))
        symbols.push({ local: clause.namedBindings.name.text, imported: '*', typeOnly: Boolean(clause.isTypeOnly) });
      if (clause?.namedBindings && ts.isNamedImports(clause.namedBindings)) {
        for (const item of clause.namedBindings.elements)
          symbols.push({
            local: item.name.text,
            imported: item.propertyName?.text ?? item.name.text,
            typeOnly: Boolean(clause.isTypeOnly || item.isTypeOnly),
          });
      }
      imports.push({
        module: statement.moduleSpecifier.text,
        target: resolve(file, statement.moduleSpecifier.text),
        symbols,
      });
    }
    if (
      ts.isExportDeclaration(statement) &&
      statement.moduleSpecifier &&
      ts.isStringLiteral(statement.moduleSpecifier)
    ) {
      reexports.push({
        target: resolve(file, statement.moduleSpecifier.text),
        symbols:
          statement.exportClause && ts.isNamedExports(statement.exportClause)
            ? statement.exportClause.elements.map((item) => ({
                exported: item.name.text,
                imported: item.propertyName?.text ?? item.name.text,
                typeOnly: Boolean(statement.isTypeOnly || item.isTypeOnly),
              }))
            : null,
      });
    }
    if (
      ts.isExportDeclaration(statement) &&
      !statement.moduleSpecifier &&
      statement.exportClause &&
      ts.isNamedExports(statement.exportClause)
    ) {
      for (const item of statement.exportClause.elements.filter((entry) => !entry.isTypeOnly && !statement.isTypeOnly))
        exports.push({ name: item.name.text, kind: 'local-export' });
    }
    if (ts.isVariableStatement(statement)) {
      for (const item of statement.declarationList.declarations) {
        variables.set(nameOf(item.name), item.initializer);
        if (exported(statement)) exports.push({ name: nameOf(item.name), kind: 'value' });
      }
    }
    if ((ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)) && exported(statement))
      exports.push({
        name: statement.name?.text ?? 'default',
        kind: ts.isFunctionDeclaration(statement) ? 'function' : 'class',
      });
    if (ts.isInterfaceDeclaration(statement))
      interfaces.push({
        name: statement.name.text,
        extends: statement.heritageClauses?.map(short) ?? [],
        properties: statement.members
          .filter(ts.isPropertySignature)
          .map((item) => ({ name: nameOf(item.name), optional: Boolean(item.questionToken), type: short(item.type) })),
      });
    if (ts.isTypeAliasDeclaration(statement))
      typeAliases.push({ name: statement.name.text, type: short(statement.type) });
    if (ts.isExportAssignment(statement)) {
      defaultExport = statement.expression;
      exports.push({ name: 'default', kind: 'default-export', local: nameOf(statement.expression) });
    }
    if (statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.DefaultKeyword) && statement.name)
      exports.push({ name: 'default', kind: 'default-export', local: statement.name.text });
  }
  function visit(node) {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) jsx.push(nameOf(node.tagName));
    if (ts.isCallExpression(node)) calls.push(nameOf(node.expression));
    ts.forEachChild(node, visit);
  }
  visit(sf);
  let meta = defaultExport;
  if (meta && ts.isIdentifier(meta)) meta = variables.get(meta.text);
  const title = property(meta, 'title');
  const storyFilter = (name) => {
    const value = property(meta, name);
    return value && ts.isArrayLiteralExpression(value)
      ? value.elements.filter(ts.isStringLiteral).map((entry) => entry.text)
      : undefined;
  };
  const story = file.includes('.stories.')
    ? {
        file,
        title: title && ts.isStringLiteral(title) ? title.text : null,
        component: short(property(meta, 'component')),
        variants: exports
          .filter(
            (item) =>
              item.name !== 'default' &&
              isExportStory(item.name, {
                includeStories: storyFilter('includeStories'),
                excludeStories: storyFilter('excludeStories'),
              }),
          )
          .map(({ name }) => ({ name, args: short(property(variables.get(name), 'args')) })),
        importedSources: sorted(
          imports
            .filter((item) => item.target && item.symbols.some((symbol) => !symbol.typeOnly))
            .map((item) => item.target),
        ),
      }
    : null;
  return {
    file,
    text,
    imports,
    exports,
    interfaces,
    typeAliases,
    jsx: sorted(jsx),
    calls: sorted(calls),
    reexports,
    story,
  };
}
const records = files.map(scan);
const byFile = new Map(records.map((record) => [record.file, record]));
function providers(file, symbol, visited = new Set()) {
  const key = `${file}:${symbol}`;
  if (visited.has(key)) return [];
  visited.add(key);
  const record = byFile.get(file);
  if (!record) return [];
  const result = symbol === '*' || record.exports.some((item) => item.name === symbol) ? [file] : [];
  for (const item of record.reexports) {
    if (!item.target) continue;
    if (!item.symbols) result.push(...providers(item.target, symbol, visited));
    else
      for (const match of item.symbols.filter((entry) => entry.exported === symbol && !entry.typeOnly))
        result.push(...providers(item.target, match.imported, visited));
  }
  return sorted(result);
}
const consumers = new Map();
for (const record of records) {
  for (const item of record.imports) {
    if (!item.target) continue;
    for (const symbol of item.symbols.filter((entry) => !entry.typeOnly)) {
      for (const target of providers(item.target, symbol.imported)) {
        const set = consumers.get(target) ?? new Set();
        set.add(record.file);
        consumers.set(target, set);
      }
    }
  }
}
const stories = records.flatMap((record) => (record.story ? [record.story] : []));
function storyUrl(title, variant) {
  return title ? `http://localhost:6010/?path=/story/${toId(title, storyNameFromExport(variant))}` : null;
}
for (const story of stories)
  for (const variant of story.variants) variant.preview = storyUrl(story.title, variant.name);
function owner(file) {
  return file.startsWith('components/core/')
    ? `Core/${file.split('/')[2]}`
    : file.startsWith('features/')
      ? `Feature/${file.split('/')[1]}`
      : file.startsWith('stories/')
        ? 'UI Kit compositions'
        : 'App route composition';
}
const components = records
  .filter(
    (record) =>
      !isFixture(record.file) && /^(?:components\/core|features)\//.test(record.file) && record.file.endsWith('.tsx'),
  )
  .map((record) => {
    const uses = sorted(consumers.get(record.file) ?? []);
    return {
      file: record.file,
      owner: owner(record.file),
      exports: record.exports.filter(
        (item) => (/^[A-Z]/.test(item.name) && !/^[A-Z0-9_]+$/.test(item.name)) || item.name === 'default',
      ),
      classification: record.file.startsWith('components/core/')
        ? 'core'
        : record.file.includes('/ui/')
          ? 'feature-ui boundary candidate (path-based; inspect source)'
          : 'feature-owned source (controller/runtime/view; inspect before reuse)',
      propsEvidence: record.interfaces,
      typeAliasEvidence: record.typeAliases,
      productionConsumers: uses.filter((file) => !isFixture(file) && !isCatalog(file)),
      catalogAdapters: uses.filter((file) => !isFixture(file) && isCatalog(file)),
      tests: uses.filter((file) => /\.(test|spec)\./.test(file)),
      stories: uses.filter((file) => file.includes('.stories.')),
      composedJsx: record.jsx,
    };
  })
  .filter((record) => record.exports.length);
function routePath(file) {
  const segments = path.posix
    .dirname(file)
    .slice(3)
    .split('/')
    .filter((segment) => segment && !/^\(.+\)$/.test(segment));
  return `/${segments.join('/')}`;
}
function family(route) {
  if (route === '/admin' || route.startsWith('/admin/')) return 'Admin';
  if (route === '/my' || route.startsWith('/my/')) return 'My';
  if (/^\/(login|verify|onboarding|oauth|account)(\/|$)/.test(route)) return 'Identity';
  if (/^\/forms(\/|$)/.test(route)) return 'Forms';
  if (route.startsWith('/s/')) return 'Share';
  if (route.includes('lab-local')) return 'Development';
  return 'Public';
}
const routes = records
  .filter((record) => /\/page\.tsx$/.test(record.file))
  .map((record) => {
    const route = routePath(record.file);
    const imports = record.imports
      .filter((item) => item.target)
      .map(({ target, symbols }) => ({
        file: target,
        symbols: symbols.filter((entry) => !entry.typeOnly).map((entry) => entry.imported),
      }));
    const inheritedLayouts = files.filter(
      (file) => file.endsWith('/layout.tsx') && record.file.startsWith(`${path.posix.dirname(file)}/`),
    );
    return {
      route,
      file: record.file,
      family: family(route),
      sourceKind: record.jsx.length ? 'renders JSX' : 'delegates / redirects / non-JSX entrypoint (inspect source)',
      imports,
      reexports: record.reexports,
      composedJsx: record.jsx,
      controllerEvidence: record.calls.filter((call) =>
        /get|create|render|redirect|notFound|check|resolve|isEntityEditView/.test(call),
      ),
      inheritedLayouts,
      directStoryImports: sorted(
        imports
          .filter((item) => /^(features|app)\//.test(item.file))
          .flatMap((item) =>
            sorted(item.symbols.flatMap((symbol) => providers(item.file, symbol))).flatMap((file) =>
              [...(consumers.get(file) ?? [])].filter((consumer) => consumer.includes('.stories.')),
            ),
          ),
      ),
      coverageNote:
        'Import relationship only; no route behavior, permission, interaction, or nested story coverage is inferred.',
    };
  });
for (const preview of routePreviews) {
  const route = routes.find((item) => item.route === preview.route);
  if (!route) throw new Error(`Preview mapping has no route source: ${preview.route}`);
  const story = stories.find((item) => item.title === preview.storyTitle);
  if (!story?.variants.some((item) => item.name === preview.variant))
    throw new Error(`Preview mapping has no story variant: ${preview.storyTitle}/${preview.variant}`);
  route.interactivePreviews ??= [];
  route.interactivePreviews.push({ ...preview, file: story.file, preview: storyUrl(story.title, preview.variant) });
}
const layouts = records
  .filter((record) => /\/layout\.tsx$/.test(record.file))
  .map((record) => ({
    file: record.file,
    route: routePath(record.file),
    imports: record.imports.filter((item) => item.target).map((item) => item.target),
    composedJsx: record.jsx,
    controllerEvidence: record.calls.filter((call) => /get|redirect|isAdmin/.test(call)),
  }));
const domains = sorted(
  records.filter((record) => record.file.startsWith('features/')).map((record) => record.file.split('/')[1]),
).map((domain) => ({
  domain,
  category: featureCategories.find((category) => category.domains.includes(domain))?.id ?? null,
  sourceFiles: records
    .filter((record) => record.file.startsWith(`features/${domain}/`) && !isFixture(record.file))
    .map((record) => record.file),
  components: components.filter((record) => record.owner === `Feature/${domain}`).map((record) => record.file),
  stories: stories.filter((record) => record.file.startsWith(`features/${domain}/`)).map((record) => record.file),
  tests: records
    .filter((record) => record.file.startsWith(`features/${domain}/`) && /\.(test|spec)\./.test(record.file))
    .map((record) => record.file),
  directlyImportingRoutes: routes
    .filter((record) => record.imports.some((item) => item.file.startsWith(`features/${domain}/`)))
    .map((record) => record.route),
}));
for (const domain of domains) {
  const memberships = featureCategories.filter((category) => category.domains.includes(domain.domain));
  if (memberships.length !== 1) throw new Error(`Feature domain requires exactly one category: ${domain.domain}`);
}
const coreFamilies = sorted(
  components.filter((record) => record.classification === 'core').map((record) => record.owner),
).map((name) => ({
  owner: name,
  components: components.filter((record) => record.owner === name).map((record) => record.file),
  stories: stories
    .filter((record) => record.file.startsWith(`components/core/${name.slice(5)}/`))
    .map((record) => record.file),
}));
const reexportModules = records
  .filter((record) => !isFixture(record.file) && record.reexports.length)
  .map((record) => ({ file: record.file, reexports: record.reexports }));
const directMantineImports = records
  .filter((record) => !isFixture(record.file) && !record.file.startsWith('components/core/'))
  .flatMap((record) =>
    record.imports
      .filter((item) => item.module === '@mantine/core')
      .flatMap((item) =>
        item.symbols
          .filter((symbol) => !symbol.typeOnly)
          .map((symbol) => ({ file: record.file, symbol: symbol.imported, local: symbol.local })),
      ),
  );
const duplicateExportNames = sorted(
  components.flatMap((record) => record.exports.map((item) => item.name)).filter((name) => name !== 'default'),
)
  .map((name) => ({
    name,
    files: components
      .filter((record) => record.exports.some((item) => item.name === name))
      .map((record) => record.file),
  }))
  .filter((item) => item.files.length > 1);
const manifestHash = createHash('sha256')
  .update(records.map((record) => `${record.file}\0${record.text}`).join('\0'))
  .digest('hex');
const output = {
  schemaVersion: 1,
  scope: roots,
  methodology:
    'Static TypeScript AST source index. PascalCase TSX exports are component candidates, not proof of a pure or canonical component. Consumers follow named barrel reexports. Story relationships are direct imports only. Args and props are bounded source evidence, not exhaustive inherited API or state verification. Pages are source entrypoints, including redirects and development-only routes; source existence does not prove a served page.',
  manifestHash,
  counts: {
    sourceFiles: files.length,
    productionSourceFiles: files.filter((file) => !isFixture(file) && !isCatalog(file)).length,
    componentFiles: components.length,
    coreFamilies: coreFamilies.length,
    featureDomains: domains.length,
    storyFiles: stories.length,
    storyVariants: stories.reduce((count, story) => count + story.variants.length, 0),
    pageEntrypoints: routes.length,
    layouts: layouts.length,
  },
  sourceFiles: files,
  components,
  coreFamilies,
  featureCategories,
  domains,
  stories,
  routes,
  layouts,
  routePreviews,
  directMantineImports,
  reexportModules,
  duplicateExportNames,
};
const link = (file) => `[${file}](../../${file})`;
const countByFamily = sorted(routes.map((route) => route.family))
  .map((name) => `| ${name} | ${routes.filter((route) => route.family === name).length} |`)
  .join('\n');
const previewCoverage = `# Route-to-preview coverage matrix\n\nGenerated from source plus explicitly reviewed mappings in [route-previews.mjs](../../scripts/design-system/route-previews.mjs).\n\nAn interactive mapping establishes view/section composition parity only. It never proves route-controller, authorization, SSR, backend mutation or runtime parity. Other linked stories are direct module-import relationships and may cover an excerpt; they are not page previews. Missing composition coverage stays explicit. The generic Admin Workspace story is a pattern demonstration and is deliberately not mapped to a product route.\n\n| Route | Interactive preview | Exact scope / gap | Existing directly related component stories |\n| --- | --- | --- | --- |\n${routes
  .map(
    (item) =>
      `| \`${item.route}\` | ${(item.interactivePreviews ?? []).map((preview) => `[${preview.storyTitle}/${preview.variant}](${preview.preview})`).join('<br/>') || 'No explicit composition preview'} | ${(item.interactivePreviews ?? []).map((preview) => preview.scope).join('<br/>') || 'Whole page composition and route behavior are not established by this catalog.'} | ${
        item.directStoryImports
          .map((file) => {
            const story = stories.find((candidate) => candidate.file === file);
            const variant = story?.variants[0];
            return variant?.preview ? `[${story.title}](${variant.preview})` : link(file);
          })
          .join('<br/>') || 'No direct story import relationship'
      } |`,
  )
  .join('\n')}\n`;
const categoryRows = featureCategories
  .map(
    (category) =>
      `| ${category.label} | ${category.domains.map((domain) => `[${domain}](../../features/${domain})`).join(', ')} |`,
  )
  .join('\n');
const markdown = `# Generated UI source inventory\n\nRun \`node scripts/design-system/inventory.mjs\` to regenerate; \`--check\` fails when any generated file differs. No timestamp is emitted, so identical source produces identical output.\n\n${output.methodology}\n\nSource manifest SHA-256: \`${manifestHash}\`. The hash covers paths and full source content inside the scope, including tests and stories. CSS, assets, generated dependency packages and runtime data are outside this index.\n\n## Counts\n\n| Metric | Count |\n| --- | ---: |\n${Object.entries(
  output.counts,
)
  .map(([name, count]) => `| ${name} | ${count} |`)
  .join(
    '\n',
  )}\n\n| Page source family | Entrypoints |\n| --- | ---: |\n${countByFamily}\n\n## Core families\n\nEach family below names its ownership directory. The JSON lists every component export candidate, local props interfaces, production consumer, importing test/story, and composed JSX tag. Missing stories identify catalog work, not missing tests.\n\n| Owner | Component files | Story files |\n| --- | ---: | ---: |\n${coreFamilies.map((item) => `| [${item.owner}](../../components/core/${item.owner.slice(5)}) | ${item.components.length} | ${item.stories.length} |`).join('\n')}\n\n## Feature categories\n\nThe explicit [route-to-preview coverage matrix](./route-preview-coverage.md) links reviewed interactive section/page compositions and exposes every uncovered route.\n\nEvery existing domain must belong to exactly one category in [feature-categories.mjs](../../scripts/design-system/feature-categories.mjs); the generator fails for an unclassified or multiply classified domain.\n\n| Responsibility | Domains |\n| --- | --- |\n${categoryRows}\n\n## Feature domains\n\nCounts include every production JS/TS file in the domain; component files are PascalCase TSX export candidates. Direct route imports exclude transitive controller relationships. Full source and story links are in [ui-inventory.json](./ui-inventory.json). Behavior and permission specifications live in [ui-feature-specification.md](../ui-feature-specification.md).\n\n| Domain | Source | Components | Stories | Tests | Direct routes |\n| --- | ---: | ---: | ---: | ---: | ---: |\n${domains.map((item) => `| [${item.domain}](../../features/${item.domain}) | ${item.sourceFiles.length} | ${item.components.length} | ${item.stories.length} | ${item.tests.length} | ${item.directlyImportingRoutes.length} |`).join('\n')}\n\n## Page source entrypoints\n\n“Related stories” means the route imports a module also imported by those stories. It does not establish page composition or route-flow coverage. Layout guards are listed separately in JSON; redirected and locally enabled entries remain explicit.\n\n| Family | Route | Source | Related story files |\n| --- | --- | --- | ---: |\n${routes.map((item) => `| ${item.family} | \`${item.route}\` | ${link(item.file)} | ${item.directStoryImports.length} |`).join('\n')}\n\n## Layouts\n\n${layouts.map((item) => `- \`${item.route}\`: ${link(item.file)}`).join('\n')}\n\n## Preview catalog\n\nOpen Geul design system in Storybook on port 6010. Each JSON story variant has its own local preview link. Controls and named variants are source evidence; keyboard, network, persistence and permission behavior need separate verification.\n\n| Title | Source | Named variants |\n| --- | --- | --- |\n${stories.map((item) => `| ${item.title ?? 'Dynamic/unresolved title'} | ${link(item.file)} | ${item.variants.map((variant) => (variant.preview ? `[${variant.name}](${variant.preview})` : variant.name)).join(', ')} |`).join('\n')}\n`;
const componentMarkdown = `# Generated component export inventory\n\nGenerated by \`node scripts/design-system/inventory.mjs\`. The full index and methodology are in [generated-inventory.md](./generated-inventory.md) and [ui-inventory.json](./ui-inventory.json).\n\nThis lists every Core/Feature TSX module with PascalCase value exports or a default value export. Providers, runtime modules, local compatibility exports and controller components are included. Pure reexport/barrel modules are indexed separately under \`reexportModules\` in JSON; token utilities and ALL_CAPS constants are not counted as UI components. A name alone does not establish a reusable UI component; inspect its source and owning boundary. Consumer/test/story counts refer to value import relationships, including named barrel reexports. Props evidence covers local declarations only.\n\n| Owner | Source / exported values | Production consumers | Importing tests | Importing stories |\n| --- | --- | ---: | ---: | ---: |\n${components.map((item) => `| ${item.owner} | ${link(item.file)}<br/>${item.exports.map((entry) => (entry.name === 'default' && entry.local ? `default (${entry.local})` : entry.name)).join(', ')} | ${item.productionConsumers.length} | ${item.tests.length} | ${item.stories.length} |`).join('\n')}\n\n## Repeated export names for review\n\nRepeated names may be intentional compatibility paths or domain-specific components. This is a review list, not an automatic deduplication instruction.\n\n| Name | Source modules |\n| --- | --- |\n${duplicateExportNames.map((item) => `| ${item.name} | ${item.files.map(link).join('<br/>')} |`).join('\n')}\n`;
const routeIndex = {
  schemaVersion: 1,
  routes: routes.map((route) => ({
    route: route.route,
    family: route.family,
    source: route.file,
    previews: (route.interactivePreviews ?? []).map((preview) => ({
      storyTitle: preview.storyTitle,
      variant: preview.variant,
      scope: preview.scope,
      storyId: toId(preview.storyTitle, storyNameFromExport(preview.variant)),
      ...(preview.branch ? { branch: preview.branch } : {}),
    })),
  })),
};
const outputs = new Map([
  ['docs/design-system/ui-kit-route-index.json', `${JSON.stringify(routeIndex, null, 2)}\n`],
  ['docs/design-system/route-preview-coverage.md', previewCoverage],
  ['docs/design-system/component-inventory.md', componentMarkdown],
  ['docs/design-system/ui-inventory.json', `${JSON.stringify(output, null, 2)}\n`],
  ['docs/design-system/generated-inventory.md', markdown],
]);
let stale = false;
const formatOptions = await prettier.resolveConfig(path.join(root, '.prettierrc.json'));
for (const [file, source] of outputs) {
  const content = await prettier.format(source, {
    ...formatOptions,
    parser: file.endsWith('.json') ? 'json' : 'markdown',
  });
  if (process.argv.includes('--check')) {
    if (!existsSync(path.join(root, file)) || readFileSync(path.join(root, file), 'utf8') !== content) {
      console.error(`Stale generated inventory: ${file}`);
      stale = true;
    }
  } else writeFileSync(path.join(root, file), content);
}
console.log(JSON.stringify(output.counts));
if (stale) process.exitCode = 1;
