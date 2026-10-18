import js from '@eslint/js';

export default [
  js.configs.recommended,
  {
    files: ['**/*.mjs'],
    languageOptions: {
      globals: { URL: 'readonly', Buffer: 'readonly', console: 'readonly', fetch: 'readonly', process: 'readonly' },
    },
    rules: { 'no-unused-vars': ['error', { argsIgnorePattern: '^_' }] },
  },
];
