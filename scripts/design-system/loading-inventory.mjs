/** Read-only loading candidate census. See docs/design-system/loading-inventory.md. */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from '@typescript/tooling';
import { filesUnder, projectPath } from './review-data.mjs';

const scope = ['app', 'features', 'components', 'lib'];
const extensions = ['.tsx', '.ts', '.jsx', '.js', '.mts', '.mjs', '.cts', '.cjs'];
const sourcePattern = /\.[cm]?[jt]sx?$/;
const hash = (text) => createHash('sha256').update(text).digest('hex');
const sorted = (items) => [...new Set(items)].sort();
const compact = (text) => text.replace(/\s+/g, ' ').trim().slice(0, 240);
const textOf = (node) => node?.getText() ?? '';
const unwrap = (node) =>
  node && (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isSatisfiesExpression(node))
    ? unwrap(node.expression)
    : node;
const tokens = (name) =>
  name
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z0-9]+/);
const pendingName = (name) => tokens(name).some((token) => /^(loading|pending|fetching|processing|busy)$/.test(token));
const surfaceName = (name) => /Loader|Loading|Skeleton|Spinner|Progress|Suspense|ProcessingOverlay/.test(name);
const sharedDefinitions = [
  ['site/PageLoader', 'features/site/PageLoader/PageLoader.tsx', 'PageLoader'],
  ['core/PageLoaderView', 'components/core/LoadingSurface/PageLoaderView.tsx', 'PageLoaderView'],
  ['core/ProcessingOverlay', 'components/core/LoadingSurface/ProcessingOverlay.tsx', 'ProcessingOverlay'],
  ['core/Spinner', 'components/core/Display/Display.tsx', 'Spinner'],
  ['core/Skeleton', 'components/core/Display/Display.tsx', 'Skeleton'],
  ['core/Progress', 'components/core/Progress/Progress.tsx', 'Progress'],
  ['core/RouteProgressBar', 'components/core/Progress/RouteProgressBar.tsx', 'RouteProgressBar'],
  ['core/NearEndLoader', 'components/core/Display/NearEndLoader.tsx', 'NearEndLoader'],
];

export function exclusionReason(file) {
  if (!sourcePattern.test(file)) return 'non-source';
  if (
    /(?:^|\/)(?:__tests__|tests?|testing|test-utils|specs?|__specs__|__fixtures__|fixtures|__mocks__|node_modules|vendor|generated|gen|storybook-static)(?:\/|$)/.test(
      file,
    )
  )
    return 'test-fixture-or-generated-directory';
  if (/(?:^|\/)(?:stories|__stories__|\.storybook)(?:\/|$)/.test(file)) return 'story-directory';
  if (
    /(?:\.|-)(?:test|spec|type-test|story|stories|fixture|fixtures|test-fixture|test-fixtures|story-fixtures)\.[cm]?[jt]sx?$/.test(
      file,
    )
  )
    return 'test-story-or-fixture-file';
  if (/\.d\.[cm]?ts$/.test(file)) return 'declaration-file';
  return null;
}

function sourceOwner(file) {
  const parts = file.split('/');
  if (parts[0] === 'features') return `Feature/${parts[1]}`;
  if (parts[0] === 'components') return `Components/${parts[1] === 'core' ? `core/${parts[2]}` : parts[1]}`;
  if (parts[0] === 'lib') return `Lib/${parts[1]}`;
  return 'App';
}

function parse(file, text) {
  const source = ts.createSourceFile(
    file,
    text,
    ts.ScriptTarget.Latest,
    true,
    /x$/.test(file) ? ts.ScriptKind.TSX : /\.[cm]?js$/.test(file) ? ts.ScriptKind.JS : ts.ScriptKind.TS,
  );
  const imports = new Map();
  const exports = new Map();
  const stars = [];
  const locals = new Map();
  const exported = (node) => node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword);
  const isDefault = (node) => node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.DefaultKeyword);
  for (const node of source.statements) {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier) && !node.importClause?.isTypeOnly) {
      const module = node.moduleSpecifier.text;
      const clause = node.importClause;
      if (clause?.name) imports.set(clause.name.text, { module, symbol: 'default' });
      const bindings = clause?.namedBindings;
      if (bindings && ts.isNamespaceImport(bindings)) imports.set(bindings.name.text, { module, symbol: '*' });
      if (bindings && ts.isNamedImports(bindings))
        for (const item of bindings.elements)
          if (!item.isTypeOnly)
            imports.set(item.name.text, { module, symbol: item.propertyName?.text ?? item.name.text });
    }
    if (ts.isExportDeclaration(node) && !node.isTypeOnly) {
      const module =
        node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier) ? node.moduleSpecifier.text : null;
      if (!node.exportClause && module) stars.push(module);
      else if (node.exportClause && ts.isNamespaceExport(node.exportClause))
        exports.set(node.exportClause.name.text, { module, symbol: '*' });
      else if (node.exportClause && ts.isNamedExports(node.exportClause))
        for (const item of node.exportClause.elements)
          if (!item.isTypeOnly)
            exports.set(item.name.text, { module, symbol: item.propertyName?.text ?? item.name.text });
    }
    if ((ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node)) && exported(node)) {
      const symbol = node.name?.text ?? 'default';
      exports.set(isDefault(node) ? 'default' : symbol, { local: symbol });
    }
    if (ts.isVariableStatement(node))
      for (const declaration of node.declarationList.declarations)
        if (ts.isIdentifier(declaration.name)) {
          locals.set(declaration.name.text, declaration.initializer);
          if (exported(node)) exports.set(declaration.name.text, { local: declaration.name.text });
        }
    if (ts.isExportAssignment(node) && !node.isExportEquals) exports.set('default', { expression: node.expression });
  }
  const lexicalSignals = text.split(/\r?\n/).flatMap((line, index) => {
    const terms = sorted(
      [
        ...line.matchAll(
          /loader|loading|pending|suspense|fallback|skeleton|spinner|processing|aria-busy|return\s+null/gi,
        ),
      ].map((match) => match[0].toLowerCase()),
    );
    return terms.length ? [{ line: index + 1, terms, snippet: compact(line) }] : [];
  });
  return { file, text, source, imports, exports, stars, locals, lexicalSignals, sha256: hash(text) };
}

function resolver(records) {
  const moduleCache = new Map();
  const exportCache = new Map();
  const referenceCache = new Map();
  function moduleTarget(from, module) {
    const key = `${from}\0${module}`;
    if (moduleCache.has(key)) return moduleCache.get(key);
    const base = module.startsWith('@/')
      ? module.slice(2)
      : module.startsWith('.')
        ? path.posix.normalize(path.posix.join(path.posix.dirname(from), module))
        : null;
    if (!base) return null;
    const withoutExtension = base.replace(/\.[cm]?jsx?$/, '');
    const target =
      [
        base,
        ...extensions.map((ext) => base + ext),
        ...extensions.map((ext) => `${base}/index${ext}`),
        ...extensions.map((ext) => withoutExtension + ext),
      ].find((file) => records.has(file)) ?? null;
    moduleCache.set(key, target);
    return target;
  }
  function followModule(from, module, symbol, visited) {
    if (module === 'react') symbol = symbol.replace(/^default\./, '');
    const target = moduleTarget(from, module);
    const step = { file: from, module, target, symbol };
    if (target)
      return followExport(target, symbol, visited).map((origin) => ({ ...origin, via: [step, ...origin.via] }));
    return [
      {
        file: null,
        module,
        symbol,
        status: module.startsWith('.') || module.startsWith('@/') ? 'unresolved' : 'external',
        via: [step],
      },
    ];
  }
  function followLocal(file, name, visited) {
    const [head, ...tail] = name.split('.');
    const record = records.get(file);
    const binding = record.imports.get(head);
    if (binding)
      return followModule(
        file,
        binding.module,
        [binding.symbol === '*' ? '' : binding.symbol, ...tail].filter(Boolean).join('.') || '*',
        visited,
      );
    const initializer = unwrap(record.locals.get(head));
    if (!tail.length && initializer && (ts.isIdentifier(initializer) || ts.isPropertyAccessExpression(initializer))) {
      const key = `local:${file}:${name}`;
      if (visited.has(key)) return [];
      return followLocal(file, textOf(initializer), new Set([...visited, key]));
    }
    return [{ file, symbol: name, status: 'local', via: [] }];
  }
  function followExport(file, symbol, visited) {
    const key = `${file}:${symbol}`;
    if (visited.has(key)) return [];
    if (!visited.size && exportCache.has(key)) return exportCache.get(key);
    const origins = exportOrigins(file, symbol, new Set([...visited, key]));
    if (!visited.size) exportCache.set(key, origins);
    return origins;
  }
  function exportOrigins(file, symbol, visited) {
    const record = records.get(file);
    if (symbol === '*') return [{ file, symbol, status: 'namespace', via: [] }];
    const [head, ...tail] = symbol.split('.');
    const entry = record.exports.get(head);
    if (entry) {
      if (entry.module)
        return followModule(
          file,
          entry.module,
          [entry.symbol === '*' ? '' : entry.symbol, ...tail].filter(Boolean).join('.') || '*',
          visited,
        );
      if (entry.expression) {
        const expression = unwrap(entry.expression);
        return ts.isIdentifier(expression) || ts.isPropertyAccessExpression(expression)
          ? followLocal(file, [textOf(expression), ...tail].join('.'), visited)
          : [];
      }
      return followLocal(file, [entry.local ?? entry.symbol, ...tail].join('.'), visited);
    }
    return record.stars.flatMap((module) => followModule(file, module, symbol, visited));
  }
  function reference(file, name) {
    const key = `${file}\0${name}`;
    if (referenceCache.has(key)) return referenceCache.get(key);
    const origins = [
      ...new Map(
        followLocal(file, name, new Set()).map((origin) => [
          JSON.stringify([origin.file, origin.module, origin.symbol]),
          origin,
        ]),
      ).values(),
    ];
    const binding = records.get(file).imports.get(name.split('.')[0]);
    const firstImport = origins[0]?.via.find((step) => step.file === file);
    const result = {
      local: name,
      module: binding?.module ?? firstImport?.module ?? null,
      target: binding ? moduleTarget(file, binding.module) : (firstImport?.target ?? null),
      status: !origins.length
        ? 'unresolved'
        : origins.length > 1
          ? 'ambiguous'
          : origins[0].status === 'local' && (binding || firstImport)
            ? 'resolved'
            : origins[0].status,
      origins,
    };
    referenceCache.set(key, result);
    return result;
  }
  return { reference, moduleTarget };
}

function sharedSurfaces(reference) {
  return sorted(
    reference.origins.flatMap((origin) => {
      if (origin.module === 'react' && origin.symbol === 'Suspense') return ['react/Suspense'];
      return sharedDefinitions
        .filter(([, file, symbol]) => origin.file === file && origin.symbol === symbol)
        .map(([id]) => id);
    }),
  );
}

function shape(value) {
  const node = unwrap(value);
  if (!node) return 'missing';
  if (node.kind === ts.SyntaxKind.NullKeyword) return 'null';
  if (ts.isStringLiteralLike(node)) return node.text.trim() ? 'text' : 'empty-text';
  if (ts.isJsxFragment(node))
    return node.children.every((child) => ts.isJsxText(child) && !child.text.trim()) ? 'empty-fragment' : 'jsx';
  if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) return 'jsx';
  if (ts.isArrayLiteralExpression(node) && !node.elements.length) return 'empty-array';
  if (ts.isArrowFunction(node) || ts.isFunctionExpression(node) || ts.isMethodDeclaration(node)) return 'callback';
  if (ts.isIdentifier(node)) return 'reference';
  return 'expression';
}
const blank = (node) => ['null', 'empty-fragment', 'empty-text', 'empty-array'].includes(shape(node));
const functionLike = (node) => ts.isFunctionLike(node) && Boolean(node.body);
function enclosingFunction(node) {
  for (let parent = node.parent; parent; parent = parent.parent) if (functionLike(parent)) return parent;
  return null;
}
function functionName(node) {
  if (!node) return null;
  if (node.name) return textOf(node.name);
  if (ts.isVariableDeclaration(node.parent) || ts.isPropertyAssignment(node.parent)) return textOf(node.parent.name);
  return '<callback>';
}
function hasJsx(node) {
  if (!node) return false;
  if (ts.isJsxElement(node) || ts.isJsxFragment(node) || ts.isJsxSelfClosingElement(node)) return true;
  if (functionLike(node)) return false;
  return Boolean(ts.forEachChild(node, hasJsx));
}
function pendingCondition(node) {
  let found = false;
  function visit(child) {
    if (
      (ts.isIdentifier(child) && pendingName(child.text)) ||
      (ts.isStringLiteralLike(child) &&
        /^(loading|pending|fetching|processing|busy|connecting|buffering)$/.test(child.text))
    )
      found = true;
    ts.forEachChild(child, visit);
  }
  visit(node);
  return found;
}
function conditions(node) {
  const result = [];
  for (let current = node, parent = node.parent; parent; current = parent, parent = parent.parent) {
    if (functionLike(parent)) break;
    if (ts.isIfStatement(parent) && current !== parent.expression)
      result.push({
        expression: compact(textOf(parent.expression)),
        branch: current === parent.thenStatement ? 'then' : 'else',
        pending: pendingCondition(parent.expression),
      });
    if (ts.isConditionalExpression(parent) && current !== parent.condition)
      result.push({
        expression: compact(textOf(parent.condition)),
        branch: current === parent.whenTrue ? 'then' : 'else',
        pending: pendingCondition(parent.condition),
      });
    if (
      ts.isBinaryExpression(parent) &&
      current === parent.right &&
      [ts.SyntaxKind.AmpersandAmpersandToken, ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken].includes(
        parent.operatorToken.kind,
      )
    )
      result.push({
        expression: compact(textOf(parent.left)),
        branch: textOf(parent.operatorToken),
        pending: pendingCondition(parent.left),
      });
  }
  return result;
}

function candidatesFor(record, resolve) {
  const { file, source } = record;
  const rows = [];
  const renderFunctions = new Map();
  const renderContext = (node) => {
    const fn = enclosingFunction(node);
    if (!renderFunctions.has(fn))
      renderFunctions.set(fn, Boolean(fn && (hasJsx(fn.body) || /^[A-Z]/.test(functionName(fn) ?? ''))));
    for (let current = node.parent; current && current !== fn; current = current.parent)
      if (ts.isJsxExpression(current)) return true;
    return renderFunctions.get(fn);
  };
  function add(node, kind, extra = {}, reference = null) {
    const position = source.getLineAndCharacterOfPosition(node.getStart(source));
    const sharedSurface = reference ? sharedSurfaces(reference) : [];
    rows.push({
      file,
      sha256: record.sha256,
      line: position.line + 1,
      column: position.character + 1,
      kind,
      owner: sourceOwner(file),
      enclosingFunction: functionName(enclosingFunction(node)),
      context: renderContext(node) ? 'render-candidate' : 'non-render-or-unproven',
      snippet: compact(textOf(node)),
      conditions: conditions(node),
      importTarget: reference,
      sharedSurface,
      classification: 'manual-required',
      surfaceResolution: sharedSurface.length
        ? 'named-shared-surface'
        : reference?.status === 'resolved'
          ? 'resolved-other-surface'
          : 'unresolved-or-not-a-surface',
      ...extra,
    });
  }
  const fallbackDetails = (node) => {
    const outcomes = [];
    const visit = (child) => {
      if (functionLike(child)) return;
      if (ts.isReturnStatement(child))
        outcomes.push({ shape: shape(child.expression), snippet: compact(textOf(child.expression)) });
      ts.forEachChild(child, visit);
    };
    if (node && functionLike(unwrap(node))) {
      const body = unwrap(node).body;
      if (ts.isBlock(body)) visit(body);
      else outcomes.push({ shape: shape(body), snippet: compact(textOf(body)) });
    }
    return { shape: shape(node), callbackReturns: outcomes };
  };
  function visit(node) {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = textOf(node.tagName);
      const reference = resolve.reference(file, tag);
      const shared = sharedSurfaces(reference);
      const attributes = node.attributes.properties;
      const attribute = (name) => attributes.find((item) => ts.isJsxAttribute(item) && textOf(item.name) === name);
      const value = (attr) =>
        attr?.initializer && (ts.isJsxExpression(attr.initializer) ? attr.initializer.expression : attr.initializer);
      const suspense = shared.includes('react/Suspense') || tag.split('.').at(-1) === 'Suspense';
      if (
        tag === 'progress' ||
        surfaceName(tag) ||
        shared.length ||
        reference.origins.some((origin) => surfaceName(origin.symbol))
      )
        add(node, 'jsx-surface', { tag, attributes: attributes.map((item) => compact(textOf(item))) }, reference);
      if (suspense)
        add(node, 'suspense-fallback', { fallback: fallbackDetails(value(attribute('fallback'))) }, reference);
      for (const attr of attributes) {
        if (ts.isJsxSpreadAttribute(attr)) {
          add(attr, 'jsx-spread', { reason: 'Pending props or surfaces may be supplied by this spread.' }, reference);
          continue;
        }
        const name = textOf(attr.name);
        if (
          pendingName(name) &&
          !(
            name === 'loading' &&
            ts.isStringLiteralLike(value(attr) ?? node) &&
            /^(lazy|eager)$/.test(value(attr).text)
          )
        )
          add(attr, 'pending-prop', { prop: name, valueShape: shape(value(attr)) }, reference);
        if (name === 'role' && ['status', 'progressbar'].includes(value(attr)?.text))
          add(attr, 'status-region', { role: value(attr).text }, reference);
      }
    }
    if (ts.isCallExpression(node)) {
      const name = textOf(node.expression);
      const reference = resolve.reference(file, name);
      const api = reference.origins.find(
        (origin) =>
          (origin.module === 'next/dynamic' && origin.symbol === 'default') ||
          (origin.module === 'react' && origin.symbol === 'lazy'),
      );
      if (api || /^(dynamic|lazy|React\.lazy)$/.test(name)) {
        const lazy = api ? api.module === 'react' : /lazy$/.test(name);
        const first = unwrap(node.arguments[0]);
        const options = unwrap(node.arguments[1]) ?? (first && ts.isObjectLiteralExpression(first) ? first : null);
        const loading =
          options && ts.isObjectLiteralExpression(options)
            ? options.properties.find(
                (item) =>
                  (ts.isPropertyAssignment(item) ||
                    ts.isShorthandPropertyAssignment(item) ||
                    ts.isMethodDeclaration(item)) &&
                  textOf(item.name).replace(/['"]/g, '') === 'loading',
              )
            : null;
        const fallback = ts.isPropertyAssignment(loading ?? node)
          ? loading.initializer
          : ts.isMethodDeclaration(loading ?? node)
            ? loading
            : loading?.name;
        const imports = [];
        function imported(child) {
          if (ts.isCallExpression(child) && child.expression.kind === ts.SyntaxKind.ImportKeyword)
            imports.push({
              module: child.arguments[0] && ts.isStringLiteralLike(child.arguments[0]) ? child.arguments[0].text : null,
              target:
                child.arguments[0] && ts.isStringLiteralLike(child.arguments[0])
                  ? resolve.moduleTarget(file, child.arguments[0].text)
                  : null,
            });
          ts.forEachChild(child, imported);
        }
        imported(node);
        add(
          node,
          lazy ? 'lazy-call' : 'dynamic-call',
          {
            apiResolution: api ? 'import-resolved' : 'name-only',
            imports,
            fallback: lazy ? { shape: 'supplied-by-suspense', callbackReturns: [] } : fallbackDetails(fallback),
            optionsUnresolved:
              !lazy &&
              Boolean(
                options && (!ts.isObjectLiteralExpression(options) || options.properties.some(ts.isSpreadAssignment)),
              ),
          },
          reference,
        );
      }
    }
    if (ts.isReturnStatement(node) && blank(node.expression))
      add(node, 'blank-return', { valueShape: shape(node.expression) });
    if (ts.isJsxExpression(node) && blank(node.expression))
      add(node, 'blank-jsx-expression', { valueShape: shape(node.expression) });
    if (ts.isArrowFunction(node) && blank(node.body)) add(node.body, 'blank-return', { valueShape: shape(node.body) });
    if (ts.isConditionalExpression(node)) {
      const pending = pendingCondition(node.condition);
      if (renderContext(node) && (pending || blank(node.whenTrue) || blank(node.whenFalse)))
        add(node, pending ? 'pending-branch' : 'blank-branch', {
          condition: compact(textOf(node.condition)),
          outcomes: [shape(node.whenTrue), shape(node.whenFalse)],
        });
    }
    if (ts.isIfStatement(node) && pendingCondition(node.expression) && renderContext(node)) {
      const returns = [];
      function returned(child) {
        if (functionLike(child)) return;
        if (ts.isReturnStatement(child)) returns.push(shape(child.expression));
        ts.forEachChild(child, returned);
      }
      returned(node.thenStatement);
      if (node.elseStatement) returned(node.elseStatement);
      if (returns.length || hasJsx(node.thenStatement) || hasJsx(node.elseStatement))
        add(node, 'pending-branch', { condition: compact(textOf(node.expression)), outcomes: returns });
    }
    if (
      ts.isBinaryExpression(node) &&
      renderContext(node) &&
      pendingCondition(node.left) &&
      [ts.SyntaxKind.AmpersandAmpersandToken, ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken].includes(
        node.operatorToken.kind,
      )
    )
      add(node, 'pending-branch', {
        condition: compact(textOf(node.left)),
        outcomes: [shape(node.right)],
        operator: textOf(node.operatorToken),
      });
    if (ts.isJsxText(node) && node.text.trim() && conditions(node).some((condition) => condition.pending))
      add(node, 'pending-text');
    if (
      ts.isPropertyAssignment(node) &&
      pendingName(textOf(node.name)) &&
      ['jsx', 'callback', 'null', 'text', 'empty-fragment', 'reference'].includes(shape(node.initializer))
    )
      add(node, 'pending-property', { property: textOf(node.name), valueShape: shape(node.initializer) });
    ts.forEachChild(node, visit);
  }
  visit(source);
  return rows;
}

function listing(root) {
  return scope
    .flatMap((directory) => (existsSync(path.join(root, directory)) ? filesUnder(root, directory) : []))
    .sort();
}
function featureDomains(root) {
  return existsSync(path.join(root, 'features'))
    ? readdirSync(path.join(root, 'features'), { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort()
    : [];
}
function counts(files, rows, records) {
  return {
    sourceFiles: files.length,
    candidateFiles: new Set(rows.map((row) => row.file)).size,
    candidates: rows.length,
    lexicalSignalFiles: files.filter((file) => records.get(file).lexicalSignals.length).length,
    lexicalSignalLines: files.reduce((sum, file) => sum + records.get(file).lexicalSignals.length, 0),
    namedSharedSurfaceCandidates: rows.filter((row) => row.sharedSurface.length).length,
    manualRequired: rows.length,
    byKind: Object.fromEntries(
      sorted(rows.map((row) => row.kind)).map((kind) => [kind, rows.filter((row) => row.kind === kind).length]),
    ),
  };
}

export function collectLoadingInventory({ root = path.resolve(import.meta.dirname, '../..') } = {}) {
  root = path.resolve(root);
  const all = listing(root);
  const domains = featureDomains(root);
  const excludedSources = all
    .filter((file) => sourcePattern.test(file) && exclusionReason(file))
    .map((file) => ({ file, reason: exclusionReason(file) }));
  const files = all.filter((file) => !exclusionReason(file));
  const records = new Map(files.map((file) => [file, parse(file, readFileSync(projectPath(root, file), 'utf8'))]));
  const resolve = resolver(records);
  const candidates = [...records.values()].flatMap((record) => candidatesFor(record, resolve));
  candidates.sort((a, b) =>
    a.file < b.file
      ? -1
      : a.file > b.file
        ? 1
        : a.line - b.line || a.column - b.column || (a.kind < b.kind ? -1 : a.kind > b.kind ? 1 : 0),
  );
  for (const row of candidates) row.id = `${row.file}:${row.line}:${row.column}:${row.kind}`;
  const sources = [...records.values()].map((record) => ({
    file: record.file,
    sha256: record.sha256,
    owner: sourceOwner(record.file),
    lexicalSignals: record.lexicalSignals,
    parseDiagnostics: record.source.parseDiagnostics.map((diagnostic) => ({
      line: record.source.getLineAndCharacterOfPosition(diagnostic.start ?? 0).line + 1,
      message: compact(ts.flattenDiagnosticMessageText(diagnostic.messageText, ' ')),
    })),
    imports: [...record.imports].map(([local]) => resolve.reference(record.file, local)),
  }));
  const changed = sources
    .filter(
      (source) =>
        !existsSync(projectPath(root, source.file)) ||
        hash(readFileSync(projectPath(root, source.file))) !== source.sha256,
    )
    .map((source) => source.file);
  if (
    JSON.stringify(all) !== JSON.stringify(listing(root)) ||
    JSON.stringify(domains) !== JSON.stringify(featureDomains(root)) ||
    changed.length
  )
    throw new Error(
      `Source changed during the census; rerun against a stable filesystem snapshot. Changed production files: ${changed.slice(0, 12).join(', ') || 'enumeration changed'}`,
    );
  const sourceManifest = sources.map(({ file, sha256 }) => ({ file, sha256 }));
  const sourceManifestHash = hash(sourceManifest.map(({ file, sha256 }) => `${file}\0${sha256}`).join('\n'));
  return {
    schemaVersion: 1,
    methodology:
      'Static AST candidates, not semantic loading coverage or migration defects. Every candidate requires owner review; no async-I/O loading requirement is inferred.',
    scope,
    sourceIdentity: {
      sourceManifestHash,
      enumerationHash: hash(JSON.stringify({ all, domains })),
      scannerSha256: hash(readFileSync(fileURLToPath(import.meta.url))),
      filesUnderSha256: hash(readFileSync(new URL('./review-data.mjs', import.meta.url))),
      typescriptVersion: ts.version,
      consistency:
        'Enumeration and production content rechecked after scanning; optimistic snapshot, not an atomic filesystem transaction.',
    },
    totals: {
      allFiles: all.length,
      excludedSourceFiles: excludedSources.length,
      nonSourceFiles: all.filter((file) => !sourcePattern.test(file)).length,
      featureDomains: domains.length,
      parseDiagnostics: sources.reduce((sum, source) => sum + source.parseDiagnostics.length, 0),
      ...counts(files, candidates, records),
    },
    roots: scope.map((directory) => ({
      root: directory,
      present: existsSync(path.join(root, directory)),
      allFiles: all.filter((file) => file.startsWith(`${directory}/`)).length,
      excludedSourceFiles: excludedSources.filter(({ file }) => file.startsWith(`${directory}/`)).length,
      ...counts(
        files.filter((file) => file.startsWith(`${directory}/`)),
        candidates.filter((row) => row.file.startsWith(`${directory}/`)),
        records,
      ),
    })),
    domains: domains.map((domain) => ({
      domain,
      owner: `Feature/${domain}`,
      ...counts(
        files.filter((file) => file.startsWith(`features/${domain}/`)),
        candidates.filter((row) => row.file.startsWith(`features/${domain}/`)),
        records,
      ),
    })),
    namedSharedSurfaces: sharedDefinitions.map(([id, file, symbol]) => ({
      id,
      file,
      symbol,
      present: records.has(file),
      candidateIds: candidates.filter((row) => row.sharedSurface.includes(id)).map((row) => row.id),
    })),
    sourceManifest,
    excludedSources,
    sources,
    candidates,
    manualClassification: {
      status: 'not-performed',
      required: candidates.length,
      fields: [
        'sourceManifestHash',
        'file',
        'sha256',
        'line',
        'candidateIds',
        'owner',
        'status',
        'waitScope',
        'currentSurface',
        'messageSource',
        'disposition',
        'reason',
        'evidence',
        'reviewer',
      ],
      guidance: 'docs/design-system/loading-inventory.md',
    },
    limits: [
      'No runtime, browser, Storybook, route permission, network, GIF, accessibility or containing-region validation.',
      'Resolution supports @/ and relative production modules, value imports, namespaces, local aliases and barrel exports; computed paths, package internals, require, shadowing and arbitrary data flow need manual tracing.',
      'Names, conditions and JSX spreads are triage evidence. Unrelated helper nulls, native status/data progress, background work and intentional invisible boundaries can appear.',
      'Per-source lexicalSignals include comments, imports and metadata. They help find AST misses and require separate triage; they are not added to AST candidate counts.',
      'CSS, imperative DOM status creation, arbitrary translated status text, inferred ReactNode types, preceding guard implications and waits without recognizable syntax are outside candidate detection.',
      'Missing dynamic loading options and lazy calls identify chunk boundaries; they do not prove a visible wait or missing UI. Shared-surface identity does not approve a consumer.',
    ],
  };
}

function main(args) {
  if (args.length === 1 && ['--help', '-h'].includes(args[0])) {
    process.stdout.write(
      'Usage: node scripts/design-system/loading-inventory.mjs [--root <checkout>]\nEmits JSON to stdout; writes no files. See docs/design-system/loading-inventory.md.\n',
    );
    return;
  }
  if (args.length && (args.length !== 2 || args[0] !== '--root' || !args[1]))
    throw new Error('Use --help or --root <checkout>.');
  const root = args.length ? path.resolve(args[1]) : path.resolve(import.meta.dirname, '../..');
  if (!existsSync(root)) throw new Error(`Missing checkout: ${root}`);
  process.stdout.write(`${JSON.stringify(collectLoadingInventory({ root }), null, 2)}\n`);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
