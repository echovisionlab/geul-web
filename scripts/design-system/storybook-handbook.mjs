import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import prettier from 'prettier';

const root = fileURLToPath(new URL('../../', import.meta.url));
const target = 'stories/design-system/handbook.generated.json';
const paths = [
  'docs/design-system.md',
  'docs/ui-kit.md',
  ...readdirSync(path.join(root, 'docs/design-system'))
    .filter((name) => name.endsWith('.md'))
    .sort()
    .map((name) => `docs/design-system/${name}`),
];
const documents = paths.map((file) => {
  const markdown = readFileSync(path.join(root, file), 'utf8');
  const title = markdown.match(/^#\s+(.+)$/m)?.[1] ?? path.basename(file, '.md');
  return {
    path: file,
    title,
    language: /[가-힣]/.test(title) ? 'ko' : 'en',
    sha256: createHash('sha256').update(markdown).digest('hex'),
    markdown,
  };
});
const output = await prettier.format(JSON.stringify({ schemaVersion: 1, documents }), {
  ...(await prettier.resolveConfig(path.join(root, '.prettierrc.json'))),
  parser: 'json',
});
if (process.argv.includes('--check')) {
  if (!existsSync(path.join(root, target)) || readFileSync(path.join(root, target), 'utf8') !== output) {
    console.error('Storybook handbook is stale. Run design-system:generate.');
    process.exitCode = 1;
  } else console.log(`Storybook handbook passed: ${documents.length} source-backed documents.`);
} else {
  writeFileSync(path.join(root, target), output);
  console.log(`Storybook handbook generated: ${documents.length} source-backed documents.`);
}
