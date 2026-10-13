import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { collectLayoutSources } from './layout-policy.mjs';
import { scanActionUsage } from './action-policy.mjs';
const root = fileURLToPath(new URL('../../', import.meta.url));
const files = collectLayoutSources(root);
const findings = files.flatMap((file) => scanActionUsage(file, fs.readFileSync(root + file, 'utf8')));
for (const finding of findings) console.error(`${finding.file}:${finding.line} [${finding.kind}] ${finding.summary}`);
console.log(
  `Action usage: ${files.length} production sources, ${findings.length} explicit selection/opening emphasis violations. Callbacks and spreads still require contextual review. No baseline.`,
);
process.exitCode = findings.length ? 1 : 0;
