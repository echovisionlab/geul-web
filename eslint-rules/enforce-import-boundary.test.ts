import path from 'node:path';
import { Linter } from 'eslint';
import tseslint from 'typescript-eslint';
import { describe, expect, it } from 'vitest';
import { enforceImportBoundaryRule, noMantineBoxButtonRule } from './enforce-import-boundary.mjs';

const workspaceRoot = process.cwd();
const ruleId = 'test-boundaries/enforce-import-boundary';
const linter = new Linter();
const restrictedRuntimePackages = [
  'next-intl',
  'next-intl/server',
  'next/navigation',
  '@mantine/notifications',
  '@tanstack/react-query',
  'next-auth/react',
];
const restrictedRuntimePackageSubpaths = [
  'next-intl/navigation',
  'next-intl/server/internal',
  'next/navigation/compat',
  '@mantine/notifications/internal',
  '@tanstack/react-query/build/modern',
  'next-auth/client/internal',
];

type Boundary = 'core' | 'feature-ui';

interface BoundaryFixture {
  boundary: Boundary;
  filePath: string;
  source: string;
}

function lintFixture({ boundary, filePath, source }: BoundaryFixture) {
  return linter.verify(
    source,
    [
      {
        files: ['**/*.{ts,tsx}'],
        languageOptions: {
          parser: tseslint.parser,
          parserOptions: {
            ecmaFeatures: { jsx: true },
            ecmaVersion: 'latest',
            sourceType: 'module',
          },
        },
        plugins: {
          'test-boundaries': {
            rules: { 'enforce-import-boundary': enforceImportBoundaryRule },
          },
        },
        rules: {
          [ruleId]: ['error', { boundary }],
        },
      },
    ],
    { filename: path.join(workspaceRoot, filePath) },
  );
}

function expectAllowed(fixture: BoundaryFixture) {
  expect(lintFixture(fixture)).toEqual([]);
}

function expectRejected(fixture: BoundaryFixture) {
  const messages = lintFixture(fixture);
  expect(messages.some((message) => message.ruleId === ruleId)).toBe(true);
}

describe('enforce-import-boundary', () => {
  it('allows relative imports that stay inside each declared boundary', () => {
    expectAllowed({
      boundary: 'feature-ui',
      filePath: 'features/admin/ui/AdminShell/AdminShellView.tsx',
      source:
        "import type { AdminNavigationViewProps } from '../AdminNavigation/AdminNavigationView'; export type Fixture = AdminNavigationViewProps;",
    });
    expectAllowed({
      boundary: 'core',
      filePath: 'components/core/Input/TextInput.tsx',
      source: "import type { ButtonProps } from '../Button'; export type Fixture = ButtonProps;",
    });
  });

  it.each([
    "import type { Controller } from '../Controller'; export type Fixture = Controller;",
    "export type { Controller } from '../Controller';",
    "export * from '../Controller';",
    "export const loadController = () => import('../Controller');",
    "export type Fixture = import('../Controller').Controller;",
    "import Controller = require('../Controller'); export type Fixture = Controller;",
    "export const controller = require('../Controller');",
  ])('rejects Feature UI boundary escapes through every import syntax: %s', (source) => {
    expectRejected({
      boundary: 'feature-ui',
      filePath: 'features/share/ui/ShareButtonView.tsx',
      source,
    });
  });

  it.each([
    "import { api } from '@/lib/api/client'; export { api };",
    "export { ShareButton } from '@/features/share/ShareButton';",
    "export const loadApi = () => import('@/lib/api/client');",
    "export const loadFeature = () => import('@/features/share/ShareButton');",
    "export type Api = import('@/lib/api/client').Api;",
    "export type Feature = import('@/features/share/ShareButton').ShareButtonProps;",
    "export type Route = import('@/app/page').PageProps;",
    "export type Hook = import('@/hooks/useFeature').Result;",
    "export const loadMessages = () => import('@/messages/en.json');",
    "import type { Contract } from '@echovisionlab/geul-common'; export type Fixture = Contract;",
  ])('rejects Feature UI runtime and alias imports without full ESLint config: %s', (source) => {
    expectRejected({
      boundary: 'feature-ui',
      filePath: 'features/share/ui/ShareButtonView.tsx',
      source,
    });
  });

  it.each([
    "import { Button } from '@/components/core/Button'; export { Button };",
    "export const loadLib = () => import('@/lib/api/client');",
    "export type Feature = import('@/features/share/ShareButton').ShareButtonProps;",
    "export type Contract = import('@echovisionlab/geul-common').SerializedEntity;",
  ])('keeps the Core @/* and runtime-package ban for every import syntax: %s', (source) => {
    expectRejected({
      boundary: 'core',
      filePath: 'components/core/Input/TextInput.tsx',
      source,
    });
  });

  it.each(['feature-ui', 'core'] as const)(
    'rejects every runtime package through static, export, dynamic, TS import, import-equals, and require in %s',
    (boundary) => {
      for (const restrictedPackage of restrictedRuntimePackages) {
        for (const source of [
          `import type { Fixture } from '${restrictedPackage}'; export type Result = Fixture;`,
          `export * from '${restrictedPackage}';`,
          `export const loadRuntime = () => import('${restrictedPackage}');`,
          `export type Fixture = import('${restrictedPackage}').Fixture;`,
          `import Runtime = require('${restrictedPackage}'); export type Fixture = typeof Runtime;`,
          `export const runtime = require('${restrictedPackage}');`,
        ]) {
          expectRejected({
            boundary,
            filePath:
              boundary === 'core' ? 'components/core/Input/TextInput.tsx' : 'features/share/ui/ShareButtonView.tsx',
            source,
          });
        }
      }
    },
  );

  it.each(['feature-ui', 'core'] as const)(
    'rejects runtime package subpaths through dynamic and TS imports in %s',
    (boundary) => {
      for (const restrictedPackage of restrictedRuntimePackageSubpaths) {
        for (const source of [
          `export const loadRuntime = () => import('${restrictedPackage}');`,
          `export type Fixture = import('${restrictedPackage}').Fixture;`,
        ]) {
          expectRejected({
            boundary,
            filePath:
              boundary === 'core' ? 'components/core/Input/TextInput.tsx' : 'features/share/ui/ShareButtonView.tsx',
            source,
          });
        }
      }
    },
  );

  it('allows Feature UI to consume Core aliases through static, dynamic, and TS imports', () => {
    for (const source of [
      "import { Button } from '@/components/core/Button'; export { Button };",
      "export const loadButton = () => import('@/components/core/Button');",
      "export type ButtonProps = import('@/components/core/Button').ButtonProps;",
    ]) {
      expectAllowed({
        boundary: 'feature-ui',
        filePath: 'features/share/ui/ShareButtonView.tsx',
        source,
      });
    }
  });

  it('rejects relative Core boundary escapes', () => {
    expectRejected({
      boundary: 'core',
      filePath: 'components/core/Input/TextInput.tsx',
      source: "import type { OutsideProps } from '../../OutsideComponent'; export type Fixture = OutsideProps;",
    });
  });
});

describe('no-mantine-box-button', () => {
  function lintBoxFixture(source: string) {
    return linter.verify(
      source,
      [
        {
          files: ['**/*.tsx'],
          languageOptions: {
            parser: tseslint.parser,
            parserOptions: {
              ecmaFeatures: { jsx: true },
              ecmaVersion: 'latest',
              sourceType: 'module',
            },
          },
          plugins: {
            'test-boundaries': {
              rules: { 'no-mantine-box-button': noMantineBoxButtonRule },
            },
          },
          rules: {
            'test-boundaries/no-mantine-box-button': 'error',
          },
        },
      ],
      { filename: path.join(workspaceRoot, 'features/map/ui/MapLibreMapView.tsx') },
    );
  }

  it.each([
    `import { Box } from '@mantine/core'; export const View = () => <Box component="button" />;`,
    `import { Box as MantineBox } from '@mantine/core'; export const View = () => <MantineBox component={'button'} />;`,
    `import * as Mantine from '@mantine/core'; export const View = () => <Mantine.Box component="button" />;`,
  ])('rejects a Mantine Box rendered as a button: %s', (source) => {
    expect(lintBoxFixture(source).some((message) => message.ruleId === 'test-boundaries/no-mantine-box-button')).toBe(
      true,
    );
  });

  it.each([
    `import { Box } from '@mantine/core'; export const View = () => <Box component="section" />;`,
    `import { Box } from './Box'; export const View = () => <Box component="button" />;`,
    `import { Box as MantineBox } from '@mantine/core'; export const View = () => <Box component="button" />;`,
  ])('does not flag non-button or non-Mantine Box elements: %s', (source) => {
    expect(lintBoxFixture(source)).toEqual([]);
  });
});
