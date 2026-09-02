import mantine from 'eslint-config-mantine';
import { defineConfig } from 'eslint/config';
import { importBoundaryPlugin } from './eslint-rules/enforce-import-boundary.mjs';

const restrictedCoreImportPatterns = [
  '@/features',
  '@/features/**',
  '**/features',
  '**/features/**',
  '@/app',
  '@/app/**',
  '**/app',
  '**/app/**',
  '@echovisionlab',
  '@echovisionlab/*',
  '@echovisionlab/**',
  '@/*',
  '@/**',
  '@/components',
  '@/components/**',
  '../../*',
  '../../**',
  '../../../*',
  '../../../**',
  '../../../../*',
  '../../../../**',
  '../../../../../*',
  '../../../../../**',
  '@/lib',
  '@/lib/**',
  '**/lib',
  '**/lib/**',
];

const restrictedCoreRootImportPatterns = [...restrictedCoreImportPatterns, '../*', '../**'];

const restrictedCoreImportPaths = [
  {
    name: 'next-intl',
    message: 'Core UI must receive translated strings through props instead of calling next-intl.',
  },
  {
    name: 'next-intl/server',
    message: 'Core UI must receive translated strings through props instead of calling next-intl.',
  },
  {
    name: 'next/navigation',
    message: 'Core UI must not own routing decisions. Move route state to app routes or features.',
  },
  {
    name: '@mantine/notifications',
    message: 'Core UI must not decide when notifications are shown. Move notification behavior to features.',
  },
  {
    name: '@tanstack/react-query',
    message: 'Core UI must not own query or mutation behavior. Move data behavior to features.',
  },
  {
    name: 'next-auth/react',
    message: 'Core UI must not own auth behavior. Move auth logic to features.',
  },
];

// @ts-check
export default defineConfig(
  ...mantine,
  {
    ignores: ['**/*.{mjs,cjs,js,d.ts,d.mts}', '.next', '.next-integration-*', 'gen', 'scripts', 'tests'],
  },
  {
    rules: { 'no-alert': 'off' },
  },
  {
    plugins: {
      boundaries: importBoundaryPlugin,
    },
  },
  {
    files: ['**/*.{story,stories}.tsx'],
    rules: { 'no-console': 'off' },
  },
  {
    files: ['**/*.tsx', '**/*.ts'],
    ignores: ['components/core/**/*.tsx', 'components/core/**/*.ts'],
    rules: {
      'boundaries/no-mantine-box-button': 'error',
      'no-restricted-syntax': [
        'error',
        {
          selector: "ImportDeclaration[source.value='@mantine/core'] > ImportSpecifier[imported.name='Tooltip']",
          message: 'Use @/components/core/Tooltip instead of Mantine Tooltip directly.',
        },
        {
          selector: "ImportDeclaration[source.value='@mantine/core'] > ImportSpecifier[imported.name='Alert']",
          message: 'Use @/components/core/Alert instead of Mantine Alert directly.',
        },
        {
          selector: "ImportDeclaration[source.value='@mantine/core'] > ImportSpecifier[imported.name='Drawer']",
          message: 'Use @/components/core/Drawer instead of Mantine Drawer directly.',
        },
        {
          selector: "ImportDeclaration[source.value='@mantine/core'] > ImportSpecifier[imported.name='Menu']",
          message: 'Use @/components/core/DropdownMenu instead of Mantine Menu directly.',
        },
        {
          selector: "ImportDeclaration[source.value='@mantine/core'] > ImportSpecifier[imported.name='Popover']",
          message: 'Use @/components/core/Popover instead of Mantine Popover directly.',
        },
      ],
    },
  },
  {
    files: ['**/*.tsx', '**/*.ts'],
    ignores: ['components/core/**/*.tsx', 'components/core/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@mantine/core',
              importNames: ['Badge'],
              message: 'Use @/components/core/Badge instead of Mantine Badge directly.',
            },
            {
              name: '@mantine/core',
              importNames: ['Card'],
              message: 'Use @/components/core/Section instead of Mantine Card directly.',
            },
            {
              name: '@mantine/core',
              importNames: ['Button'],
              message: 'Use @/components/core/Button instead of Mantine Button directly.',
            },
            {
              name: '@mantine/core',
              importNames: ['UnstyledButton'],
              message:
                'Use @/components/core/TextButton for text actions or a semantic Core control instead of Mantine UnstyledButton directly.',
            },
            {
              name: '@mantine/core',
              importNames: ['ActionIcon'],
              message: 'Use @/components/core/IconButton instead of Mantine ActionIcon directly.',
            },
            {
              name: '@mantine/core',
              importNames: ['ThemeIcon'],
              message: 'Use a background-free icon or a semantic Core component instead of Mantine ThemeIcon.',
            },
            {
              name: '@mantine/core',
              importNames: ['Tabs'],
              message: 'Use @/components/core/Tabs instead of Mantine Tabs directly.',
            },
            {
              name: '@mantine/core',
              importNames: ['TextInput'],
              message: 'Use @/components/core/Input instead of Mantine TextInput directly.',
            },
            {
              name: '@mantine/core',
              importNames: ['Textarea'],
              message: 'Use @/components/core/Input instead of Mantine Textarea directly.',
            },
            {
              name: '@mantine/core',
              importNames: ['Select'],
              message: 'Use @/components/core/Input instead of Mantine Select directly.',
            },
            {
              name: '@mantine/core',
              importNames: ['MultiSelect'],
              message: 'Use @/components/core/Input instead of Mantine MultiSelect directly.',
            },
            {
              name: '@mantine/core',
              importNames: ['PasswordInput'],
              message: 'Use @/components/core/Input instead of Mantine PasswordInput directly.',
            },
            {
              name: '@mantine/core',
              importNames: [
                'Checkbox',
                'ColorInput',
                'FileInput',
                'NativeSelect',
                'NumberInput',
                'PinInput',
                'Radio',
                'SegmentedControl',
                'Slider',
                'Switch',
                'TagsInput',
              ],
              message: 'Use @/components/core/Input for interactive form controls.',
            },
          ],
        },
      ],
    },
  },
  // components/ is a closed namespace: domain-owned UI belongs to features/<domain>/.
  {
    files: ['components/*.{ts,tsx}', 'components/**/*.{ts,tsx}'],
    ignores: ['components/core/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'Program',
          message:
            'components/ may contain only components/core/**. Move domain-owned UI and controllers to features/<domain>/.',
        },
      ],
    },
  },
  // Feature ownership must be explicit; catch-all domains are closed namespaces.
  {
    files: ['features/{common,shared,patterns}.{ts,tsx}', 'features/{common,shared,patterns}/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'Program',
          message:
            'features/common, features/shared, and features/patterns are not ownership domains. Move code to the feature that owns its meaning.',
        },
      ],
    },
  },
  {
    files: ['components/core/**/*.tsx', 'components/core/**/*.ts'],
    rules: {
      'boundaries/enforce-import-boundary': ['error', { boundary: 'core' }],
      'no-restricted-imports': [
        'error',
        {
          paths: restrictedCoreImportPaths,
          patterns: [
            {
              group: restrictedCoreImportPatterns,
              message:
                'Core UI must not import app, feature, non-core components, generated API, domain model, data, auth, routing, runtime context, or platform modules. Move orchestration to features and pass resolved UI state through props.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['features/**/ui/**/*.tsx', 'features/**/ui/**/*.ts'],
    rules: {
      'boundaries/enforce-import-boundary': ['error', { boundary: 'feature-ui' }],
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'next-intl',
              message: 'Feature UI receives translated labels through props.',
            },
            {
              name: 'next-intl/server',
              message: 'Feature UI receives translated labels through props.',
            },
            {
              name: 'next/navigation',
              message: 'Routing belongs to a feature controller or page composition.',
            },
            {
              name: '@tanstack/react-query',
              message: 'Queries and mutations belong to a feature controller.',
            },
            {
              name: '@mantine/notifications',
              message: 'Notifications belong to a feature controller.',
            },
            {
              name: 'next-auth/react',
              message: 'Session state belongs to a feature controller or page composition.',
            },
          ],
          patterns: [
            {
              group: ['@/i18n', '@/i18n/**', '@/messages', '@/messages/**'],
              message: 'Feature UI receives locale data and translated messages through props.',
            },
            {
              group: ['@echovisionlab', '@echovisionlab/*', '@echovisionlab/**'],
              message:
                'Feature UI must not import domain contracts. Map them to serializable view models in a controller.',
            },
            {
              group: ['@/app', '@/app/**', '@/features', '@/features/**', '@/hooks', '@/hooks/**', '@/lib', '@/lib/**'],
              message:
                'Feature UI must be a pure Core composition. Keep controllers and application hooks outside ui/, and pass domain state and events through props.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['components/core/index.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: restrictedCoreImportPaths,
          patterns: [
            {
              group: restrictedCoreRootImportPatterns,
              message:
                'The Core public barrel must not import app, feature, non-core components, generated API, domain model, data, auth, routing, runtime context, or platform modules. Export Core packages through local ./... imports only.',
            },
          ],
        },
      ],
    },
  },
  {
    languageOptions: {
      parserOptions: {
        tsconfigRootDir: process.cwd(),
        project: ['./tsconfig.eslint.json'],
      },
    },
  },
);
