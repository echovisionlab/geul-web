import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from '@typescript/tooling';
import prettier from 'prettier';
import postcss from 'postcss';
import { isExportStory, storyNameFromExport, toId } from 'storybook/internal/csf';
import guidance from '../../stories/design-system/components/component-guidance.mjs';

const repository = fileURLToPath(new URL('../../', import.meta.url));
export const registryPath = 'stories/design-system/components/component-docs.generated.json';
const unwrap = (node) => {
  while (node && (ts.isSatisfiesExpression(node) || ts.isAsExpression(node) || ts.isParenthesizedExpression(node)))
    node = node.expression;
  if (node && ts.isExpressionWithTypeArguments(node)) node = node.expression;
  return node;
};
const key = (node) => (node && (ts.isIdentifier(node) || ts.isStringLiteral(node)) ? node.text : null);
const exported = (node) => node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword);
const printType = (node, ast) => (node ? node.getText(ast).replace(/\s+/g, ' ').trim() : 'unknown');
function astFor(file, source) {
  const kind = /\.tsx$/.test(file)
    ? ts.ScriptKind.TSX
    : /\.jsx$/.test(file)
      ? ts.ScriptKind.JSX
      : /\.js$/.test(file)
        ? ts.ScriptKind.JS
        : ts.ScriptKind.TS;
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, kind);
  if (ast.parseDiagnostics.length)
    throw new Error(
      `${file}: ${ast.parseDiagnostics.map((item) => ts.flattenDiagnosticMessageText(item.messageText, ' ')).join('; ')}`,
    );
  return ast;
}

/** Read literal CSF metadata without executing stories, fixtures or React hooks. */
export function parseComponentStory(file, source) {
  const ast = astFor(file, source);
  const bindings = new Map();
  const exports = [];
  let meta;
  for (const statement of ast.statements) {
    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (!ts.isIdentifier(declaration.name)) continue;
        bindings.set(declaration.name.text, declaration.initializer);
        if (exported(statement)) exports.push(declaration.name.text);
      }
    }
    if (ts.isFunctionDeclaration(statement) && statement.name && exported(statement)) exports.push(statement.name.text);
    if (ts.isExportAssignment(statement)) meta = unwrap(statement.expression);
  }
  if (meta && ts.isIdentifier(meta)) meta = unwrap(bindings.get(meta.text));
  if (!meta || !ts.isObjectLiteralExpression(meta)) throw new Error(`${file}: literal story metadata is required`);
  const properties = new Map(
    meta.properties.filter(ts.isPropertyAssignment).map((property) => [key(property.name), property.initializer]),
  );
  const title = properties.get('title');
  if (!title || !ts.isStringLiteral(title)) throw new Error(`${file}: literal story title is required`);
  const filter = (name) => {
    const value = unwrap(properties.get(name));
    if (!value) return undefined;
    if (ts.isArrayLiteralExpression(value)) return value.elements.filter(ts.isStringLiteral).map((item) => item.text);
    if (ts.isRegularExpressionLiteral(value)) {
      const [, pattern, flags] = value.text.match(/^\/(.*)\/([a-z]*)$/) ?? [];
      if (pattern !== undefined) return new RegExp(pattern, flags);
    }
    throw new Error(`${file}: ${name} must be a literal array or regular expression`);
  };
  const component = unwrap(properties.get('component'));
  return {
    file,
    title: title.text,
    component: component && ts.isIdentifier(component) ? component.text : null,
    stateStories: exports
      .filter((name) =>
        isExportStory(name, { includeStories: filter('includeStories'), excludeStories: filter('excludeStories') }),
      )
      .map((name) => {
        const value = unwrap(bindings.get(name));
        const named =
          value && ts.isObjectLiteralExpression(value)
            ? value.properties.find((property) => ts.isPropertyAssignment(property) && key(property.name) === 'name')
                ?.initializer
            : undefined;
        return {
          id: toId(title.text, storyNameFromExport(name)),
          name: named && ts.isStringLiteral(named) ? named.text : storyNameFromExport(name),
        };
      }),
    ast,
  };
}

function filesUnder(root, directories) {
  const files = [];
  function walk(directory) {
    const absolute = path.join(root, directory);
    if (!fs.existsSync(absolute)) return;
    for (const entry of fs
      .readdirSync(absolute, { withFileTypes: true })
      .sort((a, b) => a.name.localeCompare(b.name))) {
      const file = `${directory}/${entry.name}`;
      if (entry.isDirectory()) walk(file);
      else if (/\.[jt]sx?$/.test(file)) files.push(file);
    }
  }
  directories.forEach(walk);
  return files;
}

/** Resolve repository-local imports and barrel exports; external declarations stay external. */
export function createSourceResolver(root) {
  const cache = new Map();
  function source(file) {
    if (!cache.has(file)) cache.set(file, astFor(file, fs.readFileSync(path.join(root, file), 'utf8')));
    return cache.get(file);
  }
  function moduleFile(from, specifier) {
    const base = specifier.startsWith('@/')
      ? specifier.slice(2)
      : specifier.startsWith('.')
        ? path.posix.normalize(path.posix.join(path.posix.dirname(from), specifier))
        : null;
    if (!base) return null;
    for (const candidate of [base, `${base}.tsx`, `${base}.ts`, `${base}/index.tsx`, `${base}/index.ts`]) {
      if (
        /\.[jt]sx?$/.test(candidate) &&
        fs.existsSync(path.join(root, candidate)) &&
        fs.statSync(path.join(root, candidate)).isFile()
      )
        return candidate;
    }
    return null;
  }
  function resolve(file, name, seen = new Set()) {
    const identity = `${file}#${name}`;
    if (seen.has(identity)) return null;
    const next = new Set([...seen, identity]);
    const ast = source(file);
    for (const statement of ast.statements) {
      if (
        (ts.isInterfaceDeclaration(statement) ||
          ts.isTypeAliasDeclaration(statement) ||
          ts.isFunctionDeclaration(statement)) &&
        statement.name?.text === name
      )
        return { file, name, node: statement, ast };
      if (ts.isVariableStatement(statement)) {
        const declaration = statement.declarationList.declarations.find(
          (item) => ts.isIdentifier(item.name) && item.name.text === name,
        );
        if (declaration) return { file, name, node: declaration, ast };
      }
    }
    for (const statement of ast.statements) {
      if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)) {
        const target = moduleFile(file, statement.moduleSpecifier.text);
        const named = statement.importClause?.namedBindings;
        if (named && ts.isNamedImports(named)) {
          const imported = named.elements.find((item) => item.name.text === name);
          if (imported) return target ? resolve(target, (imported.propertyName ?? imported.name).text, next) : null;
        }
      }
      if (
        ts.isExportDeclaration(statement) &&
        statement.moduleSpecifier &&
        ts.isStringLiteral(statement.moduleSpecifier)
      ) {
        const target = moduleFile(file, statement.moduleSpecifier.text);
        if (!target) continue;
        if (statement.exportClause && ts.isNamedExports(statement.exportClause)) {
          const item = statement.exportClause.elements.find((entry) => entry.name.text === name);
          if (item) return resolve(target, (item.propertyName ?? item.name).text, next);
        } else if (!statement.exportClause) {
          const result = resolve(target, name, next);
          if (result) return result;
        }
      }
    }
    return null;
  }
  return { source, resolve, moduleFile };
}

function literalKeys(type) {
  if (type && ts.isLiteralTypeNode(type) && ts.isStringLiteral(type.literal)) return [type.literal.text];
  if (type && ts.isUnionTypeNode(type)) {
    const parts = type.types.map(literalKeys);
    return parts.every(Boolean) ? parts.flat() : null;
  }
  return null;
}
function mergeMaps(maps, union = false) {
  const names = new Set(maps.flatMap((map) => [...map.keys()]));
  return new Map(
    [...names].map((name) => {
      const entries = maps.map((map) => map.get(name));
      const present = entries.filter(Boolean);
      const permitted = union ? present.filter((entry) => entry.type !== 'never') : present;
      const values = permitted.length ? permitted : present;
      const types = [...new Set(values.map((entry) => entry.type))];
      return [
        name,
        {
          name,
          type: types.join(union ? ' | ' : ' & '),
          required: union
            ? entries.every((entry) => entry && entry.required && entry.type !== 'never')
            : present.some((entry) => entry.required),
          description:
            [
              ...new Set([
                ...values.map((entry) => entry.description).filter(Boolean),
                ...(union && (present.length !== maps.length || permitted.length !== present.length)
                  ? [
                      'Allowed combinations vary by union branch. Check the complete action/link, name and geometry contracts.',
                    ]
                  : []),
              ]),
            ].join(' ') || undefined,
        },
      ];
    }),
  );
}

/** Flatten only declared local object contracts; never invent inherited framework props. */
export function extractPublicApi(resolver, file, typeName) {
  const unresolved = new Set();
  const sourceFiles = new Set();
  function scalarType(node, current, seen = new Set()) {
    if (!node) return null;
    const ast = resolver.source(current);
    if (ts.isParenthesizedTypeNode(node)) return scalarType(node.type, current, seen);
    if (
      ts.isLiteralTypeNode(node) ||
      [
        ts.SyntaxKind.StringKeyword,
        ts.SyntaxKind.NumberKeyword,
        ts.SyntaxKind.BooleanKeyword,
        ts.SyntaxKind.NullKeyword,
        ts.SyntaxKind.UndefinedKeyword,
        ts.SyntaxKind.NeverKeyword,
      ].includes(node.kind)
    )
      return printType(node, ast);
    if (ts.isUnionTypeNode(node)) {
      const entries = node.types.map((type) => scalarType(type, current, seen));
      return entries.every((type) => type !== null)
        ? [...new Set(entries.flatMap((type) => type.split(' | ')))].join(' | ')
        : null;
    }
    const target =
      ts.isTypeReferenceNode(node) && !node.typeArguments?.length
        ? resolver.resolve(current, node.typeName.getText(ast))
        : null;
    const identity = target && `${target.file}#${target.name}`;
    if (!target || seen.has(identity) || !ts.isTypeAliasDeclaration(target.node)) return null;
    const value = scalarType(target.node.type, target.file, new Set([...seen, identity]));
    if (value !== null) sourceFiles.add(target.file);
    return value;
  }
  function properties(members, ast, current) {
    const result = new Map();
    for (const member of members) {
      if (!ts.isPropertySignature(member) && !ts.isMethodSignature(member)) continue;
      const name = key(member.name);
      if (!name) continue;
      const docs = member.jsDoc
        ?.map((item) =>
          typeof item.comment === 'string' ? item.comment : item.comment?.map((part) => part.text).join(''),
        )
        .filter(Boolean)
        .join(' ');
      result.set(name, {
        name,
        type: ts.isMethodSignature(member)
          ? member
              .getText(ast)
              .replace(/^.*?\(/, '(')
              .replace(/;$/, '')
          : (scalarType(member.type, current) ?? printType(member.type, ast)),
        required: !member.questionToken,
        ...(docs ? { description: docs } : {}),
      });
    }
    return result;
  }
  function visit(node, current, seen) {
    if (!node) return new Map();
    const ast = resolver.source(current);
    if (ts.isParenthesizedTypeNode(node)) return visit(node.type, current, seen);
    if (ts.isTypeLiteralNode(node)) return properties(node.members, ast, current);
    if (ts.isIntersectionTypeNode(node)) return mergeMaps(node.types.map((item) => visit(item, current, seen)));
    if (ts.isUnionTypeNode(node))
      return mergeMaps(
        node.types.map((item) => visit(item, current, seen)),
        true,
      );
    const referenced = ts.isTypeReferenceNode(node)
      ? node.typeName.getText(ast)
      : ts.isExpressionWithTypeArguments(node)
        ? node.expression.getText(ast)
        : null;
    if (referenced) {
      const arguments_ = node.typeArguments ?? [];
      if (['Omit', 'Pick', 'Partial', 'Required', 'Readonly'].includes(referenced)) {
        const result = visit(arguments_[0], current, seen);
        if (referenced === 'Omit' || referenced === 'Pick') {
          const keys = literalKeys(arguments_[1]);
          if (!keys) {
            unresolved.add(`${current}: ${printType(node, ast)}`);
            return new Map();
          }
          return new Map(
            [...result].filter(([name]) => (referenced === 'Pick' ? keys.includes(name) : !keys.includes(name))),
          );
        }
        if (referenced === 'Partial' || referenced === 'Required')
          return new Map([...result].map(([name, entry]) => [name, { ...entry, required: referenced === 'Required' }]));
        return result;
      }
      const target = resolver.resolve(current, referenced);
      const identity = target && `${target.file}#${target.name}`;
      if (!target || seen.has(identity)) {
        unresolved.add(`${current}: ${printType(node, ast)}`);
        return new Map();
      }
      sourceFiles.add(target.file);
      const next = new Set([...seen, identity]);
      if (ts.isTypeAliasDeclaration(target.node)) return visit(target.node.type, target.file, next);
      if (ts.isInterfaceDeclaration(target.node)) {
        const inherited =
          target.node.heritageClauses?.flatMap((clause) =>
            clause.types.map((type) => visit(type, target.file, next)),
          ) ?? [];
        // Explicit interface members override inherited declarations.
        return new Map([...mergeMaps(inherited), ...properties(target.node.members, target.ast, target.file)]);
      }
      unresolved.add(`${current}: ${printType(node, ast)}`);
      return new Map();
    }
    unresolved.add(`${current}: ${printType(node, ast)}`);
    return new Map();
  }
  const target = resolver.resolve(file, typeName);
  if (!target)
    return {
      api: [],
      sourceFiles: [],
      unresolved: [`${file}: could not statically resolve public contract ${typeName}.`],
    };
  sourceFiles.add(target.file);
  let api;
  if (ts.isInterfaceDeclaration(target.node)) {
    const inherited =
      target.node.heritageClauses?.flatMap((clause) =>
        clause.types.map((type) => visit(type, target.file, new Set([`${target.file}#${typeName}`]))),
      ) ?? [];
    api = new Map([...mergeMaps(inherited), ...properties(target.node.members, target.ast, target.file)]);
  } else if (ts.isTypeAliasDeclaration(target.node))
    api = visit(target.node.type, target.file, new Set([`${target.file}#${typeName}`]));
  else api = new Map();
  return { api: [...api.values()], sourceFiles: [...sourceFiles].sort(), unresolved: [...unresolved].sort() };
}

/** Only defaults from an implementation parameter carrying the exact props contract. */
export function extractImplementationDefaults(file, source, typeName) {
  const ast = astFor(file, source);
  const defaults = new Map();
  function visit(node) {
    if (
      (ts.isFunctionDeclaration(node) || ts.isArrowFunction(node) || ts.isFunctionExpression(node)) &&
      node.parameters.length
    ) {
      const parameter = node.parameters[0];
      const typed = parameter.type?.getText(ast).replace(/\s/g, '') === typeName;
      const parent = node.parent;
      const generic =
        parent && ts.isCallExpression(parent) && parent.typeArguments?.some((item) => item.getText(ast) === typeName);
      if ((typed || generic) && ts.isObjectBindingPattern(parameter.name)) {
        for (const item of parameter.name.elements) {
          const name = key(item.propertyName ?? item.name);
          if (name && item.initializer) defaults.set(name, item.initializer.getText(ast));
        }
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  return defaults;
}

function publicPropsName(resolver, target, component) {
  const conventional = `${component}Props`;
  if (resolver.resolve(target.file, conventional)) return conventional;
  let expression = target.node;
  if (ts.isVariableDeclaration(expression)) expression = unwrap(expression.initializer);
  if (expression && ts.isCallExpression(expression)) {
    const argument = expression.typeArguments?.find((item) => /Props(?:<|$)/.test(item.getText(target.ast)));
    if (argument && ts.isTypeReferenceNode(argument) && ts.isIdentifier(argument.typeName))
      return argument.typeName.text;
  }
  if (expression && ts.isFunctionLike(expression)) {
    const type = expression.parameters[0]?.type;
    if (type && ts.isTypeReferenceNode(type) && ts.isIdentifier(type.typeName)) return type.typeName.text;
  }
  return null;
}

function cssContext(node) {
  const context = [];
  for (let parent = node.parent; parent && parent.type !== 'root'; parent = parent.parent) {
    if (parent.type === 'rule') context.unshift(parent.selector);
    if (parent.type === 'atrule') context.unshift(`@${parent.name} ${parent.params}`.trim());
  }
  return context.join(' → ');
}

/** Read the generated central declarations, preserving aliases and theme/media scope. */
export function readDesignTokenDefinitions(root, file = 'node_modules/@echovisionlab/design-system/src/tokens.css') {
  if (!fs.existsSync(path.join(root, file))) throw new Error(`Missing design token declaration file: ${file}`);
  const definitions = new Map();
  const ast = postcss.parse(fs.readFileSync(path.join(root, file), 'utf8'), { from: file });
  ast.walkDecls((declaration) => {
    if (!/^--geul-[\w-]+$/.test(declaration.prop)) return;
    if (!definitions.has(declaration.prop)) definitions.set(declaration.prop, []);
    definitions.get(declaration.prop).push({
      file,
      line: declaration.source.start.line,
      value: declaration.value,
      context: cssContext(declaration),
    });
  });
  return definitions;
}

/** Scan declared component sources and their direct CSS imports, without following a TS/barrel graph. */
export function collectComponentTokenReferences(root, sourceFiles, definitions = readDesignTokenDefinitions(root)) {
  const references = new Map();
  const styles = new Map();
  const visitedCss = new Set();
  const computed = new Map();
  const omittedImports = new Set();
  const referencePattern = /\bvar\(\s*(--geul-[\w-]+)\s*(?=[,)])/g;
  const marker = '⟦computed⟧';
  const eligible = sourceFiles.filter(
    (file) => file.startsWith('components/core/') && !/\.(?:stories|test|spec|type-test)\./.test(file),
  );
  function addReferences(value, file, line, property) {
    for (const [, name] of value.matchAll(referencePattern)) {
      if (!references.has(name)) references.set(name, new Map());
      const location = { file, line, ...(property ? { property } : {}) };
      references.get(name).set(`${file}:${line}:${property ?? ''}`, location);
    }
  }
  function styleFile(from, specifier, cssImport = false) {
    const base = specifier.startsWith('@/')
      ? specifier.slice(2)
      : specifier.startsWith('.') || (cssImport && !/^(?:[a-z]+:|\/|~)/i.test(specifier))
        ? path.posix.normalize(path.posix.join(path.posix.dirname(from), specifier))
        : null;
    if (!base || base.startsWith('../') || path.isAbsolute(base)) {
      omittedImports.add(`${from}: ${specifier} (only repository-local relative and @/ CSS paths are followed)`);
      return null;
    }
    if (!base.endsWith('.css')) {
      omittedImports.add(`${from}: ${specifier} (CSS file path could not be resolved statically)`);
      return null;
    }
    if (!fs.existsSync(path.join(root, base))) throw new Error(`${from}: missing local CSS import ${specifier}`);
    if (!fs.statSync(path.join(root, base)).isFile())
      throw new Error(`${from}: CSS import is not a file: ${specifier}`);
    return base;
  }
  function readStyle(file, importedBy) {
    if (!styles.has(file)) styles.set(file, new Set());
    styles.get(file).add(importedBy);
    if (visitedCss.has(file)) return;
    visitedCss.add(file);
    const ast = postcss.parse(fs.readFileSync(path.join(root, file), 'utf8'), { from: file });
    ast.walkDecls((declaration) =>
      addReferences(declaration.value, file, declaration.source.start.line, declaration.prop),
    );
    ast.walkAtRules((rule) => {
      addReferences(rule.params, file, rule.source.start.line, `@${rule.name}`);
      if (rule.name.toLowerCase() !== 'import') return;
      const imported = rule.params.match(/^\s*(?:url\(\s*)?(?:['"]([^'"]+)['"]|([^\s)]+))/);
      const specifier = imported?.[1] ?? imported?.[2];
      if (!specifier) {
        omittedImports.add(`${file}:${rule.source.start.line}: @import ${rule.params} (unresolved static CSS path)`);
        return;
      }
      const target = styleFile(file, specifier, true);
      if (target) readStyle(target, file);
    });
  }
  function symbolicString(node) {
    if (ts.isStringLiteralLike(node)) return node.text;
    if (ts.isParenthesizedExpression(node)) return symbolicString(node.expression);
    if (ts.isTemplateExpression(node))
      return node.head.text + node.templateSpans.map((span) => marker + span.literal.text).join('');
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken)
      return symbolicString(node.left) + symbolicString(node.right);
    return marker;
  }
  for (const file of eligible) {
    if (!fs.existsSync(path.join(root, file))) throw new Error(`Missing component token source: ${file}`);
    const ast = astFor(file, fs.readFileSync(path.join(root, file), 'utf8'));
    for (const declaration of ast.statements.filter(ts.isImportDeclaration)) {
      if (
        !ts.isStringLiteral(declaration.moduleSpecifier) ||
        !declaration.moduleSpecifier.text.endsWith('.css') ||
        declaration.importClause?.isTypeOnly
      )
        continue;
      const target = styleFile(file, declaration.moduleSpecifier.text);
      if (target) readStyle(target, file);
    }
    function visit(node) {
      const literal =
        ts.isStringLiteralLike(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node);
      if (literal) {
        const line = ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1;
        const property =
          ts.isPropertyAssignment(node.parent) && node.parent.initializer === node ? key(node.parent.name) : null;
        addReferences(node.text, file, line, property);
      }
      const candidate =
        ts.isTemplateExpression(node) ||
        (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken);
      const parentIsConcatenation =
        node.parent && ts.isBinaryExpression(node.parent) && node.parent.operatorToken.kind === ts.SyntaxKind.PlusToken;
      if (candidate && !parentIsConcatenation && /var\(\s*--geul-[^)]*⟦computed⟧/.test(symbolicString(node))) {
        const line = ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1;
        computed.set(`${file}:${node.getStart(ast)}`, { file, line, expression: node.getText(ast) });
      }
      ts.forEachChild(node, visit);
    }
    visit(ast);
  }
  const tokenReferences = [...references]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, sources]) => ({
      name,
      registered: definitions.has(name),
      sources: [...sources.values()].sort(
        (a, b) => a.file.localeCompare(b.file) || a.line - b.line || (a.property ?? '').localeCompare(b.property ?? ''),
      ),
      definitions: definitions.get(name) ?? [],
    }));
  return {
    tokenReferences,
    styleSources: [...styles]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([file, importedBy]) => ({ file, importedBy: [...importedBy].sort() })),
    computedTokenReferences: [...computed.values()].sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line),
    tokenReferenceLimitations: [
      'Tracks static var(--geul-...) references in Core-owned sourceFiles, excluding stories, and their direct CSS imports/local CSS @imports. It does not traverse nested components, ordinary TS imports or complete barrel style graphs.',
      'registered means a central declaration exists in @echovisionlab/design-system/tokens.css. Definitions preserve aliases and theme/media conditions; they do not establish resolved values, runtime application, active state or override outcomes.',
      'Computed token names are not guessed. computedTokenReferences records unresolved expression locations, not possible token names or evidence of CSS application.',
      ...[...omittedImports].sort().map((item) => `Excluded CSS import: ${item}`),
      ...tokenReferences
        .filter((reference) => !reference.registered)
        .map(
          (reference) =>
            `Missing central declaration: ${reference.name}. The reference location is recorded, but it is not verified as a registered system token.`,
        ),
    ],
  };
}

export function validateComponentCoverage(stories, components, guidance = null) {
  const expected = new Set(stories.filter((story) => story.title?.startsWith('Core/')).map((story) => story.title));
  const actual = new Set();
  const findings = [];
  for (const component of components) {
    if (actual.has(component.title)) findings.push(`Duplicate component documentation: ${component.title}`);
    actual.add(component.title);
    if (!expected.has(component.title)) findings.push(`Stale component documentation: ${component.title}`);
    for (const name of ['summary', 'sourceFiles', 'usage', 'accessibility', 'constraints', 'relatedDocs'])
      if (!component[name]?.length) findings.push(`${component.title}: ${name} is required`);
    const story = stories.find((item) => item.title === component.title);
    if (
      story &&
      JSON.stringify(component.stateStories.map((item) => item.id)) !==
        JSON.stringify(story.stateStories.map((item) => item.id))
    )
      findings.push(`${component.title}: state story IDs do not match current CSF exports`);
    if (new Set(component.api.map((item) => item.name)).size !== component.api.length)
      findings.push(`${component.title}: duplicate public prop names`);
  }
  for (const title of expected) if (!actual.has(title)) findings.push(`Missing component documentation: ${title}`);
  if (guidance) {
    for (const title of Object.keys(guidance))
      if (!expected.has(title)) findings.push(`Stale component guidance: ${title}`);
    for (const title of expected) if (!guidance[title]) findings.push(`Missing component guidance: ${title}`);
  }
  return findings;
}

export function buildComponentRegistry(root = repository) {
  const resolver = createSourceResolver(root);
  const tokenDefinitions = readDesignTokenDefinitions(root);
  const files = filesUnder(root, ['components/core', 'stories']);
  const stories = files
    .filter((file) => /\.stories\.[jt]sx?$/.test(file))
    .map((file) => parseComponentStory(file, fs.readFileSync(path.join(root, file), 'utf8')))
    .filter((story) => story.title.startsWith('Core/'));
  const consumers = filesUnder(root, ['components/core', 'features', 'app']).filter(
    (file) => !/\.(?:stories|test|spec|type-test)\./.test(file),
  );
  // Consumer ASTs are short lived: retaining all application trees makes a docs check needlessly expensive.
  const consumerUsage = new Map();
  for (const file of consumers) {
    const source = fs.readFileSync(path.join(root, file), 'utf8');
    if (!file.startsWith('components/core/') && !source.includes('components/core')) continue;
    const ast = astFor(file, source);
    for (const declaration of ast.statements.filter(ts.isImportDeclaration)) {
      if (!ts.isStringLiteral(declaration.moduleSpecifier)) continue;
      const module = resolver.moduleFile(file, declaration.moduleSpecifier.text);
      const named = declaration.importClause?.namedBindings;
      if (!module?.startsWith('components/core/') || !named || !ts.isNamedImports(named)) continue;
      for (const item of named.elements) {
        if (item.isTypeOnly || declaration.importClause.isTypeOnly) continue;
        const target = resolver.resolve(module, (item.propertyName ?? item.name).text);
        if (!target) continue;
        const identity = `${target.file}#${target.name}`;
        if (!consumerUsage.has(identity)) consumerUsage.set(identity, new Set());
        consumerUsage.get(identity).add(file);
      }
    }
  }
  const components = stories
    .map((story) => {
      const guide = guidance[story.title];
      if (!guide) throw new Error(`Missing component guidance: ${story.title}`);
      const primary = guide.components ?? (story.component ? [story.component] : []);
      const sourceFiles = new Set([story.file]);
      const api = [];
      const constraints = [...guide.constraints];
      const targets = [];
      for (const component of primary) {
        const target = resolver.resolve(story.file, component.split('.')[0]);
        if (!target || !target.file.startsWith('components/core/')) {
          constraints.push(
            `${component}: this group uses a composed fixture. Read the linked Core documentation for each component's public API.`,
          );
          continue;
        }
        targets.push(target);
        sourceFiles.add(target.file);
        const props = guide.propTypes?.[component] ?? publicPropsName(resolver, target, target.name);
        if (!props) {
          constraints.push(`${target.name}: public props extraction is unsupported. Check the implementation source.`);
          continue;
        }
        const contract = extractPublicApi(resolver, target.file, props);
        contract.sourceFiles.forEach((file) => sourceFiles.add(file));
        const defaults = extractImplementationDefaults(
          target.file,
          fs.readFileSync(path.join(root, target.file), 'utf8'),
          props,
        );
        for (const property of contract.api)
          api.push({
            ...property,
            name: primary.length > 1 ? `${component}.${property.name}` : property.name,
            ...(defaults.has(property.name) ? { defaultValue: defaults.get(property.name) } : {}),
          });
        if (contract.unresolved.length)
          constraints.push(
            `External or unresolved inherited types: ${contract.unresolved.join('; ')}. The table does not fully expand these declarations.`,
          );
      }
      const usages = [
        ...new Set(targets.flatMap((target) => [...(consumerUsage.get(`${target.file}#${target.name}`) ?? [])])),
      ]
        .filter((file) => !sourceFiles.has(file))
        .sort()
        .map((file) => `Consumer: ${file}`);
      if (!targets.length)
        constraints.push(
          'This documentation covers a composed review scenario. Fixture props are not published as product Core APIs.',
        );
      return {
        title: story.title,
        sourceFiles: [...sourceFiles].sort(),
        ...collectComponentTokenReferences(root, [...sourceFiles], tokenDefinitions),
        summary: guide.summary,
        anatomy: [guide.anatomy],
        api: api.sort(
          (a, b) =>
            Number(a.type === 'never') - Number(b.type === 'never') ||
            Number(b.required) - Number(a.required) ||
            a.name.localeCompare(b.name),
        ),
        stateStories: story.stateStories,
        usage: [...guide.usage, ...usages],
        accessibility: guide.accessibility,
        constraints: [
          ...constraints,
          'A story or documentation entry does not establish that a state passed review. Record automated checks, keyboard tests and actual assistive-technology verification separately.',
        ],
        relatedDocs: [...new Set(['docs/design-system/component-documentation.md', ...guide.relatedDocs])],
      };
    })
    .sort((a, b) => a.title.localeCompare(b.title));
  const findings = validateComponentCoverage(stories, components, guidance);
  for (const component of components)
    for (const file of [...component.sourceFiles, ...component.relatedDocs])
      if (!fs.existsSync(path.join(root, file))) findings.push(`${component.title}: missing reference ${file}`);
  if (findings.length) throw new Error(findings.join('\n'));
  return { schemaVersion: 1, components };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const registry = buildComponentRegistry();
    const serialized = await prettier.format(JSON.stringify(registry), {
      ...(await prettier.resolveConfig(path.join(repository, '.prettierrc.json'))),
      parser: 'json',
    });
    const destination = path.join(repository, registryPath);
    if (process.argv.includes('--check')) {
      if (!fs.existsSync(destination) || fs.readFileSync(destination, 'utf8') !== serialized)
        throw new Error(`Component docs are stale. Run node scripts/design-system/storybook-component-docs.mjs`);
    } else {
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.writeFileSync(destination, serialized);
    }
    console.log(
      `Storybook component documentation ${process.argv.includes('--check') ? 'checked' : 'generated'}: ${registry.components.length} Core groups.`,
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
