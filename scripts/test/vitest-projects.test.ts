// @geul-test-tier node-unit

import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { classifyTest, discoverTestProjects, literalTestGlob } from './vitest-projects';

let fixture: string | undefined;
afterEach(() => {
  if (fixture) {
    rmSync(fixture, { recursive: true, force: true });
    fixture = undefined;
  }
});

describe('test project boundaries', () => {
  it('assigns the complete repository test collection to exactly one project', () => {
    const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
    // Git provides an independent inventory, including new local test files. The
    // classifier must not silently narrow the former **/*.test.{ts,tsx} suite.
    const repositoryTests = execFileSync(
      'git',
      ['ls-files', '-z', '--cached', '--others', '--exclude-standard', '--', '*.test.ts', '*.test.tsx'],
      { cwd: root, encoding: 'utf8' },
    )
      .split('\0')
      .filter((file) => file && existsSync(join(root, file)))
      .map(literalTestGlob)
      .sort();
    const projectTests = Object.values(discoverTestProjects(root)).flat().sort();

    expect(new Set(projectTests).size).toBe(projectTests.length);
    expect(projectTests).toEqual(repositoryTests);
  });

  it.each([
    ['lib/convert/core.test.ts', '', 'node-unit'],
    ['features/editor/tiptap/profiles/policy-document.test.ts', '', 'node-unit'],
    ['components/core/Button/Button.test.tsx', '// @vitest-environment jsdom', 'component'],
    ['app/(general)/page.test.tsx', 'renderToStaticMarkup(node)', 'component'],
    ['lib/convert/map-data.test.ts', 'new JSDOM(html)', 'component'],
    ['app/api/auth/logout/route.test.ts', '', 'server-contract'],
    ['features/editor/tiptap/block-enter-commands.test.ts', '// @vitest-environment jsdom', 'editor-integration'],
    ['features/editor/lib/block-insert.integration.test.tsx', '// @vitest-environment jsdom', 'editor-integration'],
    ['features/editor/tiptap/block-room-tiptap-diff.test.ts', '', 'node-unit'],
  ])('classifies %s with %j as %s', (file, source, expected) => {
    expect(classifyTest(file, source)).toBe(expected);
  });

  it('keeps an explicit tier authoritative without interpreting marker text inside assertions', () => {
    expect(classifyTest('lib/example.test.ts', '// @geul-test-tier editor-integration\n')).toBe('editor-integration');
    expect(classifyTest('lib/example.test.ts', "expect(source).toContain('@vitest-environment jsdom')")).toBe(
      'node-unit',
    );
  });

  it('discovers every test exactly once, including hidden Storybook and literal Next route paths', () => {
    fixture = mkdtempSync(join(tmpdir(), 'geul-test-projects-'));
    const cases = [
      ['lib/logic.test.ts', ''],
      ['.storybook/preview.test.tsx', '// @vitest-environment jsdom'],
      ['app/(general)/[...slug]/page.test.tsx', ''],
      ['features/editor/tiptap/keyboard.test.ts', '// @vitest-environment jsdom'],
      ['node_modules/dependency.test.ts', ''],
      ['.next/generated.test.ts', ''],
      ['.next-integration-1/generated.test.ts', ''],
      ['storybook-static/generated.test.ts', ''],
    ];
    for (const [file, source] of cases) {
      const target = join(fixture, file);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, source);
    }
    const projects = discoverTestProjects(fixture);
    expect(projects['node-unit']).toEqual(['lib/logic.test.ts']);
    expect(projects.component).toEqual(['.storybook/preview.test.tsx']);
    expect(projects['server-contract']).toEqual([literalTestGlob('app/(general)/[...slug]/page.test.tsx')]);
    expect(projects['editor-integration']).toEqual(['features/editor/tiptap/keyboard.test.ts']);
    const allFiles = Object.values(projects).flat();
    expect(allFiles).toHaveLength(4);
    expect(new Set(allFiles).size).toBe(allFiles.length);
  });
});
