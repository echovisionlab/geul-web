import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { collectLayoutSources } from './layout-policy.mjs';
import { scanAffordancePlacement } from './affordance-policy.mjs';
const root = fileURLToPath(new URL('../../', import.meta.url));
const files = collectLayoutSources(root);
const findings = files.flatMap((file) =>
  scanAffordancePlacement(file, fs.readFileSync(new URL('../../' + file, import.meta.url), 'utf8')),
);
for (const f of findings) console.error(`${f.file}:${f.line}:${f.column} [${f.kind}] ${f.summary}`);
console.log(
  `Affordance placement: ${files.length} production sources, ${findings.length} explicit slot/order violations. Dynamic compositions require visual review. No baseline.`,
);
process.exitCode = findings.length ? 1 : 0;
