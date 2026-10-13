import { createHash } from 'node:crypto';
import { existsSync, lstatSync, readFileSync, readdirSync, realpathSync, statSync } from 'node:fs';
import path from 'node:path';

export const reviewName = (name) => {
  if (typeof name !== 'string' || name.length > 64 || !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(name))
    throw new Error('Use a lowercase review name with letters, numbers and single hyphens.');
  return name;
};
export const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));
export const sha256 = (file) => createHash('sha256').update(readFileSync(file)).digest('hex');
export function projectPath(root, relative) {
  root = path.resolve(root);
  if (
    typeof relative !== 'string' ||
    !relative ||
    path.isAbsolute(relative) ||
    relative.includes('\\') ||
    relative.split('/').includes('..')
  )
    throw new Error(`Expected a project-relative path: ${relative}`);
  const target = path.resolve(root, relative);
  if (target === root || !target.startsWith(root + path.sep)) throw new Error(`Path leaves the project: ${relative}`);
  if (existsSync(target) && !realpathSync(target).startsWith(realpathSync(root) + path.sep))
    throw new Error(`Symlink leaves the project: ${relative}`);
  return target;
}
export function filesUnder(root, relative) {
  const target = projectPath(root, relative);
  if (lstatSync(target).isSymbolicLink()) throw new Error(`Review paths cannot be symlinks: ${relative}`);
  if (statSync(target).isFile()) return [relative];
  return readdirSync(target, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name))
    .flatMap((entry) => filesUnder(root, `${relative}/${entry.name}`));
}
const strings = (values, label) => {
  if (!Array.isArray(values) || !values.length || values.some((value) => typeof value !== 'string' || !value.trim()))
    throw new Error(`${label} must be a nonempty string array.`);
  return values;
};
export function loadPlan(root, name) {
  reviewName(name);
  const file = projectPath(root, `design/storybook/review-plans/${name}.json`);
  if (!existsSync(file)) throw new Error(`Unknown review plan: ${name}. See design/storybook/review-plans/.`);
  const plan = readJson(file);
  if (
    plan.schemaVersion !== 1 ||
    typeof plan.title !== 'string' ||
    !plan.title.trim() ||
    typeof plan.scope !== 'string' ||
    !plan.scope.trim()
  )
    throw new Error('Plan requires schemaVersion 1, title and scope.');
  const sourceTests = strings(
    typeof plan.sourceTests === 'string' ? readJson(projectPath(root, plan.sourceTests)) : plan.sourceTests,
    'sourceTests',
  );
  sourceTests.forEach((file) => {
    projectPath(root, file);
    if (!/\.test\.[jt]sx?$/.test(file) || !existsSync(projectPath(root, file)))
      throw new Error(`Missing source test: ${file}`);
  });
  if (new Set(sourceTests).size !== sourceTests.length) throw new Error('Source tests contain duplicate files.');
  const toolingTests = [
    ...new Set(
      strings(plan.toolingTests, 'toolingTests')
        .flatMap((file) => filesUnder(root, file))
        .filter((file) => file.endsWith('.test.mjs')),
    ),
  ];
  if (!toolingTests.length) throw new Error('toolingTests resolved to no .test.mjs files.');
  strings(plan.criticalPaths, 'criticalPaths').forEach((file) => filesUnder(root, file));
  strings(plan.boundaries, 'boundaries');
  projectPath(root, plan.manualNotes);
  for (const key of ['screenshots', 'priorRuns']) {
    if (plan[key] !== undefined && !Array.isArray(plan[key])) throw new Error(`${key} must be an array.`);
    (plan[key] ?? []).forEach((file) => projectPath(root, file));
  }
  const checks = plan.checks ?? [];
  if (!Array.isArray(checks)) throw new Error('checks must be an array.');
  const names = new Set();
  for (const check of checks) {
    reviewName(check.name);
    if (names.has(check.name)) throw new Error(`Duplicate check: ${check.name}`);
    names.add(check.name);
    strings(check.command, 'check.command');
    if (check.command[0] !== 'node' || check.command.length < 2 || check.command.some((arg) => arg.includes('\0')))
      throw new Error('Additional checks use a Node executable and literal argument array.');
    const script = projectPath(root, check.command[1]);
    if (check.command[1].startsWith('-') || !existsSync(script) || !statSync(script).isFile())
      throw new Error('Additional checks must name an existing project Node script, without inline eval.');
    if (
      check.env !== undefined &&
      (typeof check.env !== 'object' ||
        check.env === null ||
        Array.isArray(check.env) ||
        Object.entries(check.env).some(
          ([key, value]) =>
            ['HOME', 'CODEX_HOME'].includes(key) || !/^[A-Z][A-Z0-9_]*$/.test(key) || typeof value !== 'string',
        ))
    )
      throw new Error('Check environment must contain string values and uppercase variable names.');
  }
  const url = new URL(plan.storybook?.url ?? 'http://127.0.0.1:6010');
  if (
    url.protocol !== 'http:' ||
    !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  )
    throw new Error('Storybook URL must be a loopback HTTP origin.');
  if (plan.build?.minify !== undefined && typeof plan.build.minify !== 'boolean')
    throw new Error('build.minify must be boolean.');
  return {
    ...plan,
    sourceTests,
    toolingTests,
    checks,
    url: url.origin,
    minify: plan.build?.minify ?? false,
    planFile: path.relative(root, file),
    planHash: sha256(file),
  };
}
export function snapshot(root, paths) {
  const files = [...new Set(paths.flatMap((file) => filesUnder(root, file)))].sort();
  return Object.fromEntries(files.map((file) => [file, sha256(projectPath(root, file))]));
}
export function criticalSnapshot(root, plan) {
  const mandatory = [
    'package.json',
    'pnpm-lock.yaml',
    '.storybook/main.ts',
    '.storybook/preview.tsx',
    plan.planFile,
  ].filter((file) => existsSync(projectPath(root, file)));
  return snapshot(root, [...plan.criticalPaths, ...plan.sourceTests, ...plan.toolingTests, ...mandatory]);
}
export function sameSnapshot(actual, expected, label) {
  if (JSON.stringify(actual) !== JSON.stringify(expected))
    throw new Error(`${label} changed; rerun the review before recording.`);
}
export function buildIdentity(root, plan) {
  const source = 'docs/design-system/ui-inventory.json';
  const built = 'storybook-static/ui-kit-docs/design-system/ui-inventory.json';
  const manifestHash = readJson(projectPath(root, source)).manifestHash;
  if (
    typeof manifestHash !== 'string' ||
    !manifestHash ||
    manifestHash !== readJson(projectPath(root, built)).manifestHash
  )
    throw new Error('Source/build inventory manifest mismatch. Regenerate and rebuild Storybook.');
  if (sha256(projectPath(root, source)) !== sha256(projectPath(root, built)))
    throw new Error('Source/build inventory contents differ. Rebuild Storybook.');
  const assets = filesUnder(root, 'storybook-static').filter(
    (file) => /\.(?:js|css|html|json)$/.test(file) && !file.startsWith('storybook-static/design-system-review/'),
  );
  if (!assets.includes('storybook-static/index.json') || !assets.includes('storybook-static/iframe.html'))
    throw new Error('Incomplete Storybook build.');
  return {
    environment: { UI_KIT_MINIFY: plan.minify ? '1' : '0', contracts: 'installed' },
    sourceManifestHash: manifestHash,
    sourceInventorySha256: sha256(projectPath(root, source)),
    builtInventorySha256: sha256(projectPath(root, built)),
    indexSha256: sha256(projectPath(root, 'storybook-static/index.json')),
    assets: snapshot(root, assets),
    critical: criticalSnapshot(root, plan),
  };
}
export function freshReport(file, step, report) {
  const started = Date.parse(step.startedAt);
  const finished = Date.parse(step.finishedAt);
  const modified = statSync(file).mtimeMs;
  if (
    !Number.isFinite(started) ||
    !Number.isFinite(finished) ||
    finished < started ||
    modified < started - 1000 ||
    modified > finished + 1000
  )
    throw new Error(`Stale report timing: ${step.name}.`);
  if (
    report &&
    (!Number.isFinite(report.startTime) || report.startTime < started - 1000 || report.startTime > finished + 1000)
  )
    throw new Error(`Stale report startTime: ${step.name}.`);
}
export function reportCounts(report, label) {
  if (
    !report ||
    report.success !== true ||
    report.wasInterrupted ||
    !Array.isArray(report.testResults) ||
    !report.testResults.length
  )
    throw new Error(`${label}: missing, incomplete or failing report.`);
  for (const key of [
    'numFailedTests',
    'numFailedTestSuites',
    'numRuntimeErrorTestSuites',
    'numPendingTests',
    'numPendingTestSuites',
    'numTodoTests',
  ])
    if (report[key] !== undefined && report[key] !== 0) throw new Error(`${label}: ${key} must be zero.`);
  const files = report.testResults;
  const assertions = files.flatMap((file) => file.assertionResults ?? []);
  if (
    new Set(files.map((file) => file.name)).size !== files.length ||
    files.some(
      (file) =>
        !file.name ||
        file.status !== 'passed' ||
        !Array.isArray(file.assertionResults) ||
        !file.assertionResults.length,
    ) ||
    assertions.some((item) => item.status !== 'passed')
  )
    throw new Error(`${label}: every file and assertion must pass, without skips or duplicate files.`);
  if (report.numTotalTests !== assertions.length || report.numPassedTests !== assertions.length)
    throw new Error(`${label}: assertion totals do not match the actual report entries.`);
  return { files: files.length, tests: assertions.length, passed: assertions.length, failed: 0, skipped: 0 };
}
export function sourceReport(report, expected, root) {
  const counts = reportCounts(report, 'Source tests');
  const actual = report.testResults.map((file) => path.relative(root, path.resolve(root, file.name))).sort();
  sameSnapshot(actual, [...expected].sort(), 'Source test coverage');
  return counts;
}
export function storyReport(report, index) {
  const counts = reportCounts(report, 'Storybook tests');
  const stories = Object.values(index.entries ?? {}).filter((entry) => entry.type === 'story');
  if (!stories.length) throw new Error('Storybook index has no stories.');
  const expected = stories.map((entry) => `${entry.title}\0${entry.name}`).sort();
  const actual = report.testResults
    .flatMap((file) => file.assertionResults.map((item) => `${item.ancestorTitles?.[0]}\0${item.ancestorTitles?.[1]}`))
    .sort();
  sameSnapshot(actual, expected, 'Full Storybook story coverage');
  return { ...counts, stories: counts.tests };
}
export function tapCounts(text) {
  const count = (key) => {
    const matches = [...text.matchAll(new RegExp(`^# ${key} (\\d+)\\s*$`, 'gm'))];
    if (matches.length !== 1) throw new Error(`Tooling TAP report is incomplete: ${key}.`);
    return Number(matches[0][1]);
  };
  const result = {
    tests: count('tests'),
    suites: count('suites'),
    passed: count('pass'),
    failed: count('fail'),
    skipped: count('skipped'),
    todo: count('todo'),
    cancelled: count('cancelled'),
  };
  if (
    !result.tests ||
    result.passed !== result.tests ||
    result.failed ||
    result.skipped ||
    result.todo ||
    result.cancelled ||
    /^Bail out!/m.test(text)
  )
    throw new Error('Tooling tests must complete and pass without skips.');
  return result;
}
