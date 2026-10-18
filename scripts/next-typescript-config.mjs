import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';

const portable = (path) => path.split(sep).join('/');

export function nextTypeScriptConfig({ rootDir, useLocalContracts = false, distDir }) {
  const defaultDistDir = useLocalContracts ? '.next-local-contracts' : '.next';
  const selectedDistDir = distDir || defaultDistDir;
  // Next joins distDir to the project root, including absolute DIST_DIR values.
  const outputDir = resolve(join(rootDir, selectedDistDir));
  const defaultConfig = useLocalContracts ? 'tsconfig.app.local-contracts.json' : 'tsconfig.app.json';
  if (outputDir === resolve(join(rootDir, defaultDistDir))) {
    return { distDir: selectedDistDir, tsconfigPath: defaultConfig };
  }

  // Next does not add generated type includes to configs with extends/references.
  const base = JSON.parse(readFileSync(join(rootDir, defaultConfig), 'utf8'));
  const outputKey = createHash('sha256').update(outputDir).digest('hex').slice(0, 16);
  const configPath = join(rootDir, '.cache/typescript', defaultConfig.replace('.json', `.${outputKey}.json`));
  const configDir = dirname(configPath);
  const fromConfig = (path) => portable(relative(configDir, resolve(rootDir, path)));
  const contents = `${JSON.stringify(
    {
      extends: fromConfig(defaultConfig),
      include: [
        ...base.include.filter((pattern) => pattern !== `${defaultDistDir}/types/**/*.ts`).map(fromConfig),
        portable(relative(configDir, join(outputDir, 'types/**/*.ts'))),
      ],
    },
    null,
    2,
  )}\n`;
  mkdirSync(configDir, { recursive: true });
  if (!existsSync(configPath) || readFileSync(configPath, 'utf8') !== contents) {
    writeFileSync(configPath, contents);
  }
  return { distDir: selectedDistDir, tsconfigPath: portable(relative(rootDir, configPath)) };
}
