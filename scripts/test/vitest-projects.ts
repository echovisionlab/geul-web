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
        projects[classifyTest(file, readFileSync(path, 'utf8'))].push(literalTestGlob(file));
      }
    }
  }
  visit(root);
  for (const files of Object.values(projects)) {
    files.sort();
  }
  return projects;
}
