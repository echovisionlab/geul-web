import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compareBaseline, readKnownTokens, scanSource } from '../scripts/design-system/token-scanner.mjs';
import {
  isProductionSource,
  fontDefinitionFiles,
  legacyDefinitionFiles,
  tokenDefinitionFiles,
} from '../scripts/design-system/token-policy.mjs';

const repoRoot = fileURLToPath(new URL('../', import.meta.url));
/** Refresh long-running editor lint sessions when the generated tokens or allowance changes. */
export function createPolicyReader(root) {
  const inputs = [
    'scripts/design-system/token-baseline.json',
    ...[...tokenDefinitionFiles, ...legacyDefinitionFiles, ...fontDefinitionFiles].filter((file) =>
      file.endsWith('.css'),
    ),
  ];
  let cache;
  return () => {
    const signature = inputs
      .map((file) => {
        try {
          const stat = fs.statSync(path.join(root, file));
          return `${stat.mtimeMs}:${stat.ctimeMs}:${stat.size}`;
        } catch (error) {
          if (error.code !== 'ENOENT') throw error;
          return 'missing';
        }
      })
      .join('|');
    if (!cache || cache.signature !== signature) {
      const baselineFile = path.join(root, inputs[0]);
      cache = {
        signature,
        baseline: fs.existsSync(baselineFile) ? JSON.parse(fs.readFileSync(baselineFile, 'utf8')).entries : {},
        tokens: readKnownTokens(root),
      };
    }
    return cache;
  };
}
const readPolicy = createPolicyReader(repoRoot);

export const designTokensRule = {
  meta: {
    type: 'problem',
    docs: { description: 'Require semantic design tokens for new interface colors and CSS variable definitions.' },
    schema: [],
    messages: {
      violation:
        '{{kind}}: {{value}}. Use a registered semantic design token; existing migration debt is tracked separately.',
    },
  },
  create(context) {
    const filename = path.relative(repoRoot, context.filename).replaceAll(path.sep, '/');
    if (!isProductionSource(filename)) return {};
    const { baseline, tokens } = readPolicy();
    return {
      Program() {
        const { findings } = scanSource(filename, context.sourceCode.text, tokens);
        const { added } = compareBaseline(findings, baseline);
        for (const finding of added)
          context.report({
            loc: { line: finding.line, column: finding.column - 1 },
            messageId: 'violation',
            data: { kind: finding.kind, value: finding.value },
          });
      },
    };
  },
};

export const designTokensPlugin = {
  meta: { name: 'geul-design-tokens', version: '1.0.0' },
  rules: { 'no-new-literals': designTokensRule },
};
