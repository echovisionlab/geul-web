import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  collectFrameworkSources,
  createFrameworkResolver,
  scanFrameworkOwnership,
  transitionalFrameworkOwners,
} from './framework-policy.mjs';
const root = fileURLToPath(new URL('../../', import.meta.url)),
  files = collectFrameworkSources(root),
  resolver = createFrameworkResolver(root);
const findings = files.flatMap((file) =>
  scanFrameworkOwnership(file, fs.readFileSync(new URL('../../' + file, import.meta.url), 'utf8'), { root, resolver }),
);
for (const f of findings)
  console[f.severity === 'error' ? 'error' : 'warn'](`${f.file}:${f.line}:${f.column} [${f.kind}] ${f.summary}`);
const errors = findings.filter((f) => f.severity === 'error').length;
console.log(
  `Framework ownership: ${files.length} production sources; ${errors} errors, ${findings.length - errors} unresolved forwarding warnings; ${transitionalFrameworkOwners.size} explicit transitional hosts. No violation baseline.`,
);
process.exitCode = errors ? 1 : 0;
