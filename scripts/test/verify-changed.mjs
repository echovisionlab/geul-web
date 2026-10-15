#!/usr/bin/env node
// The fast verification loop: checks only what the working tree changed.
//
//   node scripts/test/verify-changed.mjs [--base <git-ref>] [--no-storybook] [--no-typecheck]
//
// Steps, in order (each stops the run when it fails):
//   1. tsc --noEmit                         (whole project; LOCAL_CONTRACTS=1 uses sibling contracts)
//   2. eslint on changed .ts/.tsx/.mjs      (--cache)
//   3. stylelint on changed .css
//   4. i18n:check when messages/ changed
//   5. vitest --changed                     (tests related to the changed files)
//   6. Storybook test-runner for affected stories (needs the dev server on :6010)
// Full suites stay available as `pnpm test` and `pnpm storybook:test`.
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(name);
  return index === -1 ? fallback : args[index + 1];
};
const base = option('--base', null);
// LOCAL_CONTRACTS=1 resolves sibling contract checkouts (see tsconfig.local-contracts.json).
const localContracts = process.env.LOCAL_CONTRACTS === '1';

function git(...command) {
  return execFileSync('git', command, { encoding: 'utf8' }).split('\n').filter(Boolean);
}
// Deletions count as changes (a deleted module can break importers) but only existing files go to linters.
const changed = base
  ? git('diff', '--name-only', base)
  : [...git('diff', '--name-only', 'HEAD'), ...git('ls-files', '--others', '--exclude-standard')];
if (changed.length === 0) {
  console.log('verify-changed: nothing changed');
  process.exit(0);
}
const existing = changed.filter((file) => existsSync(file));

const scripts = existing.filter((file) => /\.(ts|tsx|mjs|js)$/.test(file) && !file.startsWith('.artifacts/'));
const styles = existing.filter((file) => file.endsWith('.css'));
const messages = changed.some((file) => file.startsWith('messages/'));

function run(title, command, commandArgs) {
  const started = Date.now();
  console.log(`\n▶ ${title}`);
  const result = spawnSync(command, commandArgs, { stdio: 'inherit' });
  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  if (result.status !== 0) {
    console.error(`✖ ${title} failed (${seconds}s)`);
    process.exit(result.status ?? 1);
  }
  console.log(`✔ ${title} (${seconds}s)`);
}

if (!args.includes('--no-typecheck')) {
  run('typecheck', 'pnpm', [
    'exec',
    'tsc',
    '--noEmit',
    ...(localContracts ? ['--project', 'tsconfig.local-contracts.json'] : []),
  ]);
}
if (scripts.length > 0) {
  run(`eslint (${scripts.length} files)`, 'pnpm', [
    'exec',
    'eslint',
    '--cache',
    '--no-warn-ignored',
    '--max-warnings=0',
    ...scripts,
  ]);
}
if (styles.length > 0) {
  run(`stylelint (${styles.length} files)`, 'pnpm', ['exec', 'stylelint', '--cache', ...styles]);
}
if (messages) {
  run('i18n:check', 'pnpm', ['i18n:check']);
}
run('vitest --changed', 'pnpm', [
  'exec',
  'vitest',
  'run',
  ...(localContracts ? ['--config', 'vitest.local-contracts.config.ts'] : []),
  '--changed',
  ...(base ? [base] : []),
]);
if (!args.includes('--no-storybook')) {
  run('storybook (affected stories)', 'node', [
    'scripts/test/storybook-changed.mjs',
    ...(base ? ['--base', base] : []),
  ]);
}
console.log('\nverify-changed: all steps passed');
