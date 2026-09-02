import type { StorybookConfig } from '@storybook/nextjs';
import { existsSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const typeScriptLoader = fileURLToPath(new URL('./loaders/transpile-typescript.cjs', import.meta.url));
const useLocalContracts = process.env.LOCAL_CONTRACTS === '1';

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

const config: StorybookConfig = {
  core: {
    disableWhatsNewNotifications: true,
    disableTelemetry: true,
    enableCrashReports: false,
  },
  stories: ['../components/**/*.(stories|story).@(js|jsx|ts|tsx)', '../features/**/*.(stories|story).@(js|jsx|ts|tsx)'],
  staticDirs: [
    { from: '../tests/fixtures/media', to: '/storybook/media' },
    { from: '../lib/assets/fonts', to: '/storybook/fonts' },
    { from: '../public/providers', to: '/providers' },
  ],
  addons: ['@storybook/addon-themes', 'storybook-addon-pseudo-states'],
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
    webpackConfig.module ??= { rules: [] };
    webpackConfig.module.rules ??= [];
    webpackConfig.resolve ??= {};
    webpackConfig.resolve.alias = {
      ...webpackConfig.resolve.alias,
      ...(localContractRoots
        ? {
            '@echovisionlab/geul-common': localContractRoots.common,
            '@echovisionlab/geul-event': localContractRoots.event,
            '@echovisionlab/geul-telemetry': localContractRoots.telemetry,
            '@echovisionlab/geul-telemetry/actor': `${localContractRoots.telemetry}/actor.ts`,
            '@echovisionlab/geul-telemetry/redaction': `${localContractRoots.telemetry}/redaction.ts`,
            '@echovisionlab/geul-telemetry/request-id': `${localContractRoots.telemetry}/request-id.ts`,
            '@echovisionlab/geul-telemetry/trace': `${localContractRoots.telemetry}/trace.ts`,
            '@echovisionlab/geul-proto/common': `${localContractRoots.proto}/common/v1`,
            '@echovisionlab/geul-proto/intra': `${localContractRoots.proto}/intra/v1`,
            '@echovisionlab/geul-proto/public': `${localContractRoots.proto}/open/v1`,
            '@echovisionlab/geul-proto/secure': `${localContractRoots.proto}/manage/v1`,
          }
        : {}),
      // Client stories inject local adapters; never bundle Next's server-only guard.
      'server-only': false,
    };
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
};
export default config;
