#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { appendFile, lstat, mkdir, mkdtemp, readFile, readdir, realpath, rm, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_VERSION = 1;
const DEFAULT_CHECKPOINT = '.cache/i18n-unused-translation-audit.jsonl';
const PERMANENT_DECLARATION = 'global.d.ts';
const MAX_DIAGNOSTIC_BYTES = 64 * 1024;
const repoRootFromScript = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

class AuditError extends Error {}

function parseArguments(argv) {
  const options = {
    repoRoot: repoRootFromScript,
    tsconfig: 'tsconfig.json',
    messages: 'messages/en.json',
    declaration: PERMANENT_DECLARATION,
    checkpoint: DEFAULT_CHECKPOINT,
    output: undefined,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--help') {
      options.help = true;
      continue;
    }
    if (argument === '--no-checkpoint') {
      options.checkpoint = false;
      continue;
    }
    if (argument === '--delete' || argument === '--remove' || argument === '--write-messages') {
      throw new AuditError('This audit never deletes or rewrites translation messages.');
    }

    const optionNames = new Map([
      ['--repo-root', 'repoRoot'],
      ['--tsconfig', 'tsconfig'],
      ['--messages', 'messages'],
      ['--declaration', 'declaration'],
      ['--checkpoint', 'checkpoint'],
      ['--output', 'output'],
    ]);
    const optionName = optionNames.get(argument);
    if (!optionName) {
      throw new AuditError(`Unknown argument: ${argument}`);
    }
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) {
      throw new AuditError(`${argument} requires a path.`);
    }
    options[optionName] = value;
    index += 1;
  }

  return options;
}

function usage() {
  return `Usage: node scripts/i18n/audit-unused-translation-keys.mjs [options]

Uses the repository TypeScript compiler as the only usage oracle. It first
requires a clean baseline compile, then removes message keys from a temporary
English message schema and recompiles sequentially. It never edits messages.

Options:
  --checkpoint <path>  Resumable JSONL cache (default: ${DEFAULT_CHECKPOINT})
  --no-checkpoint      Keep results in memory only
  --output <path>      Also create a JSON file containing the verified-unused keys
  --tsconfig <path>    Project config (default: tsconfig.json)
  --messages <path>    English messages (default: messages/en.json)
  --declaration <path> Permanent next-intl augmentation to exclude (default: ${PERMANENT_DECLARATION})
  --repo-root <path>   Repository root (normally inferred from this script)
  --help               Show this help

Stdout is one JSON array containing verified-unused dotted keys. Progress and
diagnostics go to stderr. --output refuses to overwrite an existing file.

Safety:
  The audit refuses to classify keys when its checker preflight finds widened,
  dynamic, asserted, or otherwise unproven translator/catalog flows. A failed
  candidate is conservatively omitted regardless of diagnostic cause. The
  checkpoint trusts pnpm's lock/install metadata for dependency contents.`;
}

function resolveFrom(root, path) {
  return isAbsolute(path) ? resolve(path) : resolve(root, path);
}

function assertInside(root, target, label) {
  const pathFromRoot = relative(root, target);
  if (
    pathFromRoot === '' ||
    (!pathFromRoot.startsWith(`..${sep}`) && pathFromRoot !== '..' && !isAbsolute(pathFromRoot))
  ) {
    return;
  }
  throw new AuditError(`${label} must be inside the repository: ${target}`);
}

async function canonicalizePotentialPath(path) {
  const missingSegments = [];
  let existingAncestor = resolve(path);
  while (true) {
    try {
      const metadata = await lstat(existingAncestor);
      let canonicalAncestor;
      try {
        canonicalAncestor = await realpath(existingAncestor);
      } catch (error) {
        if (metadata.isSymbolicLink() && (error.code === 'ENOENT' || error.code === 'ENOTDIR')) {
          throw new AuditError(`Path contains a dangling symlink: ${existingAncestor}`);
        }
        throw error;
      }
      return resolve(canonicalAncestor, ...missingSegments);
    } catch (error) {
      if (error instanceof AuditError) throw error;
      if (error.code !== 'ENOENT' && error.code !== 'ENOTDIR') throw error;
      const parent = dirname(existingAncestor);
      if (parent === existingAncestor) throw error;
      missingSegments.unshift(basename(existingAncestor));
      existingAncestor = parent;
    }
  }
}

async function canonicalPathInside(root, target, label) {
  const canonicalTarget = await canonicalizePotentialPath(target);
  assertInside(root, canonicalTarget, label);
  return canonicalTarget;
}

function stableJson(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function collectMessageKeys(messages) {
  const keys = [];

  function visit(value, segments) {
    if (typeof value === 'string') {
      if (segments.length === 0) {
        throw new AuditError('The English message catalog must be an object.');
      }
      keys.push(segments.join('.'));
      return;
    }
    if (!value || Array.isArray(value) || typeof value !== 'object') {
      throw new AuditError(
        `Unsupported message value at ${segments.join('.') || '<root>'}; expected an object or string.`,
      );
    }

    for (const [key, child] of Object.entries(value)) {
      if (key.includes('.')) {
        throw new AuditError(`Message key segments containing dots are unsupported: ${[...segments, key].join('.')}`);
      }
      visit(child, [...segments, key]);
    }
  }

  visit(messages, []);
  return keys.sort((left, right) => left.localeCompare(right));
}

function removeMessageKeys(messages, dottedKeys) {
  const candidate = structuredClone(messages);
  for (const dottedKey of dottedKeys) {
    const segments = dottedKey.split('.');
    let parent = candidate;
    for (const segment of segments.slice(0, -1)) {
      parent = parent?.[segment];
    }
    const leaf = segments.at(-1);
    if (!parent || !leaf || !Object.hasOwn(parent, leaf)) {
      throw new AuditError(`Cannot remove missing candidate key: ${dottedKey}`);
    }
    delete parent[leaf];
  }
  return candidate;
}

function initialGroups(keys) {
  const byNamespace = new Map();
  for (const key of keys) {
    const namespace = key.split('.', 1)[0];
    const group = byNamespace.get(namespace) ?? [];
    group.push(key);
    byNamespace.set(namespace, group);
  }
  return [...byNamespace.values()];
}

function splitGroup(group) {
  const midpoint = Math.floor(group.length / 2);
  return [group.slice(0, midpoint), group.slice(midpoint)];
}

function candidateId(candidatePaths) {
  return createHash('sha256').update(candidatePaths.join('\0')).digest('hex');
}

function appendCapped(chunks, chunk, byteCount) {
  if (byteCount >= MAX_DIAGNOSTIC_BYTES) return byteCount;
  const remaining = MAX_DIAGNOSTIC_BYTES - byteCount;
  const kept = chunk.subarray(0, remaining);
  chunks.push(kept);
  return byteCount + kept.byteLength;
}

export function executeCompilerProcess({ command, args, cwd, env = process.env, onChild }) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] });
    onChild?.(child);
    const stdout = [];
    const stderr = [];
    let stdoutBytes = 0;
    let stderrBytes = 0;

    child.stdout.on('data', (chunk) => {
      stdoutBytes = appendCapped(stdout, chunk, stdoutBytes);
    });
    child.stderr.on('data', (chunk) => {
      stderrBytes = appendCapped(stderr, chunk, stderrBytes);
    });
    child.once('error', rejectPromise);
    child.once('close', (code, signal) => {
      resolvePromise({
        code,
        signal,
        stdout: Buffer.concat(stdout).toString('utf8'),
        stderr: Buffer.concat(stderr).toString('utf8'),
      });
    });
  });
}

async function terminateCompilerProcess(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  await new Promise((resolvePromise) => {
    let forceTimer;
    const onClose = () => {
      clearTimeout(forceTimer);
      resolvePromise();
    };
    child.once('close', onClose);
    child.kill('SIGTERM');
    forceTimer = setTimeout(() => child.kill('SIGKILL'), 2_000);
  });
}

function resolveRepositoryPackage(root, packageName) {
  const requireFromRepo = createRequire(join(root, 'package.json'));
  try {
    const packageJsonPath = requireFromRepo.resolve(`${packageName}/package.json`);
    return {
      requireFromRepo,
      packageJsonPath,
    };
  } catch (error) {
    const fallbackRequire = createRequire(import.meta.url);
    return {
      requireFromRepo: fallbackRequire,
      packageJsonPath: fallbackRequire.resolve('typescript/package.json'),
    };
  }
}

async function loadProject(root, tsconfigPath) {
  let typescript;
  let typescriptPackagePath;
  let compilerVersion;
  try {
    const apiPackage = resolveRepositoryPackage(root, '@typescript/tooling');
    const compilerPackage = resolveRepositoryPackage(root, 'typescript');
    typescript = apiPackage.requireFromRepo('@typescript/tooling');
    typescriptPackagePath = compilerPackage.packageJsonPath;
    compilerVersion = JSON.parse(await readFile(typescriptPackagePath, 'utf8')).version;
  } catch (error) {
    throw new AuditError(`Cannot load the repository TypeScript package: ${error.message}`);
  }

  const configRead = typescript.readConfigFile(tsconfigPath, typescript.sys.readFile);
  if (configRead.error) {
    throw new AuditError(typescript.flattenDiagnosticMessageText(configRead.error.messageText, '\n'));
  }
  const parsed = typescript.parseJsonConfigFileContent(configRead.config, typescript.sys, dirname(tsconfigPath));
  if (parsed.errors.length > 0) {
    const diagnostics = parsed.errors
      .map((diagnostic) => typescript.flattenDiagnosticMessageText(diagnostic.messageText, '\n'))
      .join('\n');
    throw new AuditError(`Cannot parse ${tsconfigPath}:\n${diagnostics}`);
  }

  return {
    typescript,
    compilerPath: join(dirname(typescriptPackagePath), 'bin', 'tsc'),
    compilerVersion: `${compilerVersion} (checker API ${typescript.version})`,
    compilerOptions: parsed.options,
    pathMappings: Object.fromEntries(
      Object.entries(parsed.options.paths ?? {}).map(([pattern, targets]) => [
        pattern,
        targets.map((target) =>
          isAbsolute(target) ? target : resolve(parsed.options.pathsBasePath ?? dirname(tsconfigPath), target),
        ),
      ]),
    ),
    projectReferences: parsed.projectReferences ?? [],
    rootFileNames: parsed.fileNames.map((fileName) => resolve(fileName)),
  };
}

function nodeLocation(typescript, sourceFile, node, root) {
  const start = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
  return `${relative(root, sourceFile.fileName)}:${start.line + 1}:${start.character + 1}`;
}

function unwrapExpression(typescript, expression) {
  let current = expression;
  while (
    typescript.isParenthesizedExpression(current) ||
    typescript.isNonNullExpression(current) ||
    typescript.isSatisfiesExpression(current)
  ) {
    current = current.expression;
  }
  return current;
}

function finiteStringType(typescript, checker, inputType, seen = new Set()) {
  if (!inputType || seen.has(inputType)) return false;
  seen.add(inputType);
  if (inputType.flags & typescript.TypeFlags.StringLiteral) return true;
  if (inputType.isUnion?.()) {
    return (
      inputType.types.length > 0 && inputType.types.every((type) => finiteStringType(typescript, checker, type, seen))
    );
  }
  if (inputType.flags & typescript.TypeFlags.TypeParameter) {
    return finiteStringType(typescript, checker, checker.getBaseConstraintOfType(inputType), seen);
  }
  if (inputType.flags & typescript.TypeFlags.EnumLiteral) {
    return typeof inputType.value === 'string';
  }
  return false;
}

function callableHasFiniteKeyDomain(typescript, checker, type, location) {
  if (!type || type.flags & (typescript.TypeFlags.Any | typescript.TypeFlags.Unknown)) return false;
  const signatures = checker.getSignaturesOfType(type, typescript.SignatureKind.Call);
  if (signatures.length === 0) return false;
  return signatures.every((signature) => {
    const parameter = signature.parameters[0];
    if (!parameter) return false;
    const parameterType = checker.getTypeOfSymbolAtLocation(parameter, location);
    return finiteStringType(typescript, checker, parameterType);
  });
}

function nonNullableType(typescript, checker, type) {
  if (!type) return undefined;
  const forbidden = typescript.TypeFlags.Any | typescript.TypeFlags.Unknown;
  if (type.flags & forbidden) return undefined;
  return checker.getNonNullableType(type);
}

function preservesExactObjectShape(typescript, checker, sourceType, targetType) {
  const source = nonNullableType(typescript, checker, sourceType);
  const target = nonNullableType(typescript, checker, targetType);
  if (!source || !target) return false;
  if (!(source.flags & typescript.TypeFlags.Object) || !(target.flags & typescript.TypeFlags.Object)) {
    return false;
  }
  return checker.isTypeAssignableTo(source, target) && checker.isTypeAssignableTo(target, source);
}

function translatorSignature(typescript, checker, type) {
  if (!type) return false;
  const signatures = checker.getSignaturesOfType(type, typescript.SignatureKind.Call);
  return signatures.some((signature) => {
    const fileName = signature.declaration?.getSourceFile().fileName.replaceAll('\\', '/');
    if (fileName?.includes('/use-intl/') && fileName.endsWith('/createTranslator.d.ts')) return true;
    const declaration = signature.declaration;
    if (!declaration) return false;
    let current = declaration.parent;
    while (current && !typescript.isModuleDeclaration(current)) current = current.parent;
    return current?.name && typescript.isStringLiteral(current.name) && current.name.text === 'next-intl';
  });
}

function parameterForArgument(signature, argumentIndex) {
  if (!signature || signature.parameters.length === 0) return undefined;
  if (argumentIndex < signature.parameters.length) return signature.parameters[argumentIndex];
  const last = signature.parameters.at(-1);
  return last?.valueDeclaration?.dotDotDotToken ? last : undefined;
}

function containsTypeAssertion(typescript, node) {
  let found = false;
  function visit(child) {
    if (typescript.isAsExpression(child) || typescript.isTypeAssertionExpression(child)) {
      found = true;
      return;
    }
    typescript.forEachChild(child, visit);
  }
  visit(node);
  return found;
}

function bindingSymbols(typescript, checker, name, output = []) {
  if (typescript.isIdentifier(name)) {
    const symbol = checker.getSymbolAtLocation(name);
    if (symbol) output.push(symbol);
    return output;
  }
  for (const element of name.elements) {
    if (typescript.isBindingElement(element)) bindingSymbols(typescript, checker, element.name, output);
  }
  return output;
}

function importFactoriesForSource(typescript, checker, sourceFile) {
  const factories = new Map();
  const namespaces = new Set();
  const providers = new Set();
  for (const statement of sourceFile.statements) {
    if (!typescript.isImportDeclaration(statement) || !typescript.isStringLiteral(statement.moduleSpecifier)) continue;
    if (!['next-intl', 'next-intl/server'].includes(statement.moduleSpecifier.text)) continue;
    const bindings = statement.importClause?.namedBindings;
    if (bindings && typescript.isNamedImports(bindings)) {
      for (const element of bindings.elements) {
        const importedName = element.propertyName?.text ?? element.name.text;
        const symbol = checker.getSymbolAtLocation(element.name);
        if (importedName === 'NextIntlClientProvider') {
          if (symbol) providers.add(symbol);
        } else if (['useTranslations', 'getTranslations'].includes(importedName)) {
          if (symbol) factories.set(symbol, importedName);
        }
      }
    } else if (bindings && typescript.isNamespaceImport(bindings)) {
      const symbol = checker.getSymbolAtLocation(bindings.name);
      if (symbol) namespaces.add(symbol);
    }
  }
  return { factories, namespaces, providers };
}

function factoryNameAtCall(typescript, checker, call, imports) {
  if (!imports) return undefined;
  const callee = unwrapExpression(typescript, call.expression);
  if (typescript.isIdentifier(callee)) {
    return imports.factories.get(checker.getSymbolAtLocation(callee));
  }
  if (
    typescript.isPropertyAccessExpression(callee) &&
    ['useTranslations', 'getTranslations'].includes(callee.name.text)
  ) {
    const namespaceSymbol = typescript.isIdentifier(callee.expression)
      ? checker.getSymbolAtLocation(callee.expression)
      : undefined;
    if (namespaceSymbol && imports.namespaces.has(namespaceSymbol)) return callee.name.text;
  }
  return undefined;
}

function moduleSpecifiers(typescript, sourceFile) {
  const specifiers = [];
  function visit(node) {
    if (
      (typescript.isImportDeclaration(node) || typescript.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      typescript.isStringLiteral(node.moduleSpecifier)
    ) {
      specifiers.push(node.moduleSpecifier);
    } else if (
      typescript.isCallExpression(node) &&
      node.arguments.length === 1 &&
      typescript.isStringLiteral(node.arguments[0]) &&
      (node.expression.kind === typescript.SyntaxKind.ImportKeyword ||
        (typescript.isIdentifier(node.expression) && node.expression.text === 'require'))
    ) {
      specifiers.push(node.arguments[0]);
    }
    typescript.forEachChild(node, visit);
  }
  visit(sourceFile);
  return specifiers;
}

function runTranslationSafetyPreflight({ project, root, messagesPath }) {
  const { typescript } = project;
  if (!typescript) throw new AuditError('TypeScript checker is unavailable for the translation safety preflight.');
  const program = typescript.createProgram({
    rootNames: project.rootFileNames,
    options: project.compilerOptions,
    projectReferences: project.projectReferences,
  });
  const checker = program.getTypeChecker();
  const projectSourceFiles = program
    .getSourceFiles()
    .filter((sourceFile) => !sourceFile.fileName.includes(`${sep}node_modules${sep}`));
  const sourceFiles = projectSourceFiles.filter((sourceFile) => !sourceFile.isDeclarationFile);
  const importMaps = new Map(
    sourceFiles.map((sourceFile) => [sourceFile, importFactoriesForSource(typescript, checker, sourceFile)]),
  );
  const normalizedMessagesPath = typescript.sys.realpath?.(messagesPath) ?? messagesPath;
  const issues = [];
  const issueKeys = new Set();
  const catalogSymbols = new Set();
  const catalogContainerSymbols = new Set();
  const catalogRootTypes = [];
  const addIssue = (sourceFile, node, message) => {
    const location = nodeLocation(typescript, sourceFile, node, root);
    const issue = `${location} ${message}`;
    if (!issueKeys.has(issue)) {
      issueKeys.add(issue);
      issues.push(issue);
    }
  };

  for (const sourceFile of projectSourceFiles) {
    for (const specifier of moduleSpecifiers(typescript, sourceFile)) {
      const resolution = typescript.resolveModuleName(
        specifier.text,
        sourceFile.fileName,
        project.compilerOptions,
        typescript.sys,
      ).resolvedModule;
      if (!resolution) continue;
      const resolved = typescript.sys.realpath?.(resolution.resolvedFileName) ?? resolution.resolvedFileName;
      if (resolved === normalizedMessagesPath && specifier.text !== '@/messages/en.json') {
        addIssue(
          sourceFile,
          specifier,
          `imports the English catalog through ${JSON.stringify(
            specifier.text,
          )}; only the exact @/messages/en.json alias can be redirected safely.`,
        );
      } else if (resolved === normalizedMessagesPath) {
        const declaration = specifier.parent;
        if (!typescript.isImportDeclaration(declaration)) {
          addIssue(sourceFile, specifier, 'loads the English catalog dynamically; its value flow cannot be proven.');
          continue;
        }
        const importClause = declaration.importClause;
        const localNames = [];
        if (importClause?.name) localNames.push(importClause.name);
        if (importClause?.namedBindings && typescript.isNamespaceImport(importClause.namedBindings)) {
          localNames.push(importClause.namedBindings.name);
        } else if (importClause?.namedBindings && typescript.isNamedImports(importClause.namedBindings)) {
          for (const element of importClause.namedBindings.elements) localNames.push(element.name);
        }
        for (const localName of localNames) {
          const symbol = checker.getSymbolAtLocation(localName);
          if (!symbol) continue;
          catalogSymbols.add(symbol);
          const type = checker.getTypeOfSymbolAtLocation(symbol, localName);
          if (type.flags & typescript.TypeFlags.Object) catalogRootTypes.push(type);
        }
      }
    }
  }

  const taintedSymbols = new Set();
  const translatorDerived = (expression) => {
    const unwrapped = unwrapExpression(typescript, expression);
    if (typescript.isAwaitExpression(unwrapped)) {
      const awaited = unwrapExpression(typescript, unwrapped.expression);
      if (typescript.isCallExpression(awaited)) {
        const factory = factoryNameAtCall(typescript, checker, awaited, importMaps.get(awaited.getSourceFile()));
        if (factory === 'getTranslations') return true;
      }
      return translatorDerived(unwrapped.expression);
    }
    if (typescript.isCallExpression(unwrapped)) {
      const factory = factoryNameAtCall(typescript, checker, unwrapped, importMaps.get(unwrapped.getSourceFile()));
      if (factory === 'useTranslations') return true;
    }
    const symbol =
      typescript.isIdentifier(unwrapped) || typescript.isPropertyAccessExpression(unwrapped)
        ? checker.getSymbolAtLocation(unwrapped)
        : undefined;
    if (symbol && taintedSymbols.has(symbol)) return true;
    return translatorSignature(typescript, checker, checker.getTypeAtLocation(unwrapped));
  };
  const catalogDerived = (expression) => {
    const unwrapped = unwrapExpression(typescript, expression);
    if (typescript.isAwaitExpression(unwrapped)) return catalogDerived(unwrapped.expression);
    const isCatalogExpression =
      typescript.isIdentifier(unwrapped) ||
      typescript.isPropertyAccessExpression(unwrapped) ||
      typescript.isElementAccessExpression(unwrapped) ||
      typescript.isCallExpression(unwrapped) ||
      typescript.isObjectLiteralExpression(unwrapped) ||
      typescript.isArrayLiteralExpression(unwrapped);
    if (!isCatalogExpression) return false;
    const type = checker.getTypeAtLocation(unwrapped);
    const objectType = Boolean(type.flags & typescript.TypeFlags.Object);
    const symbol =
      typescript.isIdentifier(unwrapped) || typescript.isPropertyAccessExpression(unwrapped)
        ? checker.getSymbolAtLocation(unwrapped)
        : undefined;
    if (symbol && catalogSymbols.has(symbol)) return objectType;
    if (
      (typescript.isPropertyAccessExpression(unwrapped) || typescript.isElementAccessExpression(unwrapped)) &&
      (catalogDerived(unwrapped.expression) ||
        (() => {
          const containerSymbol = checker.getSymbolAtLocation(unwrapped.expression);
          return containerSymbol && catalogContainerSymbols.has(containerSymbol);
        })())
    ) {
      return objectType;
    }
    if (typescript.isCallExpression(unwrapped)) {
      const promised = checker.getPromisedTypeOfPromise(type);
      const resultType = promised ?? type;
      return catalogRootTypes.some((rootType) => preservesExactObjectShape(typescript, checker, rootType, resultType));
    }
    return false;
  };
  const catalogCarrier = (expression) => {
    if (catalogDerived(expression)) return true;
    const unwrapped = unwrapExpression(typescript, expression);
    const symbol =
      typescript.isIdentifier(unwrapped) || typescript.isPropertyAccessExpression(unwrapped)
        ? checker.getSymbolAtLocation(unwrapped)
        : undefined;
    return Boolean(symbol && catalogContainerSymbols.has(symbol));
  };
  const containsCatalogCarrier = (node) => {
    let contains = false;
    function visit(child) {
      if (contains) return;
      if (child !== node && catalogCarrier(child)) {
        contains = true;
        return;
      }
      typescript.forEachChild(child, visit);
    }
    visit(node);
    return contains;
  };
  const catalogFlow = (expression) => {
    if (catalogCarrier(expression)) return true;
    const unwrapped = unwrapExpression(typescript, expression);
    return (
      (typescript.isObjectLiteralExpression(unwrapped) || typescript.isArrayLiteralExpression(unwrapped)) &&
      containsCatalogCarrier(unwrapped)
    );
  };

  let changed = true;
  while (changed) {
    changed = false;
    for (const sourceFile of sourceFiles) {
      function propagate(node) {
        if (
          typescript.isVariableDeclaration(node) ||
          typescript.isParameter(node) ||
          typescript.isBindingElement(node)
        ) {
          const symbols = bindingSymbols(typescript, checker, node.name);
          const declaredTranslator = symbols.some((symbol) =>
            translatorSignature(typescript, checker, checker.getTypeOfSymbolAtLocation(symbol, node)),
          );
          if (declaredTranslator || (node.initializer && translatorDerived(node.initializer))) {
            for (const symbol of symbols) {
              if (!taintedSymbols.has(symbol)) {
                taintedSymbols.add(symbol);
                changed = true;
              }
            }
          }
          if (node.initializer && catalogDerived(node.initializer)) {
            for (const symbol of symbols) {
              if (!catalogSymbols.has(symbol)) {
                catalogSymbols.add(symbol);
                changed = true;
              }
            }
          } else if (node.initializer && containsCatalogCarrier(node.initializer)) {
            for (const symbol of symbols) {
              if (!catalogContainerSymbols.has(symbol)) {
                catalogContainerSymbols.add(symbol);
                changed = true;
              }
            }
          }
        } else if (typescript.isPropertyAssignment(node)) {
          const symbol = checker.getSymbolAtLocation(node.name);
          if (translatorDerived(node.initializer) && symbol && !taintedSymbols.has(symbol)) {
            taintedSymbols.add(symbol);
            changed = true;
          }
          if (catalogDerived(node.initializer) && symbol && !catalogSymbols.has(symbol)) {
            catalogSymbols.add(symbol);
            changed = true;
          }
        } else if (typescript.isShorthandPropertyAssignment(node)) {
          const valueSymbol = checker.getShorthandAssignmentValueSymbol(node);
          const propertySymbol = checker.getSymbolAtLocation(node.name);
          if (valueSymbol && catalogSymbols.has(valueSymbol) && propertySymbol && !catalogSymbols.has(propertySymbol)) {
            catalogSymbols.add(propertySymbol);
            changed = true;
          }
        } else if (
          typescript.isBinaryExpression(node) &&
          node.operatorToken.kind === typescript.SyntaxKind.EqualsToken
        ) {
          const symbol = checker.getSymbolAtLocation(node.left);
          if (translatorDerived(node.right) && symbol && !taintedSymbols.has(symbol)) {
            taintedSymbols.add(symbol);
            changed = true;
          }
          if (catalogDerived(node.right)) {
            if (symbol && !catalogSymbols.has(symbol)) {
              catalogSymbols.add(symbol);
              changed = true;
            }
          } else if (catalogCarrier(node.right) && symbol && !catalogContainerSymbols.has(symbol)) {
            catalogContainerSymbols.add(symbol);
            changed = true;
          }
        } else if (typescript.isCallExpression(node)) {
          const signature = checker.getResolvedSignature(node);
          node.arguments.forEach((argument, index) => {
            if (!translatorDerived(argument)) return;
            const parameter = parameterForArgument(signature, index);
            const declaration = parameter?.valueDeclaration;
            if (declaration && typescript.isParameter(declaration)) {
              const symbol = checker.getSymbolAtLocation(declaration.name);
              if (symbol && !taintedSymbols.has(symbol)) {
                taintedSymbols.add(symbol);
                changed = true;
              }
            }
          });
          node.arguments.forEach((argument, index) => {
            if (!catalogFlow(argument)) return;
            const parameter = parameterForArgument(signature, index);
            const declaration = parameter?.valueDeclaration;
            if (declaration && typescript.isParameter(declaration)) {
              const symbol = checker.getSymbolAtLocation(declaration.name);
              const targetSet = catalogDerived(argument) ? catalogSymbols : catalogContainerSymbols;
              if (symbol && !targetSet.has(symbol)) {
                targetSet.add(symbol);
                changed = true;
              }
            }
          });
        }
        typescript.forEachChild(node, propagate);
      }
      propagate(sourceFile);
    }
  }

  for (const sourceFile of sourceFiles) {
    const imports = importMaps.get(sourceFile);
    const translatorInvocation = (call) => {
      const callee = unwrapExpression(typescript, call.expression);
      if (translatorDerived(callee)) return true;
      return (
        typescript.isPropertyAccessExpression(callee) &&
        ['rich', 'markup', 'raw', 'has'].includes(callee.name.text) &&
        translatorDerived(callee.expression)
      );
    };
    const catalogTargetPreservesShape = (expression, targetType) => {
      const sourceType = checker.getTypeAtLocation(expression);
      const promisedTarget = targetType ? checker.getPromisedTypeOfPromise(targetType) : undefined;
      return preservesExactObjectShape(typescript, checker, sourceType, promisedTarget ?? targetType);
    };
    const trustedNextIntlMessagesAttribute = (expression) => {
      if (!expression.parent) return false;
      const jsxExpression = expression.parent;
      if (!typescript.isJsxExpression(jsxExpression)) return false;
      const attribute = jsxExpression.parent;
      if (!typescript.isJsxAttribute(attribute) || attribute.name.text !== 'messages') return false;
      const attributes = attribute.parent;
      const opening = attributes.parent;
      if (!typescript.isJsxOpeningElement(opening) && !typescript.isJsxSelfClosingElement(opening)) {
        return false;
      }
      return (
        typescript.isIdentifier(opening.tagName) && imports.providers.has(checker.getSymbolAtLocation(opening.tagName))
      );
    };
    function inspect(node) {
      if (typescript.isIdentifier(node) && imports.factories.has(checker.getSymbolAtLocation(node))) {
        const isImportBinding = typescript.isImportSpecifier(node.parent);
        const isDirectCall = typescript.isCallExpression(node.parent) && node.parent.expression === node;
        const isTypeReference = typescript.isTypeQueryNode(node.parent);
        if (!isImportBinding && !isDirectCall && !isTypeReference) {
          addIssue(
            sourceFile,
            node,
            'aliases or passes a next-intl translation factory; its namespace flow cannot be proven.',
          );
        }
      } else if (typescript.isIdentifier(node) && imports.namespaces.has(checker.getSymbolAtLocation(node))) {
        const isImportBinding = typescript.isNamespaceImport(node.parent);
        const isSupportedFactoryAccess =
          typescript.isPropertyAccessExpression(node.parent) &&
          node.parent.expression === node &&
          ['useTranslations', 'getTranslations'].includes(node.parent.name.text);
        if (!isImportBinding && !isSupportedFactoryAccess) {
          addIssue(sourceFile, node, 'uses a next-intl namespace import outside a direct translation factory call.');
        }
      } else if (typescript.isCallExpression(node)) {
        const factory = factoryNameAtCall(typescript, checker, node, imports);
        if (factory) {
          const firstArgument = node.arguments[0];
          let namespace = firstArgument;
          if (firstArgument && typescript.isObjectLiteralExpression(firstArgument)) {
            const namespaceProperty = firstArgument.properties.find(
              (property) =>
                typescript.isPropertyAssignment(property) &&
                ((typescript.isIdentifier(property.name) && property.name.text === 'namespace') ||
                  (typescript.isStringLiteral(property.name) && property.name.text === 'namespace')),
            );
            namespace = namespaceProperty?.initializer;
            if (!namespace) {
              addIssue(sourceFile, firstArgument, `${factory} uses an options object without an explicit namespace.`);
            }
          }
          if (
            namespace &&
            (containsTypeAssertion(typescript, namespace) ||
              !finiteStringType(typescript, checker, checker.getTypeAtLocation(namespace)))
          ) {
            addIssue(
              sourceFile,
              namespace,
              `${factory} uses a namespace that is not a literal or finite string union.`,
            );
          }
        }

        if (translatorInvocation(node)) {
          const key = node.arguments[0];
          if (
            !key ||
            containsTypeAssertion(typescript, key) ||
            !finiteStringType(typescript, checker, checker.getTypeAtLocation(key))
          ) {
            addIssue(sourceFile, key ?? node, 'calls a next-intl translator with a broad, dynamic, or asserted key.');
          }
        }

        const signature = checker.getResolvedSignature(node);
        node.arguments.forEach((argument, index) => {
          if (!translatorDerived(argument)) return;
          const parameter = parameterForArgument(signature, index);
          const parameterType = parameter ? checker.getTypeOfSymbolAtLocation(parameter, node) : undefined;
          if (!callableHasFiniteKeyDomain(typescript, checker, parameterType, node)) {
            addIssue(
              sourceFile,
              argument,
              [
                'passes a next-intl translator into a parameter whose key domain is',
                'string, any, unknown, or otherwise unproven.',
              ].join(' '),
            );
          }
        });
        node.arguments.forEach((argument, index) => {
          if (!catalogFlow(argument)) return;
          const parameter = parameterForArgument(signature, index);
          const parameterType = parameter ? checker.getTypeOfSymbolAtLocation(parameter, node) : undefined;
          if (!catalogTargetPreservesShape(argument, parameterType)) {
            addIssue(
              sourceFile,
              argument,
              [
                'passes an English catalog value into a parameter that widens its exact',
                'message shape to any, unknown, a broad Record, or another container.',
              ].join(' '),
            );
          }
        });
      } else if (
        (typescript.isAsExpression(node) || typescript.isTypeAssertionExpression(node)) &&
        translatorDerived(node.expression)
      ) {
        addIssue(sourceFile, node, 'casts a next-intl translator; the key domain can no longer be proven.');
      } else if (
        (typescript.isAsExpression(node) || typescript.isTypeAssertionExpression(node)) &&
        catalogFlow(node.expression)
      ) {
        addIssue(sourceFile, node, 'casts an English catalog value; its exact message shape can no longer be proven.');
      } else if (
        typescript.isVariableDeclaration(node) &&
        node.initializer &&
        node.type &&
        translatorDerived(node.initializer)
      ) {
        const targetType = checker.getTypeFromTypeNode(node.type);
        if (!callableHasFiniteKeyDomain(typescript, checker, targetType, node)) {
          addIssue(sourceFile, node, 'assigns a next-intl translator to a declaration with an unproven key domain.');
        }
      } else if (
        (typescript.isVariableDeclaration(node) || typescript.isParameter(node) || typescript.isBindingElement(node)) &&
        node.initializer &&
        catalogFlow(node.initializer)
      ) {
        const targetType = node.type ? checker.getTypeFromTypeNode(node.type) : checker.getTypeAtLocation(node.name);
        if (!catalogTargetPreservesShape(node.initializer, targetType)) {
          addIssue(
            sourceFile,
            node,
            'assigns an English catalog value to a declaration that widens its exact message shape.',
          );
        }
      } else if (
        typescript.isBinaryExpression(node) &&
        node.operatorToken.kind === typescript.SyntaxKind.EqualsToken &&
        translatorDerived(node.right)
      ) {
        const targetType = checker.getTypeAtLocation(node.left);
        if (!callableHasFiniteKeyDomain(typescript, checker, targetType, node.left)) {
          addIssue(sourceFile, node, 'assigns a next-intl translator to a target with an unproven key domain.');
        }
      } else if (
        typescript.isBinaryExpression(node) &&
        node.operatorToken.kind === typescript.SyntaxKind.EqualsToken &&
        catalogFlow(node.right)
      ) {
        const targetType = checker.getTypeAtLocation(node.left);
        if (!catalogTargetPreservesShape(node.right, targetType)) {
          addIssue(
            sourceFile,
            node,
            'assigns an English catalog value to a target that widens its exact message shape.',
          );
        }
      } else if (typescript.isReturnStatement(node) && node.expression && translatorDerived(node.expression)) {
        let functionLike = node.parent;
        while (functionLike && !typescript.isFunctionLike(functionLike)) functionLike = functionLike.parent;
        const signature = functionLike ? checker.getSignatureFromDeclaration(functionLike) : undefined;
        const returnType = signature ? checker.getReturnTypeOfSignature(signature) : undefined;
        if (!callableHasFiniteKeyDomain(typescript, checker, returnType, node)) {
          addIssue(sourceFile, node, 'returns a next-intl translator through an unproven return type.');
        }
      } else if (typescript.isReturnStatement(node) && node.expression && catalogFlow(node.expression)) {
        let functionLike = node.parent;
        while (functionLike && !typescript.isFunctionLike(functionLike)) functionLike = functionLike.parent;
        const signature = functionLike ? checker.getSignatureFromDeclaration(functionLike) : undefined;
        const returnType = signature ? checker.getReturnTypeOfSignature(signature) : undefined;
        if (!catalogTargetPreservesShape(node.expression, returnType)) {
          addIssue(
            sourceFile,
            node,
            'returns an English catalog value through a type that widens its exact message shape.',
          );
        }
      } else if (
        typescript.isElementAccessExpression(node) &&
        catalogDerived(node.expression) &&
        (!node.argumentExpression ||
          !(
            typescript.isStringLiteral(node.argumentExpression) ||
            typescript.isNoSubstitutionTemplateLiteral(node.argumentExpression)
          ))
      ) {
        addIssue(sourceFile, node, 'indexes an English catalog with a dynamic or non-literal message key.');
      } else if (typescript.isSpreadAssignment(node) && catalogCarrier(node.expression)) {
        addIssue(sourceFile, node, 'spreads an English catalog; the resulting key flow cannot be proven.');
      } else if (
        (typescript.isForInStatement(node) || typescript.isForOfStatement(node)) &&
        catalogCarrier(node.expression)
      ) {
        addIssue(sourceFile, node, 'enumerates an English catalog dynamically; every runtime key use is unproven.');
      }
      if (catalogFlow(node) && trustedNextIntlMessagesAttribute(node)) {
        // next-intl consumes the catalog as data; message-key usage remains typed at translator calls.
      } else if (
        catalogFlow(node) &&
        node.parent &&
        typescript.isJsxExpression(node.parent) &&
        node.parent.expression === node
      ) {
        const targetType = checker.getContextualType(node);
        if (!catalogTargetPreservesShape(node, targetType)) {
          addIssue(
            sourceFile,
            node,
            'passes an English catalog value through a JSX prop that widens its exact message shape.',
          );
        }
      } else if (
        catalogFlow(node) &&
        node.parent &&
        (typescript.isPropertyAssignment(node.parent) ||
          typescript.isShorthandPropertyAssignment(node.parent) ||
          typescript.isArrayLiteralExpression(node.parent))
      ) {
        const targetType = checker.getContextualType(node);
        if (targetType && !catalogTargetPreservesShape(node, targetType)) {
          addIssue(
            sourceFile,
            node,
            'embeds an English catalog value in a container that widens its exact message shape.',
          );
        }
      }
      if (typescript.isIdentifier(node)) {
        const symbol = checker.getSymbolAtLocation(node);
        if (symbol && taintedSymbols.has(symbol)) {
          const parent = node.parent;
          const isDeclaration =
            (typescript.isVariableDeclaration(parent) || typescript.isParameter(parent)) && parent.name === node;
          const isTypeReference = typescript.isTypeQueryNode(parent);
          const isDirectCallee = typescript.isCallExpression(parent) && parent.expression === node;
          const isMethodReceiver =
            typescript.isPropertyAccessExpression(parent) &&
            parent.expression === node &&
            typescript.isCallExpression(parent.parent) &&
            parent.parent.expression === parent &&
            ['rich', 'markup', 'raw', 'has'].includes(parent.name.text);
          const isDirectArgument = typescript.isCallExpression(parent) && parent.arguments.includes(node);
          const isVariableInitializer = typescript.isVariableDeclaration(parent) && parent.initializer === node;
          const isAssignmentValue =
            typescript.isBinaryExpression(parent) &&
            parent.operatorToken.kind === typescript.SyntaxKind.EqualsToken &&
            parent.right === node;
          const isReturnValue = typescript.isReturnStatement(parent) && parent.expression === node;
          if (
            !isDeclaration &&
            !isTypeReference &&
            !isDirectCallee &&
            !isMethodReceiver &&
            !isDirectArgument &&
            !isVariableInitializer &&
            !isAssignmentValue &&
            !isReturnValue
          ) {
            addIssue(sourceFile, node, 'embeds a next-intl translator in an unsupported container or expression.');
          }
        }
      } else if (typescript.isPropertyAccessExpression(node) && translatorDerived(node)) {
        const parent = node.parent;
        const isDirectCallee = typescript.isCallExpression(parent) && parent.expression === node;
        const isMethodReceiver =
          typescript.isPropertyAccessExpression(parent) &&
          parent.expression === node &&
          typescript.isCallExpression(parent.parent) &&
          parent.parent.expression === parent &&
          ['rich', 'markup', 'raw', 'has'].includes(parent.name.text);
        const isDirectArgument = typescript.isCallExpression(parent) && parent.arguments.includes(node);
        const isVariableInitializer = typescript.isVariableDeclaration(parent) && parent.initializer === node;
        const isAssignmentValue =
          typescript.isBinaryExpression(parent) &&
          parent.operatorToken.kind === typescript.SyntaxKind.EqualsToken &&
          parent.right === node;
        const isReturnValue = typescript.isReturnStatement(parent) && parent.expression === node;
        if (
          !isDirectCallee &&
          !isMethodReceiver &&
          !isDirectArgument &&
          !isVariableInitializer &&
          !isAssignmentValue &&
          !isReturnValue
        ) {
          addIssue(sourceFile, node, 'embeds a next-intl translator in an unsupported container or expression.');
        }
      }
      typescript.forEachChild(node, inspect);
    }
    inspect(sourceFile);
  }

  if (issues.length > 0) {
    const header =
      'Translation safety preflight failed; no keys were classified. Close every broad translator boundary first:';
    throw new AuditError(
      `${header}\n${issues
        .sort()
        .map((issue) => `- ${issue}`)
        .join('\n')}`,
    );
  }
}

const ignoredSnapshotDirectories = new Set([
  '.git',
  '.cache',
  '.artifacts',
  'node_modules',
  'coverage',
  'storybook-static',
  'test-results',
  'tmp',
]);

async function collectProjectSnapshotPaths(root) {
  const directories = [];
  const jsonFiles = [];
  const pending = [root];
  while (pending.length > 0) {
    const directory = pending.pop();
    directories.push(directory);
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      if (
        !entry.isDirectory() ||
        ignoredSnapshotDirectories.has(entry.name) ||
        entry.name.startsWith('.translation-unused-audit-')
      ) {
        if (entry.isFile() && entry.name.endsWith('.json')) jsonFiles.push(join(directory, entry.name));
        continue;
      }
      pending.push(join(directory, entry.name));
    }
  }
  return { directories: directories.sort(), jsonFiles: jsonFiles.sort() };
}

async function existingPaths(paths) {
  const present = [];
  for (const path of paths) {
    try {
      await stat(path);
      present.push(path);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  return present;
}

async function captureStats(paths) {
  const snapshot = new Map();
  for (const path of paths) {
    try {
      const metadata = await stat(path, { bigint: true });
      snapshot.set(path, `${metadata.dev}:${metadata.ino}:${metadata.size}:${metadata.mtimeNs}:${metadata.ctimeNs}`);
    } catch (error) {
      if (error.code === 'ENOENT') {
        snapshot.set(path, '<missing>');
      } else {
        throw error;
      }
    }
  }
  return snapshot;
}

async function assertSnapshotUnchanged(snapshot) {
  const current = await captureStats([...snapshot.keys()]);
  for (const [path, signature] of snapshot) {
    if (current.get(path) !== signature) {
      throw new AuditError(`Compiler input changed during the audit: ${path}. Rerun from a stable working tree.`);
    }
  }
}

async function fingerprintInputs({ project, paths }) {
  const hash = createHash('sha256');
  hash.update(`unused-translation-audit:${SCRIPT_VERSION}\0`);
  hash.update(`${project.compilerVersion}\0${stableJson(project.compilerOptions)}\0`);
  for (const path of [...paths].sort()) {
    hash.update(`${path}\0`);
    hash.update(await readFile(path));
    hash.update('\0');
  }
  return hash.digest('hex');
}

async function readCheckpoint(path, fingerprint) {
  const results = new Map();
  if (!path) return results;
  let source;
  try {
    source = await readFile(path, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return results;
    throw error;
  }

  const lines = source.split('\n');
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line) continue;
    let record;
    try {
      record = JSON.parse(line);
    } catch (error) {
      if (index === lines.length - 1) {
        const validSource = lines.slice(0, index).filter(Boolean).join('\n');
        await writeFile(path, validSource ? `${validSource}\n` : '', 'utf8');
        break;
      }
      throw new AuditError(`Invalid checkpoint record at ${path}:${index + 1}: ${error.message}`);
    }
    if (record.type !== 'result' || record.fingerprint !== fingerprint || !Array.isArray(record.candidatePaths)) {
      continue;
    }
    if (record.candidateId !== candidateId(record.candidatePaths) || typeof record.passes !== 'boolean') {
      continue;
    }
    results.set(record.candidateId, {
      candidatePaths: record.candidatePaths,
      passes: record.passes,
    });
  }
  return results;
}

async function appendCheckpoint(path, record) {
  if (!path) return;
  await mkdir(dirname(path), { recursive: true });
  await appendFile(path, `${JSON.stringify(record)}\n`, 'utf8');
}

function sameGroup(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function formatCompilerFailure(result) {
  const output = [result.stdout, result.stderr].filter(Boolean).join('\n').trim();
  return output || `TypeScript exited with ${result.signal ?? result.code}.`;
}

function writeCandidateDeclaration(tempRoot) {
  const source = [
    "import messages from './candidate-messages.json';",
    '',
    "declare module 'next-intl' {",
    '  interface AppConfig {',
    '    Messages: typeof messages;',
    '  }',
    '}',
    '',
  ].join('\n');
  return writeFile(join(tempRoot, 'next-intl-candidate.d.ts'), source, 'utf8');
}

async function writeTemporaryConfig({
  tempRoot,
  tsconfigPath,
  rootFileNames,
  permanentDeclaration,
  candidateMessagesPath,
  pathMappings,
}) {
  const files = rootFileNames.filter((fileName) => resolve(fileName) !== permanentDeclaration);
  files.push(join(tempRoot, 'next-intl-candidate.d.ts'));
  const config = {
    extends: tsconfigPath,
    compilerOptions: {
      incremental: true,
      noEmit: true,
      tsBuildInfoFile: join(tempRoot, 'audit.tsbuildinfo'),
      paths: {
        '@/messages/en.json': [candidateMessagesPath],
        ...Object.fromEntries(Object.entries(pathMappings).filter(([pattern]) => pattern !== '@/messages/en.json')),
      },
    },
    files,
    include: [],
    exclude: [],
  };
  const configPath = join(tempRoot, 'tsconfig.json');
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
  return configPath;
}

export async function runAudit(rawOptions = {}) {
  const requestedRoot = resolve(rawOptions.repoRoot ?? repoRootFromScript);
  const root = await realpath(requestedRoot);
  const tsconfigPath = await canonicalPathInside(
    root,
    resolveFrom(requestedRoot, rawOptions.tsconfig ?? 'tsconfig.json'),
    'tsconfig',
  );
  const messagesPath = await canonicalPathInside(
    root,
    resolveFrom(requestedRoot, rawOptions.messages ?? 'messages/en.json'),
    'messages',
  );
  const permanentDeclaration = await canonicalPathInside(
    root,
    resolveFrom(requestedRoot, rawOptions.declaration ?? PERMANENT_DECLARATION),
    'declaration',
  );
  const checkpointPath =
    rawOptions.checkpoint === undefined
      ? await canonicalPathInside(root, resolveFrom(requestedRoot, DEFAULT_CHECKPOINT), 'checkpoint')
      : rawOptions.checkpoint
        ? await canonicalPathInside(root, resolveFrom(requestedRoot, rawOptions.checkpoint), 'checkpoint')
        : undefined;
  const outputPath = rawOptions.output
    ? await canonicalPathInside(root, resolveFrom(requestedRoot, rawOptions.output), 'output')
    : undefined;
  const stderr = rawOptions.stderr ?? process.stderr;
  const loadProjectImplementation = rawOptions.loadProject ?? loadProject;
  const preflight = rawOptions.preflight ?? runTranslationSafetyPreflight;
  const executeCompiler = rawOptions.executeCompiler ?? executeCompilerProcess;
  const makeTempDirectory = rawOptions.makeTempDirectory ?? (() => mkdtemp(join(root, '.translation-unused-audit-')));

  if (outputPath) {
    if ([tsconfigPath, messagesPath, permanentDeclaration].includes(outputPath)) {
      throw new AuditError('Output must not overwrite compiler or message inputs.');
    }
  }
  if (checkpointPath) {
    const checkpointFromRoot = relative(root, checkpointPath);
    const checkpointIsInsideRoot =
      checkpointFromRoot !== '' && !checkpointFromRoot.startsWith(`..${sep}`) && !isAbsolute(checkpointFromRoot);
    if (checkpointIsInsideRoot && checkpointFromRoot.split(sep)[0] !== '.cache') {
      throw new AuditError(
        'A repository-local checkpoint must be stored under .cache so compiler inputs stay isolated.',
      );
    }
  }

  const [messageSource, declarationSource] = await Promise.all([
    readFile(messagesPath, 'utf8'),
    readFile(permanentDeclaration, 'utf8'),
  ]);
  const messages = JSON.parse(messageSource);
  const keys = collectMessageKeys(messages);
  if (keys.length === 0) throw new AuditError('The English message catalog contains no string leaves.');

  const project = await loadProjectImplementation(root, tsconfigPath);
  const canonicalRootFileNames = await Promise.all(
    project.rootFileNames.map((fileName) => canonicalizePotentialPath(fileName)),
  );
  const declarationIndex = canonicalRootFileNames.indexOf(permanentDeclaration);
  if (declarationIndex === -1) {
    throw new AuditError(
      `The permanent next-intl declaration is not included by ${tsconfigPath}: ${permanentDeclaration}`,
    );
  }
  project.rootFileNames = project.rootFileNames.filter((_, index) => index !== declarationIndex);
  project.rootFileNames.push(permanentDeclaration);
  preflight({ project, root, messagesPath });

  let tempRoot;
  let activeChild;
  let interruptedSignal;
  const signalHandlers = new Map(
    ['SIGINT', 'SIGTERM'].map((signal) => [
      signal,
      () => {
        interruptedSignal ??= signal;
        activeChild?.kill(signal);
      },
    ]),
  );
  for (const [signal, handler] of signalHandlers) process.once(signal, handler);

  try {
    tempRoot = await makeTempDirectory();
    tempRoot = await canonicalPathInside(root, tempRoot, 'temporary directory');
    if (checkpointPath) await mkdir(dirname(checkpointPath), { recursive: true });
    const metadataPaths = await existingPaths([
      tsconfigPath,
      messagesPath,
      permanentDeclaration,
      join(root, 'package.json'),
      join(root, 'pnpm-lock.yaml'),
      join(root, 'pnpm-workspace.yaml'),
      join(root, 'node_modules/.modules.yaml'),
      project.compilerPath,
    ]);
    const { directories, jsonFiles } = await collectProjectSnapshotPaths(root);
    const fingerprintPaths = [...new Set([...project.rootFileNames, ...metadataPaths, ...jsonFiles])];
    const snapshot = await captureStats([...new Set([...fingerprintPaths, ...directories])]);
    const fingerprint = await fingerprintInputs({ project, paths: fingerprintPaths });
    const cache = await readCheckpoint(checkpointPath, fingerprint);
    const candidateMessagesPath = join(tempRoot, 'candidate-messages.json');
    await writeCandidateDeclaration(tempRoot);
    const temporaryConfigPath = await writeTemporaryConfig({
      tempRoot,
      tsconfigPath,
      rootFileNames: project.rootFileNames,
      permanentDeclaration,
      candidateMessagesPath,
      pathMappings: project.pathMappings ?? {},
    });

    const compile = async (candidateKeys) => {
      await assertSnapshotUnchanged(snapshot);
      const candidateMessages = removeMessageKeys(messages, candidateKeys);
      await writeFile(candidateMessagesPath, `${JSON.stringify(candidateMessages)}\n`, 'utf8');
      await rm(join(tempRoot, 'audit.tsbuildinfo'), { force: true });
      const result = await executeCompiler({
        command: process.execPath,
        args: [project.compilerPath, '--project', temporaryConfigPath, '--pretty', 'false'],
        cwd: root,
        candidatePaths: candidateKeys,
        tempRoot,
        onChild(child) {
          activeChild = child;
        },
      });
      activeChild = undefined;
      if (result.signal) {
        throw new AuditError(`TypeScript was terminated by ${result.signal}.`);
      }
      await assertSnapshotUnchanged(snapshot);
      return result;
    };

    stderr.write(`Translation audit: baseline compiler check (${keys.length} English keys).\n`);
    const baseline = await compile([]);
    if (baseline.code !== 0) {
      throw new AuditError(`Baseline typecheck failed; no keys were classified.\n${formatCompilerFailure(baseline)}`);
    }

    const verifiedUnused = new Set();
    const queue = initialGroups(keys);
    let compilerRuns = 1;
    let cachedRuns = 0;
    while (queue.length > 0) {
      if (interruptedSignal) throw new AuditError(`Audit interrupted by ${interruptedSignal}.`);
      const group = queue.shift();
      const candidatePaths = [...verifiedUnused, ...group].sort((left, right) => left.localeCompare(right));
      const id = candidateId(candidatePaths);
      const cached = cache.get(id);
      let passes;
      if (cached && sameGroup(cached.candidatePaths, candidatePaths)) {
        await assertSnapshotUnchanged(snapshot);
        passes = cached.passes;
        cachedRuns += 1;
      } else {
        const result = await compile(candidatePaths);
        compilerRuns += 1;
        passes = result.code === 0;
        const record = {
          type: 'result',
          fingerprint,
          candidateId: id,
          candidatePaths,
          passes,
        };
        cache.set(id, record);
        await appendCheckpoint(checkpointPath, record);
      }

      if (passes) {
        for (const key of group) verifiedUnused.add(key);
      } else if (group.length > 1) {
        queue.unshift(...splitGroup(group));
      }
      const progress = [
        `Translation audit: ${verifiedUnused.size} verified unused;`,
        `${queue.length} groups pending;`,
        `${compilerRuns} compiler runs;`,
        `${cachedRuns} cached.\r`,
      ].join(' ');
      stderr.write(progress);
    }
    stderr.write('\n');
    await assertSnapshotUnchanged(snapshot);
    if (
      (await readFile(messagesPath, 'utf8')) !== messageSource ||
      (await readFile(permanentDeclaration, 'utf8')) !== declarationSource
    ) {
      throw new AuditError('A protected message/type input changed during the audit; no result was emitted.');
    }

    const result = [...verifiedUnused].sort((left, right) => left.localeCompare(right));
    const serialized = `${JSON.stringify(result, null, 2)}\n`;
    if (outputPath) {
      await mkdir(dirname(outputPath), { recursive: true });
      await writeFile(outputPath, serialized, { encoding: 'utf8', flag: 'wx' });
    }
    return { result, serialized, compilerRuns, cachedRuns, tempRoot };
  } finally {
    await terminateCompilerProcess(activeChild);
    for (const [signal, handler] of signalHandlers) process.off(signal, handler);
    if (tempRoot) await rm(tempRoot, { recursive: true, force: true });
  }
}

async function main() {
  try {
    const options = parseArguments(process.argv.slice(2));
    if (options.help) {
      process.stdout.write(`${usage()}\n`);
      return;
    }
    const audit = await runAudit(options);
    process.stdout.write(audit.serialized);
  } catch (error) {
    process.stderr.write(`Translation audit failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
