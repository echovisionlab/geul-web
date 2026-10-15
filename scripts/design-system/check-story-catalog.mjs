import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from '@typescript/tooling';
import { isExportStory, storyNameFromExport, toId } from 'storybook/internal/csf';

const roots = new Map([
  ['Design System', 2],
  ['Foundations', 2],
  ['Core', 3],
  ['Composition', 2],
  ['Feature', 3],
  ['Pages', 3],
]);
const coreCategories = new Set([
  'Actions',
  'Input',
  'Data Display',
  'Typography',
  'Layout',
  'Navigation',
  'Interaction',
  'Overlays',
  'Feedback',
  'Media',
]);
const presentationFolders = new Set(['States', 'Interactive', 'Contracts', 'Contract', 'Runtime']);
const normalize = (value) => value.toLowerCase().replace(/[^a-z0-9]/g, '');
const object = (node) => {
  if (!node) return null;
  if (ts.isSatisfiesExpression(node) || ts.isAsExpression(node) || ts.isParenthesizedExpression(node))
    return object(node.expression);
  return ts.isObjectLiteralExpression(node) ? node : null;
};

export function readStory(file, source) {
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const bindings = new Map();
  const previewHooks = new Set();
  const reactHooks = new Set();
  const localizedRenders = new Set();
  const hookErrors = [];
  for (const statement of ast.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
    const named = statement.importClause?.namedBindings;
    if (!named || !ts.isNamedImports(named)) continue;
    for (const specifier of named.elements) {
      const imported = (specifier.propertyName ?? specifier.name).text;
      if (statement.moduleSpecifier.text === 'storybook/preview-api' && imported.startsWith('use'))
        previewHooks.add(specifier.name.text);
      if (
        statement.moduleSpecifier.text === 'react' &&
        /^use(?:State|Effect|LayoutEffect|Memo|Callback|Ref|Reducer)$/.test(imported)
      )
        reactHooks.add(specifier.name.text);
      if (imported === 'localizedRender') localizedRenders.add(specifier.name.text);
    }
  }
  function inspectLocalizedHooks(node, inFixture = false) {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      if (inFixture && previewHooks.has(node.expression.text))
        hookErrors.push(
          `${node.expression.text} cannot run inside localizedRender's React fixture; use React fixture state or a top-level story hook.`,
        );
      if (localizedRenders.has(node.expression.text)) {
        for (const argument of node.arguments) inspectLocalizedHooks(argument, true);
        return;
      }
    }
    ts.forEachChild(node, (child) => inspectLocalizedHooks(child, inFixture));
  }
  inspectLocalizedHooks(ast);
  function inspectMixedHooks(node) {
    if (ts.isFunctionLike(node) && node.body) {
      const calls = new Set();
      function collect(child) {
        if (ts.isFunctionLike(child)) return;
        if (ts.isCallExpression(child) && ts.isIdentifier(child.expression)) calls.add(child.expression.text);
        ts.forEachChild(child, collect);
      }
      collect(node.body);
      if ([...calls].some((name) => previewHooks.has(name)) && [...calls].some((name) => reactHooks.has(name)))
        hookErrors.push(
          'Do not combine React state/effect hooks with Storybook preview hooks in the same function; use Storybook equivalents or a separate React fixture.',
        );
    }
    ts.forEachChild(node, inspectMixedHooks);
  }
  inspectMixedHooks(ast);
  const variants = [];
  let meta;
  for (const statement of ast.statements) {
    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (!ts.isIdentifier(declaration.name)) continue;
        bindings.set(declaration.name.text, declaration.initializer);
        if (statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword))
          variants.push(declaration.name.text);
      }
    }
    if (
      ts.isFunctionDeclaration(statement) &&
      statement.name &&
      statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)
    )
      variants.push(statement.name.text);
    if (ts.isExportAssignment(statement)) meta = statement.expression;
  }
  if (meta && ts.isIdentifier(meta)) meta = bindings.get(meta.text);
  const title = object(meta)?.properties.find(
    (property) => ts.isPropertyAssignment(property) && property.name.getText(ast).replace(/['"]/g, '') === 'title',
  )?.initializer;
  const filter = (name) => {
    const value = object(meta)?.properties.find(
      (property) => ts.isPropertyAssignment(property) && property.name.getText(ast).replace(/['"]/g, '') === name,
    )?.initializer;
    return value && ts.isArrayLiteralExpression(value)
      ? value.elements.filter(ts.isStringLiteral).map((entry) => entry.text)
      : undefined;
  };
  return {
    file,
    title: title && ts.isStringLiteral(title) ? title.text : null,
    ids:
      title && ts.isStringLiteral(title)
        ? variants
            .filter((variant) =>
              isExportStory(variant, {
                includeStories: filter('includeStories'),
                excludeStories: filter('excludeStories'),
              }),
            )
            .map((variant) => toId(title.text, storyNameFromExport(variant)))
        : [],
    errors: [
      ...ast.parseDiagnostics.map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, ' ')),
      ...hookErrors,
    ],
  };
}

export function validateStoryCatalog(stories, links = [], documentationName = 'Documentation') {
  const findings = [];
  const titles = new Map();
  const ids = new Set();
  const documentationIds = new Set();
  for (const story of stories) {
    for (const error of story.errors ?? []) findings.push(`${story.file}: ${error}`);
    if (!story.title) {
      findings.push(`${story.file}: Story metadata needs a literal title.`);
      continue;
    }
    const parts = story.title.split('/');
    documentationIds.add(toId(story.title, documentationName));
    const depth = roots.get(parts[0]);
    if (!depth || parts.length !== depth || parts.some((part) => !part.trim() || part !== part.trim()))
      findings.push(`${story.file}: Unexpected catalog path ${story.title}.`);
    if (parts[0] === 'Core' && !coreCategories.has(parts[1]))
      findings.push(`${story.file}: Unknown Core category ${parts[1]}.`);
    if (parts.some((part, index) => index > 0 && normalize(part) === normalize(parts[index - 1])))
      findings.push(`${story.file}: Repeated adjacent folder in ${story.title}.`);
    if (parts.some((part) => presentationFolders.has(part)))
      findings.push(`${story.file}: States and playgrounds belong inside the subject, not in folders.`);
    const key = parts.map(normalize).join('/');
    if (titles.has(key))
      findings.push(`${story.file}: Duplicate subject ${story.title} (also ${titles.get(key).file}).`);
    titles.set(key, story);
    for (const id of story.ids) {
      if (ids.has(id)) findings.push(`${story.file}: Duplicate story ID ${id}.`);
      ids.add(id);
    }
  }
  for (const [key, story] of titles) {
    if ([...titles.keys()].some((other) => other.startsWith(`${key}/`)))
      findings.push(`${story.file}: Subject ${story.title} is also a parent folder.`);
  }
  for (const { file, id } of links)
    if (!ids.has(id) && !documentationIds.has(id)) findings.push(`${file}: Broken story link ${id}.`);
  return findings;
}

export function checkStoryCatalog(root) {
  const files = [];
  function walk(directory) {
    if (!fs.existsSync(path.join(root, directory))) return;
    for (const entry of fs.readdirSync(path.join(root, directory), { withFileTypes: true })) {
      const file = `${directory}/${entry.name}`;
      if (entry.isDirectory()) walk(file);
      else if (/\.[cm]?[jt]sx?$/.test(entry.name)) files.push(file);
    }
  }
  for (const directory of ['components', 'features', 'stories', '.storybook']) walk(directory);
  const sources = files.map((file) => ({ file, source: fs.readFileSync(path.join(root, file), 'utf8') }));
  const stories = sources
    .filter(({ file }) => /\.(?:stories|story)\.[jt]sx?$/.test(file))
    .map(({ file, source }) => readStory(file, source));
  const links = sources
    .filter(({ file }) => !/\.(?:test|spec|type-test)\./.test(file))
    .flatMap(({ file, source }) =>
      [
        ...source.matchAll(/\b(?:design-system|foundations|core|composition|feature|pages)-[a-z0-9-]+--[a-z0-9-]+\b/g),
      ].map(([id]) => ({ file, id })),
    );
  const configuration = fs.readFileSync(path.join(root, '.storybook/main.ts'), 'utf8');
  const documentationName = configuration.match(/defaultName:\s*['"]([^'"]+)['"]/)?.[1] ?? 'Docs';
  return { stories, findings: validateStoryCatalog(stories, links, documentationName) };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = checkStoryCatalog(fileURLToPath(new URL('../../', import.meta.url)));
  for (const finding of result.findings) console.error(finding);
  if (result.findings.length) process.exitCode = 1;
  else
    console.log(
      `Storybook catalog passed: ${result.stories.length} subjects with unique paths and valid fixture links.`,
    );
}
