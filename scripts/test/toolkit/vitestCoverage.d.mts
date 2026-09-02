import type { TestUserConfig } from 'vitest/config';

type VitestCoverage = NonNullable<TestUserConfig['coverage']>;

export interface VitestCoverageOptions {
  include: string[];
  exclude?: string[];
  html?: boolean;
  minStatements?: number;
}

export function defineVitestCoverage(options: VitestCoverageOptions): VitestCoverage;
