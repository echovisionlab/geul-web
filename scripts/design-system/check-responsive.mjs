import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { listSourceFiles } from './token-scanner.mjs';
import { scanResponsiveOwnership } from './responsive-policy.mjs';
const root = fileURLToPath(new URL('../../', import.meta.url));
const files = listSourceFiles(root);
const findings = files.flatMap((file) =>
  scanResponsiveOwnership(file, fs.readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8')),
);
for (const finding of findings) console.error(`${finding.file}:${finding.line} [${finding.kind}] ${finding.summary}`);
console.log(
  `Responsive and size ownership: ${files.length} sources, ${findings.length} violations. No baseline. Computed query strings still require contextual review.`,
);
process.exitCode = findings.length ? 1 : 0;
