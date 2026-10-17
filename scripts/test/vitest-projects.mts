import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

export const testProjectNames = ['node-unit', 'component', 'server-contract', 'editor-integration'] as const;
export type TestProjectName = (typeof testProjectNames)[number];

/** Keep the existing environment directives authoritative, including Node SSR tests. */
export function classifyTest(file: string, source: string): TestProjectName {
  const explicitTier = source.match(
    /^\s*\/\/\s*@geul-test-tier\s+(node-unit|component|server-contract|editor-integration)\s*$/m,
  )?.[1] as TestProjectName | undefined;
  if (explicitTier) {
    return explicitTier;
  }
  if (
    file.startsWith('features/editor/') &&
    (file.includes('.integration.test.') ||
      (file.startsWith('features/editor/tiptap/') &&
        /^\s*(?:\/\/|\/\*\*?)\s*@vitest-environment\s+jsdom\b/m.test(source)))
  ) {
    return 'editor-integration';
  }
  if (
    /^\s*(?:\/\/|\/\*\*?)\s*@vitest-environment\s+(?:jsdom|happy-dom)\b/m.test(source) ||
    /\b(?:renderToString|renderToStaticMarkup|JSDOM|createRoot)\s*\(/.test(source)
  ) {
    return 'component';
  }
  if (file.startsWith('app/') || file === 'proxy.test.ts') {
    return 'server-contract';
  }
  return 'node-unit';
}

/**
 * A file may share one worker runtime with others (threads, no per-file isolation) when nothing it does
 * can outlive it: no module mocks, global or environment stubs, spies, fake clocks or global
 * redefinitions. DOM files must also clean up what they render (Testing Library unmounts after each test;
 * older tests unmount in `afterEach`). `// @geul-test-isolate` keeps a file isolated when the module under
 * test holds state across imports. Everything else keeps forks and file isolation.
 */
const runtimeMutation =
  /\bvi\.(?:mock|doMock|stubGlobal|stubEnv|spyOn|useFakeTimers|setSystemTime)\b|process\.env(?:\.[A-Z_]+\s*=|\[)|globalThis\.[A-Za-z]+\s*=|Object\.defineProperty\((?:globalThis|window|document|navigator|HTMLElement|Element)\b|window\.[A-Za-z]+\s*=|\bTZ\b/;
const domCleanup = /@testing-library\/react|@\/test\/render|afterEach\([^)]*\)?\s*=>\s*\{[\s\S]{0,400}unmount\(/;

export function sharesRuntime(project: TestProjectName, source: string): boolean {
  if (/^\s*\/\/\s*@geul-test-isolate\b/m.test(source)) {
    return false;
  }
  if ((project !== 'node-unit' && project !== 'component') || runtimeMutation.test(source)) {
    return false;
  }
  return project === 'node-unit' || domCleanup.test(source);
}

/** Literal paths still need glob escaping: Next route names contain [] and (). */
export function literalTestGlob(file: string): string {
  return file.replace(/[()[\]{}?*+!@]/g, '\\$&');
}

export function discoverTestProjects(root: string): Record<TestProjectName, string[]> {
  const projects: Record<TestProjectName, string[]> = {
    'node-unit': [],
    component: [],
    'server-contract': [],
    'editor-integration': [],
  };
  const shared = new Set<string>();
  function visit(directory: string) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        if (
          entry.name !== 'node_modules' &&
          entry.name !== '.git' &&
          entry.name !== '.next' &&
          !entry.name.startsWith('.next-integration-') &&
          entry.name !== 'storybook-static'
        ) {
          visit(path);
        }
      } else if (/\.test\.tsx?$/.test(entry.name)) {
        const file = relative(root, path).split(sep).join('/');
        const source = readFileSync(path, 'utf8');
        const project = classifyTest(file, source);
        projects[project].push(literalTestGlob(file));
        if (sharesRuntime(project, source)) {
          shared.add(literalTestGlob(file));
        }
      }
    }
  }
  visit(root);
  for (const files of Object.values(projects)) {
    files.sort();
  }
  sharedTestFiles.set(root, shared);
  return projects;
}

const sharedTestFiles = new Map<string, Set<string>>();

/** The discovered files of one project that may share a runtime (call after `discoverTestProjects`). */
export function sharedRuntimeFiles(root: string, files: readonly string[]): { shared: string[]; isolated: string[] } {
  const shared = sharedTestFiles.get(root) ?? new Set<string>();
  return {
    shared: files.filter((file) => shared.has(file)),
    isolated: files.filter((file) => !shared.has(file)),
  };
}
