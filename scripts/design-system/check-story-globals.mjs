import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from '@typescript/tooling';

const providers = new Set([
  'MantineProvider',
  'NextIntlClientProvider',
  'LocaleProvider',
  'DesignSystemProvider',
  'AppDesignSystemProvider',
  'LegacyThemeBridge',
  'I18nProvider',
  'RouterProvider',
]);
const nameOf = (node) => {
  if (node && ts.isComputedPropertyName(node)) return nameOf(node.expression);
  return node && (ts.isIdentifier(node) || ts.isStringLiteralLike(node)) ? node.text : null;
};

// Global decorators own theme and locale. Content fields such as requestedLocale
// and localizationInfo describe fixtures and are intentionally outside this rule.
export function scanStorySource(source, file = 'example.stories.tsx') {
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const findings = [];
  const bindings = new Map();
  const providerNames = new Set(providers);
  const isScope = (node) => ts.isSourceFile(node) || ts.isBlock(node) || ts.isFunctionLike(node);
  function scopeOf(node) {
    for (let current = node.parent; current; current = current.parent) if (isScope(current)) return current;
    return ast;
  }
  function collect(node) {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      const scope = scopeOf(node);
      if (!bindings.has(scope)) bindings.set(scope, new Map());
      bindings.get(scope).set(node.name.text, node.initializer);
    }
    if (ts.isImportSpecifier(node) && providers.has((node.propertyName ?? node.name).text)) {
      providerNames.add(node.name.text);
    }
    ts.forEachChild(node, collect);
  }
  collect(ast);
  function resolve(node, seen = new Set()) {
    if (!node) return null;
    if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isSatisfiesExpression(node)) {
      return resolve(node.expression, seen);
    }
    if (ts.isIdentifier(node)) {
      for (let scope = node; scope; scope = scope.parent) {
        const initializer = bindings.get(scope)?.get(node.text);
        if (initializer) return seen.has(initializer) ? node : resolve(initializer, new Set([...seen, initializer]));
      }
    }
    return node;
  }
  function report(node, message) {
    const { line, character } = ast.getLineAndCharacterOfPosition(node.getStart(ast));
    findings.push({ file, line: line + 1, column: character + 1, message });
  }
  for (const diagnostic of ast.parseDiagnostics) {
    const { line, character } = ast.getLineAndCharacterOfPosition(diagnostic.start ?? 0);
    findings.push({
      file,
      line: line + 1,
      column: character + 1,
      message: `Story source parse error: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, ' ')}`,
    });
  }
  function isLiteral(node) {
    const value = resolve(node);
    return value && (ts.isStringLiteralLike(value) || ts.isNoSubstitutionTemplateLiteral(value));
  }
  function inspectGlobals(node, anchor, seen = new Set()) {
    const value = resolve(node);
    if (!value || !ts.isObjectLiteralExpression(value)) {
      report(anchor, 'Story globals must be an inspectable object; theme and locale belong to the toolbar.');
      return;
    }
    if (seen.has(value)) {
      report(anchor, 'Cyclic story globals cannot establish toolbar ownership.');
      return;
    }
    const nextSeen = new Set([...seen, value]);
    for (const property of value.properties) {
      if (ts.isSpreadAssignment(property)) inspectGlobals(property.expression, property, nextSeen);
      else if (['theme', 'locale'].includes(nameOf(property.name))) {
        report(property, 'Story globals must not override the theme or locale toolbar.');
      }
    }
  }
  function inspectArgs(node, seen = new Set()) {
    const value = resolve(node);
    if (!value || !ts.isObjectLiteralExpression(value) || seen.has(value)) return;
    const nextSeen = new Set([...seen, value]);
    for (const property of value.properties) {
      if (ts.isSpreadAssignment(property)) inspectArgs(property.expression, nextSeen);
      else if (
        ts.isPropertyAssignment(property) &&
        nameOf(property.name) === 'locale' &&
        isLiteral(property.initializer)
      ) {
        report(property, 'Locale args must come from the global locale context, not a fixed string.');
      }
    }
  }
  function visit(node) {
    if (ts.isPropertyAssignment(node) || ts.isShorthandPropertyAssignment(node)) {
      const key = nameOf(node.name);
      const value = ts.isPropertyAssignment(node) ? node.initializer : node.name;
      if (key === 'globals') inspectGlobals(value, node);
      if (key === 'args') inspectArgs(value);
    }
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const provider = providerNames.has(node.tagName.getText(ast).split('.').at(-1));
      if (provider)
        report(
          node,
          'Theme and locale providers belong to the global Storybook decorator; local wrappers shadow toolbar settings.',
        );
      for (const attr of node.attributes.properties) {
        if (ts.isJsxSpreadAttribute(attr)) {
          inspectArgs(attr.expression);
          continue;
        }
        if (!ts.isJsxAttribute(attr)) continue;
        const key = nameOf(attr.name);
        const initializer =
          attr.initializer && ts.isJsxExpression(attr.initializer) ? attr.initializer.expression : attr.initializer;
        if (!provider && key === 'locale' && isLiteral(initializer)) {
          report(attr, 'JSX locale must follow the global locale context, not a fixed string.');
        }
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  return findings;
}

export function collectStorySources(root) {
  const files = [];
  function walk(directory, helpers) {
    if (!fs.existsSync(directory)) return;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (['node_modules', 'storybook-static', 'fixtures', '__fixtures__'].includes(entry.name)) continue;
      const filename = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(filename, helpers);
      else if (
        !(directory === path.join(root, '.storybook') && /^(?:main|manager|preview)\.[jt]sx?$/.test(entry.name)) &&
        /\.(?:[cm]?[jt]sx?)$/.test(entry.name) &&
        !/\.(?:test|spec)\./.test(entry.name) &&
        (helpers || /\.(?:stories|story)\.[jt]sx?$/.test(entry.name))
      )
        files.push(filename);
    }
  }
  walk(path.join(root, 'components'), false);
  walk(path.join(root, 'features'), false);
  walk(path.join(root, 'stories'), true);
  walk(path.join(root, '.storybook'), true);
  return files.sort();
}

export function checkStoryGlobals(root) {
  const files = collectStorySources(root);
  return {
    files: files.length,
    findings: files.flatMap((file) => scanStorySource(fs.readFileSync(file, 'utf8'), path.relative(root, file))),
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const result = checkStoryGlobals(root);
  for (const finding of result.findings)
    console.error(`${finding.file}:${finding.line}:${finding.column} ${finding.message}`);
  if (result.findings.length) {
    console.error(
      `Storybook toolbar guard failed: ${result.findings.length} override(s) in ${result.files} source files.`,
    );
    process.exitCode = 1;
  } else
    console.log(
      `Storybook toolbar guard passed: no theme/locale override patterns in ${result.files} stories and preview helpers.`,
    );
}
