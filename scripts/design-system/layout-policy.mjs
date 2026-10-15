import fs from 'node:fs';
import path from 'node:path';
import ts from '@typescript/tooling';
import postcss from 'postcss';
import { isProductionSource, sourceRoots } from './token-policy.mjs';

// Exact migrated consumers; expanding this list requires migrating the file, not a baseline.
export const strictLayoutConsumers = new Set([
  'features/document-layout/ui/ContentLayoutFieldView.tsx',
  'features/admin/MapThemeEditor/MapThemeListView.tsx',
  'features/program-event/ProgramEventSeriesPublicView.tsx',
  'features/participants/ParticipantRow.tsx',
  'features/label/LabelEditor/ui/LabelParticipantsDialogView.tsx',
  'features/post/PostEditor/ui/PostParticipantsDialogView.tsx',
  'features/artist/ArtistEditor/ArtistBioEditor.tsx',
  'features/label/LabelEditor/LabelDescriptionEditor.tsx',
  'features/release/ReleaseEditor/ReleaseDescriptionEditor.tsx',
]);
export const layoutExports = new Set([
  'LayoutStack',
  'LayoutInline',
  'LayoutInset',
  'LayoutSpacer',
  'LayoutContainer',
  'LayoutGrid',
  'LayoutGridItem',
]);
export const mantineLayoutExports = new Set([
  'Box',
  'Stack',
  'Group',
  'Flex',
  'Grid',
  'SimpleGrid',
  'Space',
  'Center',
  'Container',
]);
export const forbiddenLayoutProps = new Set([
  'style',
  'styles',
  'className',
  'classNames',
  'vars',
  'unstyled',
  'p',
  'px',
  'py',
  'pt',
  'pb',
  'pl',
  'pr',
  'ps',
  'pe',
  'm',
  'mx',
  'my',
  'mt',
  'mb',
  'ml',
  'mr',
  'ms',
  'me',
  'w',
  'h',
  'miw',
  'mih',
  'maw',
  'mah',
  'bg',
  'c',
  'opacity',
  'bd',
  'bdrs',
  'ff',
  'fz',
  'fw',
  'lh',
  'ta',
  'tt',
  'td',
  'display',
  'pos',
  'top',
  'left',
  'bottom',
  'right',
  'flex',
  'hiddenFrom',
  'visibleFrom',
]);
const normalize = (file) => file.split(path.sep).join('/');
const owner = (file) => /^components\/core\/Layout\//.test(normalize(file));
const canonical = (specifier) =>
  specifier === '@/components/core/Layout' || specifier.startsWith('@/components/core/Layout/');
const coreBarrel = (specifier) => specifier === '@/components/core' || specifier === '@/components/core/index';
const ownedStyle = (value) =>
  /(?:^|\/)components\/core\/Layout\/.*\.css$/.test(value) || /^@\/components\/core\/Layout\/.*\.css$/.test(value);
const protectedText = (value) => /--_layout-[\w-]+|data-geul-layout/.test(value);

/** Resolve simple local re-export barrels. Deliberately does not claim arbitrary runtime alias resolution. */
export function createLayoutResolver(root) {
  const cache = new Map();
  function resolveFile(from, specifier) {
    const base = specifier.startsWith('@/')
      ? path.join(root, specifier.slice(2))
      : specifier.startsWith('.')
        ? path.resolve(root, path.dirname(from), specifier)
        : null;
    if (!base) return null;
    for (const candidate of [
      base,
      `${base}.tsx`,
      `${base}.ts`,
      path.join(base, 'index.tsx'),
      path.join(base, 'index.ts'),
    ]) {
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return normalize(path.relative(root, candidate));
    }
    return null;
  }
  function exportsFor(from, specifier, seen = new Set(), kind = 'layout') {
    if (kind === 'layout' && (canonical(specifier) || coreBarrel(specifier)))
      return new Map([...layoutExports].map((name) => [name, name]));
    if (kind === 'mantine' && specifier === '@mantine/core')
      return new Map([...mantineLayoutExports].map((name) => [name, name]));
    const file = resolveFile(from, specifier);
    if (!file || seen.has(file)) return new Map();
    const cacheKey = `${kind}:${file}`;
    if (cache.has(cacheKey)) return cache.get(cacheKey);
    const next = new Set(seen).add(file);
    const ast = ts.createSourceFile(file, fs.readFileSync(path.join(root, file), 'utf8'), ts.ScriptTarget.Latest, true);
    const result = new Map();
    for (const statement of ast.statements) {
      if (
        !ts.isExportDeclaration(statement) ||
        !statement.moduleSpecifier ||
        !ts.isStringLiteralLike(statement.moduleSpecifier)
      )
        continue;
      const upstream = exportsFor(file, statement.moduleSpecifier.text, next, kind);
      if (!statement.exportClause) for (const [name, origin] of upstream) result.set(name, origin);
      else if (ts.isNamedExports(statement.exportClause))
        for (const item of statement.exportClause.elements) {
          const origin = upstream.get(item.propertyName?.text ?? item.name.text);
          if (origin && !item.isTypeOnly && !statement.isTypeOnly) result.set(item.name.text, origin);
        }
    }
    cache.set(cacheKey, result);
    return result;
  }
  return {
    exportsFor,
    resolveFile,
    mantineExportsFor: (from, specifier) => exportsFor(from, specifier, new Set(), 'mantine'),
  };
}

/** Shared CLI/editor policy. No migration baseline; unresolved dynamic spreads remain explicit warnings. */
export function scanLayoutOwnership(
  file,
  source,
  { root = process.cwd(), resolver = createLayoutResolver(root) } = {},
) {
  file = normalize(file);
  if (!isProductionSource(file) || /\.type-test\./.test(file) || owner(file)) return [];
  const findings = [];
  const add = (kind, node, summary, severity = 'error') => {
    const loc =
      typeof node === 'number' ? { line: node, column: 1 } : ast.getLineAndCharacterOfPosition(node.getStart(ast));
    findings.push({
      file,
      kind,
      severity,
      line: typeof node === 'number' ? loc.line : loc.line + 1,
      column: typeof node === 'number' ? 1 : loc.character + 1,
      summary,
    });
  };
  let ast;
  if (file.endsWith('.css')) {
    try {
      const css = postcss.parse(source, { from: file });
      css.walkRules((rule) => {
        if (protectedText(rule.selector))
          add(
            'layout-css-ownership',
            rule.source.start.line,
            'Layout state selectors belong to components/core/Layout.',
          );
      });
      css.walkDecls((decl) => {
        if (protectedText(decl.prop) || protectedText(decl.value))
          add(
            'layout-css-ownership',
            decl.source.start.line,
            'Layout private variables belong to components/core/Layout.',
          );
      });
      css.walkAtRules('import', (rule) => {
        if (/components\/core\/Layout\/.*\.css/.test(rule.params))
          add('layout-style-import', rule.source.start.line, 'Do not import owned Layout CSS outside its owner.');
      });
    } catch (error) {
      add('layout-parse-error', error.line || 1, error.reason || error.message);
    }
    return findings;
  }
  ast = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  for (const error of ast.parseDiagnostics)
    add(
      'layout-parse-error',
      ast.getLineAndCharacterOfPosition(error.start ?? 0).line + 1,
      ts.flattenDiagnosticMessageText(error.messageText, '\n'),
    );
  const names = new Set();
  const namespaces = new Map();
  const mantineNamespaces = new Set();
  const scopes = new WeakMap();
  for (const statement of ast.statements) {
    if (ts.isImportDeclaration(statement) && ts.isStringLiteralLike(statement.moduleSpecifier)) {
      const specifier = statement.moduleSpecifier.text;
      const target = resolver.resolveFile(file, specifier);
      if (ownedStyle(specifier) || (target && ownedStyle(target)))
        add('layout-style-import', statement, 'Do not import owned Layout CSS outside its owner.');
      const exports = resolver.exportsFor(file, specifier);
      const mantineExports = resolver.mantineExportsFor(file, specifier);
      const bindings = statement.importClause?.namedBindings;
      if (bindings && ts.isNamedImports(bindings))
        for (const binding of bindings.elements) {
          const imported = binding.propertyName?.text ?? binding.name.text;
          if (exports.has(imported) && !binding.isTypeOnly && !statement.importClause.isTypeOnly)
            names.add(binding.name.text);
          if (
            strictLayoutConsumers.has(file) &&
            mantineExports.has(imported) &&
            !binding.isTypeOnly &&
            !statement.importClause.isTypeOnly
          )
            add('raw-mantine-layout', binding, 'This migrated consumer must compose Core Layout, not Mantine layout.');
        }
      if (bindings && ts.isNamespaceImport(bindings)) {
        if (exports.size) namespaces.set(bindings.name.text, exports);
        if (mantineExports.size) mantineNamespaces.add(bindings.name.text);
      }
    }
  }
  const scopeNode = (node) =>
    ts.isSourceFile(node) || ts.isBlock(node) || ts.isFunctionLike(node) || ts.isModuleBlock(node);
  function enclosingScope(node) {
    for (let current = node.parent; current; current = current.parent) if (scopeNode(current)) return current;
    return ast;
  }
  function bind(node, name, value) {
    const scope = enclosingScope(node);
    if (!scopes.has(scope)) scopes.set(scope, new Map());
    const map = scopes.get(scope);
    // Ambiguous duplicate declarations must not approve an unsafe spread.
    map.set(name, map.has(name) ? null : value);
  }
  const gather = (node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name))
      bind(node, node.name.text, node.parent.flags & ts.NodeFlags.Const ? node.initializer : null);
    if (ts.isFunctionDeclaration(node) && node.name) bind(node, node.name.text, node);
    if (ts.isParameter(node) && ts.isIdentifier(node.name)) bind(node, node.name.text, null);
    ts.forEachChild(node, gather);
  };
  gather(ast);
  function binding(node, name) {
    for (let current = node; current; current = current.parent) {
      if (scopes.get(current)?.has(name)) return scopes.get(current).get(name);
    }
    return null;
  }
  function staticObject(node, seen = new Set()) {
    if (
      ts.isParenthesizedExpression(node) ||
      ts.isAsExpression(node) ||
      ts.isSatisfiesExpression(node) ||
      ts.isNonNullExpression(node)
    )
      return staticObject(node.expression, seen);
    if (ts.isIdentifier(node)) {
      const value = binding(node, node.text);
      if (value && !seen.has(value)) return staticObject(value, new Set(seen).add(value));
    }
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      const fn = binding(node.expression, node.expression.text);
      if (
        !fn ||
        seen.has(fn) ||
        !(ts.isFunctionDeclaration(fn) || ts.isFunctionExpression(fn) || ts.isArrowFunction(fn))
      )
        return null;
      if (fn.parameters.length) return null;
      const body = fn.body;
      if (!body) return null;
      const value =
        ts.isBlock(body) && body.statements.length === 1 && ts.isReturnStatement(body.statements[0])
          ? body.statements[0].expression
          : !ts.isBlock(body)
            ? body
            : null;
      return value ? staticObject(value, new Set(seen).add(fn)) : null;
    }
    if (!ts.isObjectLiteralExpression(node)) return null;
    const props = [];
    for (const item of node.properties) {
      if (ts.isSpreadAssignment(item)) {
        const inner = staticObject(item.expression, seen);
        if (!inner) props.push({ name: null, node: item });
        else props.push(...inner);
      } else if (item.name && (ts.isIdentifier(item.name) || ts.isStringLiteralLike(item.name)))
        props.push({ name: item.name.text, node: item });
      else if (
        item.name &&
        ts.isComputedPropertyName(item.name) &&
        (ts.isStringLiteralLike(item.name.expression) || ts.isNoSubstitutionTemplateLiteral(item.name.expression))
      )
        props.push({ name: item.name.expression.text, node: item });
      else props.push({ name: null, node: item });
    }
    return props;
  }
  function isLayout(tag) {
    return ts.isIdentifier(tag)
      ? names.has(tag.text)
      : ts.isPropertyAccessExpression(tag) &&
          ts.isIdentifier(tag.expression) &&
          namespaces.get(tag.expression.text)?.has(tag.name.text);
  }
  const visit = (node) => {
    if (
      ts.isCallExpression(node) &&
      node.arguments.length &&
      ts.isStringLiteralLike(node.arguments[0]) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) && node.expression.text === 'require'))
    ) {
      const specifier = node.arguments[0].text;
      const target = resolver.resolveFile(file, specifier);
      if (ownedStyle(specifier) || (target && ownedStyle(target)))
        add('layout-style-import', node, 'Do not dynamically import owned Layout CSS outside its owner.');
      if (strictLayoutConsumers.has(file) && resolver.mantineExportsFor(file, specifier).size)
        add(
          'raw-mantine-layout',
          node,
          'Dynamic Mantine imports cannot prove migrated Layout ownership; use named Core Layout imports.',
        );
    }
    if (
      ts.isStringLiteralLike(node) ||
      ts.isNoSubstitutionTemplateLiteral(node) ||
      ts.isTemplateHead(node) ||
      ts.isTemplateMiddle(node) ||
      ts.isTemplateTail(node)
    ) {
      if (protectedText(node.text))
        add('layout-private-access', node, 'Do not access Layout private selectors or variables outside its owner.');
    }
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const layout = isLayout(node.tagName);
      for (const attribute of node.attributes.properties) {
        if (ts.isJsxAttribute(attribute)) {
          const name = attribute.name.getText(ast);
          if (
            name === 'data-geul-layout' ||
            name.startsWith('data-geul-layout-') ||
            (layout && name.startsWith('data-geul-'))
          )
            add('layout-private-access', attribute, 'Layout state attributes belong to Core Layout.');
          if (layout && forbiddenLayoutProps.has(name))
            add(
              'layout-visual-prop',
              attribute,
              `Layout does not accept external visual prop ${name}. Use the public variant contract.`,
            );
        } else if (layout && ts.isJsxSpreadAttribute(attribute)) {
          const props = staticObject(attribute.expression);
          if (!props || props.some((prop) => prop.name === null))
            add(
              'unresolved-layout-spread',
              attribute,
              'Dynamic Layout spread cannot be proven safe by this static gate; the closed prop type and runtime projection must reject visual escape props.',
              'warning',
            );
          if (props)
            for (const prop of props)
              if (prop.name && (forbiddenLayoutProps.has(prop.name) || prop.name.startsWith('data-geul-')))
                add('layout-visual-prop', prop.node, `Layout spread supplies forbidden visual prop ${prop.name}.`);
        }
      }
    }
    if (
      strictLayoutConsumers.has(file) &&
      ts.isVariableDeclaration(node) &&
      node.initializer &&
      ts.isIdentifier(node.initializer) &&
      mantineNamespaces.has(node.initializer.text) &&
      ts.isObjectBindingPattern(node.name)
    ) {
      for (const item of node.name.elements) {
        const name = (item.propertyName ?? item.name).getText(ast);
        if (mantineLayoutExports.has(name))
          add('raw-mantine-layout', item, 'Destructured namespace Mantine layout bypasses the Core owner.');
      }
    }
    if (
      strictLayoutConsumers.has(file) &&
      ts.isElementAccessExpression(node) &&
      ts.isIdentifier(node.expression) &&
      mantineNamespaces.has(node.expression.text) &&
      ts.isStringLiteralLike(node.argumentExpression) &&
      mantineLayoutExports.has(node.argumentExpression.text)
    )
      add('raw-mantine-layout', node, 'Indexed namespace Mantine layout bypasses the Core owner.');
    if (
      strictLayoutConsumers.has(file) &&
      ts.isPropertyAccessExpression(node) &&
      ts.isIdentifier(node.expression) &&
      mantineNamespaces.has(node.expression.text) &&
      mantineLayoutExports.has(node.name.text)
    )
      add('raw-mantine-layout', node, 'This migrated consumer must compose Core Layout, not namespace Mantine layout.');
    ts.forEachChild(node, visit);
  };
  visit(ast);
  return findings;
}

export function collectLayoutSources(root) {
  const files = [];
  function walk(directory) {
    if (!fs.existsSync(directory)) return;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (!/^(?:node_modules|gen|generated|vendor|docs|fixtures|__fixtures__|__tests__)$/.test(entry.name))
          walk(target);
      } else {
        const file = normalize(path.relative(root, target));
        if (isProductionSource(file) && !/\.type-test\./.test(file)) files.push(file);
      }
    }
  }
  for (const sourceRoot of sourceRoots) walk(path.join(root, sourceRoot));
  return files.sort();
}
