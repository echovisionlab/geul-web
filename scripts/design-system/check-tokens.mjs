#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import prettier from 'prettier';
import {
  authoredColorFiles,
  authoredTypographyFiles,
  legacyDefinitionFiles,
  tokenDefinitionFiles,
} from './token-policy.mjs';
import { baselineFrom, compareBaseline, scanRepository } from './token-scanner.mjs';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
const baselinePath = path.join(repoRoot, 'scripts/design-system/token-baseline.json');
const scan = scanRepository(repoRoot);
const args = new Set(process.argv.slice(2));
const baselineFile = fs.existsSync(baselinePath) ? JSON.parse(fs.readFileSync(baselinePath, 'utf8')) : { entries: {} };
if (args.has('--write-baseline')) {
  if (scan.findings.some((finding) => ['unknown-token', 'parse-error'].includes(finding.kind))) {
    console.error('Fix unknown token references and parse errors before recording a migration baseline.');
    process.exit(1);
  }
  fs.writeFileSync(
    baselinePath,
    `${JSON.stringify(
      {
        version: 1,
        description:
          'Reviewed existing migration debt. Do not regenerate to silence new violations. Counts are per file, kind, value and context, independent of line numbers.',
        entries: baselineFrom(scan.findings),
      },
      null,
      2,
    )}\n`,
  );
}
let baseline = args.has('--write-baseline') ? baselineFrom(scan.findings) : baselineFile.entries;
if (args.has('--prune-baseline')) {
  // Keep only occurrences already approved by the current baseline. Never widen it.
  baseline = baselineFrom(compareBaseline(scan.findings, baseline).existing);
  fs.writeFileSync(baselinePath, `${JSON.stringify({ ...baselineFile, entries: baseline }, null, 2)}\n`);
}
const { added, existing, stale } = compareBaseline(scan.findings, baseline);

if (args.has('--report')) {
  const countBy = (values, getKey) => {
    const counts = new Map();
    for (const value of values) {
      const key = getKey(value);
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  };
  const authoredPalette = scan.findings.filter(
    (finding) =>
      finding.kind === 'raw-color' &&
      legacyDefinitionFiles.has(finding.file) &&
      finding.context.startsWith('--editor-'),
  );
  const raw = scan.findings.filter((finding) => finding.kind === 'raw-color' && !authoredPalette.includes(finding));
  const centralizedAuthoredColors = scan.knownTokens.filter((name) => /^--editor-/.test(name)).length;
  const spacing = scan.findings.filter((finding) => ['raw-spacing', 'raw-font-size'].includes(finding.kind));
  const custom = scan.findings.filter((finding) => finding.kind === 'custom-token');
  const rawRows = countBy(raw, (finding) => finding.file).map(([file, count]) => {
    const lines = [...new Set(raw.filter((finding) => finding.file === file).map((finding) => finding.line))];
    return `| \`${file}\` | ${count} | ${lines.join(', ')} |`;
  });
  const spacingRows = countBy(spacing, (finding) => finding.file).map(([file, count]) => `| \`${file}\` | ${count} |`);
  const dimensions = countBy(scan.dimensions, (item) => item.value)
    .map(([value, count]) => `| \`${value}\` | ${count} |`)
    .slice(0, 25);
  const declarationGroups = new Map();
  for (const decl of scan.declarations) {
    if (!declarationGroups.has(decl.name)) declarationGroups.set(decl.name, []);
    declarationGroups.get(decl.name).push(decl);
  }
  const repeated = [...declarationGroups].filter(([, declarations]) => declarations.length > 1);
  const repeatedRows = repeated.map(
    ([name, declarations]) =>
      `| \`${name}\` | ${declarations.length} | ${[...new Set(declarations.map((decl) => `\`${decl.file}\``))].join(', ')} |`,
  );
  const report = `# Design token audit

This report is generated from production source by \`node scripts/design-system/check-tokens.mjs --report\`. Regenerate after source changes. Current source findings do not certify every visual state.

## Current measured scope

- ${scan.files.length} production CSS/TS/TSX files scanned under app, components, features and lib, plus the central theme.ts.
- ${scan.knownTokens.length} known semantic and font tokens in shared CSS definition files.
- ${raw.length} remaining interface/runtime literal color occurrences in ${new Set(raw.map((finding) => finding.file)).size} files, excluding central definitions and the authored-color exceptions below.
- ${authoredPalette.length} remaining authored editor palette literals in legacy variables.css. Their exact document colors belong to the shared authored palette source.
- ${centralizedAuthoredColors} authored editor color definitions are owned by the shared token source and generated into the same durable document roles.
- ${spacing.length} existing literal CSS spacing/typography occurrences covered by the migration baseline.
- ${custom.length} existing custom-property declarations/inline assignments outside central files (private \`--_*\` implementation variables are permitted).
- ${scan.dimensions.length} literal CSS dimension occurrences in spacing, typography and geometry properties; ${new Set(scan.dimensions.map((item) => item.value)).size} distinct values. These are audit findings, not blanket errors: canvas dimensions, geometry and responsive layouts require context.
- ${scan.declarations.length} CSS custom-property declarations, ${declarationGroups.size} distinct names, ${repeated.length} names declared more than once. Theme/state/media overrides are expected; equal values alone do not establish semantic duplication.
- ${existing.length} findings match the reviewed migration baseline; ${added.length} new violations; ${stale.length} obsolete baseline keys eligible for removal.

## Enforcement contract

Run \`node scripts/design-system/check-tokens.mjs\` (or \`pnpm design-system:check\`) in CI. New literal colors, CSS spacing/typography values and non-private custom-property definitions fail relative to an occurrence-count baseline. Adding another occurrence of an old color fails. Editing a literal color or spacing value in place also fails. Line movement does not change approval. Existing custom properties may change initializer to migrate to a semantic token; their file/name/occurrence count stays constrained. Unknown semantic/font variable references or literal-name runtime CSS setters and parse errors always fail and cannot be baselined. Missing baseline data fails closed.

Allowed central definition files:

${[...tokenDefinitionFiles].map((file) => `- \`${file}\``).join('\n')}

Legacy definition files (existing definitions constrained by the baseline; new declarations are forbidden):

${[...legacyDefinitionFiles].map((file) => `- \`${file}\``).join('\n')}

Legacy \`variables.css\` now consumes shared roles; its authored palettes, safe-area aliases and compatibility token definitions have been migrated. New design tokens belong in the TypeScript token source and its generated CSS. Private local variables use the \`--_\` prefix; they may compose semantic tokens for hover, selected and size states. Mantine \`--mantine-*\` overrides are upstream framework token assignments, not application token definitions. Runtime CSS setters may update registered semantic tokens or upstream/private variables; other literal names require an existing baseline allowance. The theme bridge may reference canonical tokens but cannot define another literal palette. The checker does not treat Mantine named palette props as literal colors because those are library token references.

\`--write-baseline\` is an explicit migration-maintenance operation. Review its diff; never run it as part of CI or to approve a new violation automatically. Existing debt is visible below. Removed debt is reported as stale and does not block migration; use \`--prune-baseline --report\` to remove only obsolete occurrences after review. Pruning cannot approve new findings.

## Remaining literal colors

| Source | Occurrences | Lines |
| --- | ---: | --- |
${rawRows.join('\n') || '| None | 0 | — |'}

## Remaining CSS spacing/typography literals

New nonzero px/rem/em values on padding, margin, gap, row-gap and column-gap fail (\`raw-spacing\`); zero, percentages, inherit, auto and token expressions are allowed, and spacing within explicit print media and page rules is classified as authored print geometry. Type sizes are stricter (\`raw-font-size\`): any literal unit (px, rem, em, pt, %, viewport units), font-size keywords and unitless line-height in \`font-size\`, \`line-height\` and \`font\` fail on screen and in print rules, because the token generator projects the paper scale onto the same roles. TS style objects, option objects, DOM style and canvas \`font\` assignments and \`setProperty('font-size', …)\` are checked the same way. Widths, heights, radii, viewport geometry and responsive breakpoints remain audit-only. Mantine named scale props in TS/TSX remain valid references. Initial spacing allowances were measured from git HEAD before this migration rather than approving the changed working tree.

| Source | Occurrences |
| --- | ---: |
${spacingRows.join('\n')}

Authored typography exceptions (artwork, not interface roles):

${[...authoredTypographyFiles].map(([file, reason]) => `- \`${file}\`: ${reason}`).join('\n')}

## Most repeated literal CSS dimensions

| Literal | Occurrences |
| --- | ---: |
${dimensions.join('\n')}

## Repeated custom-property names

| Name | Declarations | Files |
| --- | ---: | --- |
${repeatedRows.join('\n')}

## Authored-color exceptions

These sources contain provider identity colors or persisted/output artwork values. Their literal values remain separate from interface role tokens. Exceptions cover literal colors only; new custom-property declarations and unknown semantic references are still checked.

| Source | Reason |
| --- | --- |
${[...authoredColorFiles].map(([file, reason]) => `| \`${file}\` | ${reason} |`).join('\n')}

## Limits and interpretation

CSS uses a real PostCSS parser and TS/TSX uses the TypeScript compiler parser, so comments and regular expressions do not create false color findings. TS string values (including embedded HTML and templates) are inspected conservatively; persisted color defaults and graphic runtime strings outside explicit exception files may be baseline debt rather than interface styling. The audit does not infer intent from a matching color.

Generated/vendor sources, documentation, Storybook output, story fixtures, stories, tests, type declarations and fixtures are excluded. CSS selector/data-attribute custom-property references not expressed as semantic/font \`var()\` references, computed concatenated token names, dynamic numeric JS style values, user-uploaded styles and third-party runtime CSS are not validated. Literal CSS dimensions are counted only on the properties listed by the scanner. CSS spacing enforcement covers the explicit properties above; JavaScript numeric spacing props, private variable values and dynamically composed styles are not covered. Repeated declarations usually mean light/dark or state overrides; review their role and cascade before consolidating them.
`;
  const reportPath = path.join(repoRoot, 'docs/design-system/token-audit.md');
  const formatting = await prettier.resolveConfig(reportPath);
  fs.writeFileSync(reportPath, await prettier.format(report, { ...formatting, parser: 'markdown' }));
}
if (args.has('--json'))
  console.log(JSON.stringify({ ...scan, added, existingCount: existing.length, staleCount: stale.length }, null, 2));
else {
  for (const finding of added)
    console.error(`${finding.file}:${finding.line}:${finding.column} ${finding.kind}: ${finding.value}`);
  console.log(
    `Design tokens: ${scan.files.length} files, ${scan.knownTokens.length} registered tokens, ${existing.length} reviewed debt occurrences, ${added.length} new violations, ${stale.length} stale baseline keys.`,
  );
}
if (added.length) process.exitCode = 1;
