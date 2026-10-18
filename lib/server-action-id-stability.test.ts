import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import type { SWCLoaderOptions } from 'next/dist/build/webpack/loaders/next-swc-loader';
import type { NextConfig } from 'next';

const nextRequire = createRequire(resolve(process.cwd(), 'package.json'));
const swcLoaderModule = nextRequire('next/dist/build/webpack/loaders/next-swc-loader') as {
  default?: (this: LoaderContext, source: string, inputSourceMap: unknown) => void;
} & ((this: LoaderContext, source: string, inputSourceMap: unknown) => void);
const nextSwcLoader = swcLoaderModule.default ?? swcLoaderModule;
const { WEBPACK_LAYERS } = nextRequire('next/dist/lib/constants') as {
  WEBPACK_LAYERS: { reactServerComponents: string };
};

type LoaderContext = {
  resourcePath: string;
  mode: 'production';
  sourceMap: false;
  getOptions: () => SWCLoaderOptions;
  async: () => (error: Error | null, output?: string) => void;
};

type ActionEntryMap = Record<string, { name: string }>;

const TEST_ONLY_BUILD_ONE_SALT = 'vitest-test-only-build-one-server-action-salt';
const TEST_ONLY_BUILD_TWO_SALT = 'vitest-test-only-build-two-server-action-salt';

function createLoaderOptions(serverReferenceHashSalt: string): SWCLoaderOptions {
  const rootDir = process.cwd();
  const nextConfig = {
    cacheComponents: false,
    compiler: {},
    experimental: { useCache: false, taint: false },
    pageExtensions: ['js', 'jsx', 'ts', 'tsx'],
  } satisfies NextConfig;

  const loaderOptions: SWCLoaderOptions = {
    isServer: true,
    compilerType: 'server',
    rootDir,
    pagesDir: resolve(rootDir, 'pages'),
    appDir: resolve(rootDir, 'app'),
    hasReactRefresh: false,
    nextConfig,
    jsConfig: { compilerOptions: {} },
    supportedBrowsers: undefined,
    // An omitted cache root keeps this in-memory compiler regression test from creating a SWC cache.
    swcCacheDir: undefined as unknown as string,
    serverComponents: true,
    serverReferenceHashSalt,
    bundleLayer: WEBPACK_LAYERS.reactServerComponents as SWCLoaderOptions['bundleLayer'],
    esm: true,
  };

  return loaderOptions;
}

function transformWithNextSwcLoader(source: string, filename: string, serverReferenceHashSalt: string) {
  const loaderOptions = createLoaderOptions(serverReferenceHashSalt);

  return new Promise<string>((resolveOutput, rejectOutput) => {
    const context: LoaderContext = {
      resourcePath: filename,
      mode: 'production',
      sourceMap: false,
      getOptions: () => loaderOptions,
      async: () => (error, output) => {
        if (error) {
          rejectOutput(error);
          return;
        }

        resolveOutput(output ?? '');
      },
    };

    nextSwcLoader.call(context, source, undefined);
  });
}

function extractActionEntryMap(transformedModule: string): ActionEntryMap {
  const marker = '__next_internal_action_entry_do_not_use__ ';
  const markerStart = transformedModule.indexOf(marker);
  expect(markerStart).toBeGreaterThanOrEqual(0);

  const jsonStart = markerStart + marker.length;
  const jsonEnd = transformedModule.indexOf(' */', jsonStart);
  expect(jsonEnd).toBeGreaterThan(jsonStart);

  return JSON.parse(transformedModule.slice(jsonStart, jsonEnd)) as ActionEntryMap;
}

describe('Next.js Server Action IDs', () => {
  it('keeps IDs stable for the same action file and build salt, and changes them when the salt changes', async () => {
    const filename = resolve(process.cwd(), 'app', '__next_action_identity_in_memory__.ts');
    const originalSource = [
      "'use server';",
      'export async function updateTitle(formData: FormData) {',
      "  return formData.get('title');",
      '}',
    ].join('\n');
    const bodyChangedSource = [
      "'use server';",
      'export async function updateTitle(formData: FormData) {',
      "  return String(formData.get('title'));",
      '}',
    ].join('\n');

    const originalEntries = extractActionEntryMap(
      await transformWithNextSwcLoader(originalSource, filename, TEST_ONLY_BUILD_ONE_SALT),
    );
    const bodyChangedEntries = extractActionEntryMap(
      await transformWithNextSwcLoader(bodyChangedSource, filename, TEST_ONLY_BUILD_ONE_SALT),
    );
    const independentlySaltedEntries = extractActionEntryMap(
      await transformWithNextSwcLoader(originalSource, filename, TEST_ONLY_BUILD_TWO_SALT),
    );

    expect(Object.values(originalEntries)).toEqual([{ name: 'updateTitle' }]);
    expect(bodyChangedEntries).toEqual(originalEntries);
    expect(Object.keys(independentlySaltedEntries)).not.toEqual(Object.keys(originalEntries));
  });
});
