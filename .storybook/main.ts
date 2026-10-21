import type { StorybookConfig } from '@storybook/nextjs';
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
// Storybook evaluates this file with Node's own loader: explicit `.ts` specifiers, dependency-free modules only.
import { geulFontStylesheets } from '../lib/styles/geul-fonts.generated.ts';
import { readPublicRuntimeEnvironment } from '../lib/public-runtime-config.ts';
import { prepareThreeRuntime } from '../scripts/prepare-three-runtime.mjs';

const typeScriptLoader = fileURLToPath(new URL('./loaders/transpile-typescript.cjs', import.meta.url));
const serverActionStubLoader = fileURLToPath(new URL('./loaders/stub-server-actions.cjs', import.meta.url));
const useLocalContracts = process.env.LOCAL_CONTRACTS === '1';
const localFontRoot = new URL('../.artifacts/fonts/dist/fonts/', import.meta.url);
const localManifestUrl = new URL('manifest.json', localFontRoot);
const localFontManifest = existsSync(localManifestUrl) ? JSON.parse(readFileSync(localManifestUrl, 'utf8')) : null;
const useLocalFonts = Boolean(
  localFontManifest?.complete &&
  Object.values(geulFontStylesheets).every(
    (file) => Object.values(localFontManifest.stylesheets).includes(file) && existsSync(new URL(file, localFontRoot)),
  ),
);
const fontBaseUrl = useLocalFonts ? '/fonts' : readPublicRuntimeEnvironment().fontBaseUrl;
function htmlAttribute(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
}

function resolveLocalContractRoot(label: string, url: URL): string {
  const path = fileURLToPath(url);
  if (!existsSync(path)) {
    throw new Error(`${label} local contract root is missing at ${path}`);
  }
  return realpathSync(path);
}

const localContractRoots = useLocalContracts
  ? {
      common: resolveLocalContractRoot('Common', new URL('../../geul-common/src', import.meta.url)),
      event: resolveLocalContractRoot(
        'Event',
        new URL('../../geul-event-contracts/packages/event/src', import.meta.url),
      ),
      telemetry: resolveLocalContractRoot('Telemetry', new URL('../../geul-telemetry/src', import.meta.url)),
      proto: resolveLocalContractRoot(
        'Proto',
        new URL('../../geul-event-contracts/packages/proto/gen/api', import.meta.url),
      ),
    }
  : null;

const config = {
  core: {
    disableWhatsNewNotifications: true,
    disableTelemetry: true,
    enableCrashReports: false,
  },
  stories: [
    '../components/**/*.(stories|story).@(js|jsx|ts|tsx)',
    '../features/**/*.(stories|story).@(js|jsx|ts|tsx)',
    '../stories/**/*.(stories|story).@(js|jsx|ts|tsx)',
  ],
  staticDirs: [
    { from: '../tests/fixtures/media', to: '/storybook/media' },
    ...(useLocalFonts ? [{ from: fileURLToPath(localFontRoot), to: '/fonts' }] : []),
    { from: '../public/providers', to: '/providers' },
    { from: '../public/fixtures', to: '/fixtures' },
    { from: '../public/storybook-fixtures', to: '/storybook-fixtures' },
    { from: '../docs', to: '/ui-kit-docs' },
    { from: '../design/storybook', to: '/design-system-review' },
  ],
  previewHead: (head) => `${head}
    <link id="geul-font-stylesheet" rel="stylesheet" data-font-base-url="${htmlAttribute(fontBaseUrl)}"
      href="${htmlAttribute(`${fontBaseUrl.replace(/\/+$/, '')}/${geulFontStylesheets.latin}`)}">`,
  addons: [
    '@storybook/addon-docs',
    '@storybook/addon-themes',
    'storybook-addon-pseudo-states',
    '@storybook/addon-a11y',
  ],
  docs: { defaultName: 'Documentation' },
  // Stories define their controls explicitly; automatic prop extraction only
  // scans application modules that are not rendered as Storybook docs.
  typescript: {
    reactDocgen: false,
  },
  framework: {
    name: '@storybook/nextjs',
    options: {},
  },
  webpackFinal: async (webpackConfig) => {
    await prepareThreeRuntime();
    // Local review builds keep the same modules and runtime while avoiding a
    // long minification pass between UI edits. CI/default builds stay minified.
    if (process.env.UI_KIT_MINIFY === '0') {
      webpackConfig.optimization ??= {};
      webpackConfig.optimization.minimize = false;
    }
    webpackConfig.module ??= { rules: [] };
    webpackConfig.module.rules ??= [];
    webpackConfig.resolve ??= {};
    webpackConfig.resolve.alias = {
      ...webpackConfig.resolve.alias,
      '@': fileURLToPath(new URL('../', import.meta.url)),
      three$: fileURLToPath(new URL('../lib/three/three-cdn-module.generated.mjs', import.meta.url)),
      ...(localContractRoots
        ? {
            // Keep local Common sources on the application's Yjs constructor.
            yjs$: fileURLToPath(new URL('../node_modules/yjs/dist/yjs.mjs', import.meta.url)),
            '@echovisionlab/geul-common': localContractRoots.common,
            '@echovisionlab/geul-event': localContractRoots.event,
            '@echovisionlab/geul-telemetry': localContractRoots.telemetry,
            '@echovisionlab/geul-telemetry/actor': `${localContractRoots.telemetry}/actor.ts`,
            '@echovisionlab/geul-telemetry/redaction': `${localContractRoots.telemetry}/redaction.ts`,
            '@echovisionlab/geul-telemetry/request-id': `${localContractRoots.telemetry}/request-id.ts`,
            '@echovisionlab/geul-telemetry/trace': `${localContractRoots.telemetry}/trace.ts`,
            '@echovisionlab/geul-proto/content': `${localContractRoots.proto}/content/v1`,
            '@echovisionlab/geul-proto/policy': `${localContractRoots.proto}/policy/v1`,
            '@echovisionlab/geul-proto/common': `${localContractRoots.proto}/common/v1`,
            '@echovisionlab/geul-proto/intra': `${localContractRoots.proto}/intra/v1`,
            '@echovisionlab/geul-proto/public': `${localContractRoots.proto}/open/v1`,
            '@echovisionlab/geul-proto/secure': `${localContractRoots.proto}/manage/v1`,
          }
        : {}),
      // Client stories inject local adapters; never bundle Next's server-only guard.
      'server-only': false,
    };
    // Like Next's client build, never bundle server action implementations.
    webpackConfig.module.rules.push({
      test: /\.tsx?$/,
      exclude: /node_modules/,
      enforce: 'pre',
      use: serverActionStubLoader,
    });
    webpackConfig.module.rules.push({
      test: /node_modules[/\\]@echovisionlab[/\\](?:geul-common|geul-event|geul-proto|geul-telemetry)[/\\].*\.tsx?$/,
      exclude: /\.d\.ts$/,
      use: typeScriptLoader,
    });
    if (localContractRoots) {
      webpackConfig.module.rules.push({
        test: /\.tsx?$/,
        include: Object.values(localContractRoots),
        exclude: /\.d\.ts$/,
        use: typeScriptLoader,
      });
    }
    return webpackConfig;
  },
} satisfies StorybookConfig;
export default config;
