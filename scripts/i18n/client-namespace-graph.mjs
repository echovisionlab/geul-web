// Static analysis of the translation namespaces that client components can request.
//
// The guard test for scoped client message catalogues (lib/i18n/client-message-scopes.test.ts)
// walks the module graph of each route group from its App Router entry files. A module is
// client-reachable when it has a 'use client' directive or is imported (statically or with
// `import()`) by a client-reachable module. Server components never read the client catalogue
// (they use the full request catalogue from i18n/request.ts), so only client-reachable modules
// contribute namespaces. The analysis over-approximates: every import is followed, including
// branches that a route renders only conditionally.

import { existsSync, readFileSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, extname, join, relative, resolve, sep } from 'node:path';

const require = createRequire(import.meta.url);
const ts = require('@typescript/tooling');

const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs'];

/**
 * Translation calls whose namespace argument is not a string literal. Each entry lists every
 * namespace the call can receive; the analysis fails on dynamic calls that are not listed here.
 */
export const DYNAMIC_TRANSLATION_SOURCES = {
  // strategy.translationNamespace: 'privacyEditor' | 'termsEditor' (features/policy/legal-policy-types.ts)
  'features/policy/LegalPolicyEditor.tsx': ['privacyEditor', 'termsEditor'],
  // useMessages() reads the errorPage namespace only.
  'features/application-error/error-page-messages.ts': ['errorPage'],
};

function toPosix(path) {
  return path.split(sep).join('/');
}

function scriptKindFor(path) {
  switch (extname(path)) {
    case '.tsx':
      return ts.ScriptKind.TSX;
    case '.jsx':
      return ts.ScriptKind.JSX;
    case '.js':
    case '.mjs':
      return ts.ScriptKind.JS;
    default:
      return ts.ScriptKind.TS;
  }
}

function isFile(path) {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

function resolveModule(root, fromFile, specifier) {
  let base;
  if (specifier.startsWith('@/')) {
    base = join(root, specifier.slice(2));
  } else if (specifier.startsWith('./') || specifier.startsWith('../')) {
    base = resolve(dirname(fromFile), specifier);
  } else {
    return undefined; // package import: never reads the app catalogue
  }

  if (SOURCE_EXTENSIONS.includes(extname(base)) && isFile(base)) {
    return base;
  }
  for (const extension of SOURCE_EXTENSIONS) {
    if (isFile(`${base}${extension}`)) return `${base}${extension}`;
  }
  for (const extension of SOURCE_EXTENSIONS) {
    const index = join(base, `index${extension}`);
    if (isFile(index)) return index;
  }
  return undefined; // assets (css, json, svg) and missing files
}

function directiveOf(sourceFile) {
  for (const statement of sourceFile.statements) {
    if (!ts.isExpressionStatement(statement) || !ts.isStringLiteral(statement.expression)) {
      break;
    }
    const text = statement.expression.text;
    if (text === 'use client' || text === 'use server') return text;
  }
  return undefined;
}

function isTypeOnlyImport(node) {
  const clause = node.importClause;
  if (!clause) return false;
  if (clause.isTypeOnly) return true;
  if (clause.name) return false;
  const bindings = clause.namedBindings;
  if (!bindings || ts.isNamespaceImport(bindings)) return false;
  return bindings.elements.length > 0 && bindings.elements.every((element) => element.isTypeOnly);
}

/** Static prefix of a key expression: `a.b.${x}` → `a.b`; `a.b.c` → `a.b.c`. */
function staticKeyPrefix(node) {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return { text: node.text, complete: true };
  }
  if (ts.isTemplateExpression(node)) {
    const head = node.head.text;
    const cut = head.lastIndexOf('.');
    return { text: cut === -1 ? '' : head.slice(0, cut), complete: false };
  }
  return undefined;
}

function parseModule(root, path, knownNamespaces) {
  const text = readFileSync(path, 'utf8');
  const sourceFile = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, scriptKindFor(path));
  const imports = [];
  const paths = new Set();
  const dynamicCalls = [];
  let usesRootTranslator = false;
  const keyLiterals = [];

  const visit = (node) => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      if (!isTypeOnlyImport(node)) imports.push(node.moduleSpecifier.text);
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      if (!node.isTypeOnly) imports.push(node.moduleSpecifier.text);
    } else if (ts.isCallExpression(node)) {
      const callee = node.expression;
      const [firstArgument] = node.arguments;
      if (callee.kind === ts.SyntaxKind.ImportKeyword && firstArgument && ts.isStringLiteralLike(firstArgument)) {
        imports.push(firstArgument.text);
      } else if (ts.isIdentifier(callee) && callee.text === 'useTranslations') {
        if (!firstArgument) {
          usesRootTranslator = true;
        } else if (ts.isStringLiteral(firstArgument) || ts.isNoSubstitutionTemplateLiteral(firstArgument)) {
          paths.add(firstArgument.text);
        } else {
          dynamicCalls.push(`useTranslations(${firstArgument.getText(sourceFile)})`);
        }
      } else if (ts.isIdentifier(callee) && callee.text === 'useMessages') {
        dynamicCalls.push('useMessages()');
      }
    }
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateExpression(node)) {
      const prefix = staticKeyPrefix(node);
      if (prefix && prefix.text) keyLiterals.push(prefix.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);

  // useTranslations() without a namespace reads full keys such as t('common.states.unknown').
  // Every string in the module that starts with a known namespace is treated as a key.
  if (usesRootTranslator) {
    for (const literal of keyLiterals) {
      const namespace = literal.split('.')[0];
      if (knownNamespaces.has(namespace) && /^[A-Za-z0-9_.-]+$/.test(literal)) {
        paths.add(literal);
      }
    }
  }

  const relativePath = toPosix(relative(root, path));
  const override = DYNAMIC_TRANSLATION_SOURCES[relativePath];
  const unresolvedDynamicCalls = override ? [] : dynamicCalls;
  for (const namespace of override ?? []) paths.add(namespace);

  return { directive: directiveOf(sourceFile), imports, paths, unresolvedDynamicCalls };
}

/**
 * Walks the module graph from `entries` (repository-relative App Router files) and returns the
 * message paths that client-reachable modules request.
 *
 * @param {{
 *   root: string;
 *   entries: string[];
 *   knownNamespaces: Iterable<string>;
 *   exclude?: (relativePath: string) => boolean;
 *   cache?: Map<string, ReturnType<typeof parseModule>>;
 * }} options
 */
export function collectClientMessagePaths({
  root,
  entries,
  knownNamespaces,
  exclude = () => false,
  cache = new Map(),
}) {
  const namespaces = new Set(knownNamespaces);
  const required = new Map(); // message path -> first client module requesting it
  const unresolvedDynamicCalls = [];
  const clientModules = new Set();
  const visited = new Set();
  const importers = new Map(); // module -> first module that imported it
  const queue = [];

  for (const entry of entries) {
    const absolute = join(root, entry);
    if (!existsSync(absolute)) {
      throw new Error(`Route entry does not exist: ${entry}`);
    }
    queue.push({ path: absolute, client: false });
  }

  while (queue.length > 0) {
    const { path, client: importedFromClient } = queue.shift();
    const relativePath = toPosix(relative(root, path));
    if (exclude(relativePath)) continue;

    let parsed = cache.get(path);
    if (!parsed) {
      parsed = parseModule(root, path, namespaces);
      cache.set(path, parsed);
    }
    if (parsed.directive === 'use server') continue; // server actions run with the request catalogue

    const client = importedFromClient || parsed.directive === 'use client';
    const visitKey = `${client ? 'c' : 's'}:${path}`;
    if (visited.has(visitKey)) continue;
    visited.add(visitKey);

    if (client) {
      clientModules.add(relativePath);
      for (const messagePath of parsed.paths) {
        if (!required.has(messagePath)) required.set(messagePath, relativePath);
      }
      for (const call of parsed.unresolvedDynamicCalls) {
        unresolvedDynamicCalls.push(`${relativePath}: ${call}`);
      }
    }

    for (const specifier of parsed.imports) {
      const resolved = resolveModule(root, path, specifier);
      if (!resolved) continue;
      const resolvedRelative = toPosix(relative(root, resolved));
      if (!importers.has(resolvedRelative)) importers.set(resolvedRelative, relativePath);
      queue.push({ path: resolved, client });
    }
  }

  /** Import chain from an entry to `module`, for diagnostics. */
  const importChain = (module) => {
    const chain = [module];
    while (importers.has(chain[0]) && chain.length < 40 && !chain.includes(importers.get(chain[0]))) {
      chain.unshift(importers.get(chain[0]));
    }
    return chain;
  };

  return { required, unresolvedDynamicCalls, clientModules, importChain };
}

/** True when `selected` (message paths) contains `messagePath` or one of its ancestors. */
export function isMessagePathCovered(messagePath, selected) {
  for (const candidate of selected) {
    if (messagePath === candidate || messagePath.startsWith(`${candidate}.`)) return true;
  }
  return false;
}
