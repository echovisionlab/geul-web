import { resolve } from 'node:path';
import { mergeConfig } from 'vitest/config';
import baseConfig from './vitest.config';

const contractRoot = resolve(__dirname, '../geul-event-contracts/packages/proto/gen/api');
const eventRoot = resolve(__dirname, '../geul-event-contracts/packages/event/src');
const commonRoot = resolve(__dirname, '../geul-common/src');
const telemetryRoot = resolve(__dirname, '../geul-telemetry/src');

export default mergeConfig(baseConfig, {
  resolve: {
    // Local source aliases bypass Common's published peer boundary. Force the
    // caller's Yjs constructor so cross-package Y.Doc checks match production.
    dedupe: ['yjs'],
    alias: [
      { find: /^@echovisionlab\/geul-common$/, replacement: resolve(commonRoot, 'index.ts') },
      { find: /^@echovisionlab\/geul-common\/(.+)$/, replacement: `${commonRoot}/$1` },
      { find: /^@echovisionlab\/geul-event$/, replacement: resolve(eventRoot, 'index.ts') },
      { find: /^@echovisionlab\/geul-telemetry$/, replacement: resolve(telemetryRoot, 'index.ts') },
      { find: /^@echovisionlab\/geul-telemetry\/(.+)$/, replacement: `${telemetryRoot}/$1.ts` },
      { find: /^@echovisionlab\/geul-proto\/common\/(.+)$/, replacement: `${contractRoot}/common/v1/$1` },
      { find: /^@echovisionlab\/geul-proto\/content\/(.+)$/, replacement: `${contractRoot}/content/v1/$1` },
      { find: /^@echovisionlab\/geul-proto\/intra\/(.+)$/, replacement: `${contractRoot}/intra/v1/$1` },
      { find: /^@echovisionlab\/geul-proto\/policy\/(.+)$/, replacement: `${contractRoot}/policy/v1/$1` },
      { find: /^@echovisionlab\/geul-proto\/public\/(.+)$/, replacement: `${contractRoot}/open/v1/$1` },
      { find: /^@echovisionlab\/geul-proto\/secure\/(.+)$/, replacement: `${contractRoot}/manage/v1/$1` },
    ],
  },
});
