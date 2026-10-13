import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  collectLayoutSources,
  createLayoutResolver,
  scanLayoutOwnership,
  strictLayoutConsumers,
} from './layout-policy.mjs';
const root = fileURLToPath(new URL('../../', import.meta.url));
const files = collectLayoutSources(root);
const resolver = createLayoutResolver(root);
const findings = files.flatMap((file) =>
  scanLayoutOwnership(file, fs.readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8'), { root, resolver }),
);
for (const finding of findings)
  console[finding.severity === 'error' ? 'error' : 'warn'](
    `${finding.file}:${finding.line}:${finding.column} [${finding.kind}] ${finding.summary}`,
  );
const errors = findings.filter((finding) => finding.severity === 'error').length;
console.log(
  `Layout ownership: ${files.length} production files screened, ${strictLayoutConsumers.size} strict consumers, ${errors} errors, ${findings.length - errors} unresolved spread warnings. No baseline. Dynamic spreads require closed types/runtime projection; arbitrary computed aliases and external selectors are not fully resolved.`,
);
process.exitCode = errors ? 1 : 0;
