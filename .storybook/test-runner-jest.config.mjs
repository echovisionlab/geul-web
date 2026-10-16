import { getJestConfig } from '@storybook/test-runner';
import { fileURLToPath } from 'node:url';

export default {
  ...getJestConfig(),
  testEnvironment: fileURLToPath(new URL('./test-environment.mjs', import.meta.url)),
};
