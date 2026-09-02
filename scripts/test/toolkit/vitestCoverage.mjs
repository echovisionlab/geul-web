const defaultCoverageReporters = ['text', 'lcov', 'json-summary'];
const defaultMinStatementCoverage = 50;

const defaultCoverageExcludes = [
  '**/*.test.ts',
  '**/*.test.tsx',
  '**/*.stories.ts',
  '**/*.stories.tsx',
  'dist/**',
  'node_modules/**',
];

function resolveMinStatements(configuredMinStatements) {
  const rawValue = configuredMinStatements;
  const value = rawValue === undefined ? defaultMinStatementCoverage : Number(rawValue);

  if (!Number.isFinite(value) || value < 0 || value > 100) {
    throw new Error(`minStatements must be a number between 0 and 100, received ${rawValue}`);
  }

  return value;
}

export function defineVitestCoverage(options) {
  const minStatements = resolveMinStatements(options.minStatements);

  return {
    provider: 'v8',
    reporter: options.html ? [...defaultCoverageReporters, 'html'] : [...defaultCoverageReporters],
    include: options.include,
    exclude: [...defaultCoverageExcludes, ...(options.exclude ?? [])],
    thresholds: {
      statements: minStatements,
    },
  };
}
