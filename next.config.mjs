import bundleAnalyzer from '@next/bundle-analyzer';
import createNextIntlPlugin from 'next-intl/plugin';
import { fileURLToPath } from 'node:url';

const useLocalContracts = process.env.LOCAL_CONTRACTS === '1';
const releaseImageBuild = process.env.RELEASE_IMAGE_BUILD === 'true';
const workspaceRoot = fileURLToPath(new URL('..', import.meta.url));

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
});
const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

const allowedDevOrigins = process.env.ALLOWED_DEV_ORIGINS
  ? process.env.ALLOWED_DEV_ORIGINS.split(',').map((s) => s.trim())
  : [];

export default withNextIntl(
  withBundleAnalyzer({
    distDir: process.env.DIST_DIR || '.next',
    output: 'standalone',
    outputFileTracingIncludes: {
      '/*': ['./node_modules/@swc/helpers/**/*'],
    },
    reactStrictMode: false,
    transpilePackages: [
      '@echovisionlab/geul-common',
      '@echovisionlab/geul-event',
      '@echovisionlab/geul-proto',
      '@echovisionlab/geul-telemetry',
    ],
    turbopack: useLocalContracts
      ? {
          root: workspaceRoot,
        }
      : undefined,
    allowedDevOrigins,
    images: {
      loader: 'custom',
      loaderFile: './lib/image-loader.ts',
    },
    experimental: {
      useTypeScriptCli: true,
    },
    typescript: {
      // Release Please only changes reviewed release metadata. The implementation
      // source has already passed the required PR build with the TypeScript 7 CLI.
      ignoreBuildErrors: releaseImageBuild,
      tsconfigPath: useLocalContracts ? 'tsconfig.local-contracts.json' : 'tsconfig.json',
    },
    serverExternalPackages: ['yjs', 'sharp'],
  }),
);
