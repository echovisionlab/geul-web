import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { equivalenceCases } from './equivalence-cases';

// Outcomes recorded from the classic `zod` schemas before the `zod/mini` migration.
// Regenerate only for an intentional behavior change, then format it with Prettier:
// ZOD_EQUIVALENCE_RECORD=1 pnpm vitest run lib/zod-mini
const goldenPath = join(__dirname, 'equivalence.golden.json');
const record = process.env.ZOD_EQUIVALENCE_RECORD === '1';

type Golden = Record<string, unknown[]>;

function runAll(): Golden {
  const outcomes: Golden = {};
  for (const testCase of equivalenceCases) {
    if (Object.hasOwn(outcomes, testCase.id)) {
      throw new Error(`Duplicate equivalence case id: ${testCase.id}`);
    }
    outcomes[testCase.id] = testCase.inputs.map((input) => testCase.run(input));
  }
  return outcomes;
}

describe('client validation equivalence with the classic zod schemas', () => {
  let outcomes: Golden;

  const timeZone = process.env.TZ;

  beforeAll(() => {
    // Date validators compare against local "today"; pin the clock and the time zone.
    process.env.TZ = 'UTC';
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-06-15T12:00:00.000Z'));
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    outcomes = runAll();
    if (record) {
      writeFileSync(goldenPath, `${JSON.stringify(outcomes, null, 2)}\n`);
    }
  });

  afterAll(() => {
    if (timeZone === undefined) {
      delete process.env.TZ;
    } else {
      process.env.TZ = timeZone;
    }
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const golden: Golden = JSON.parse(readFileSync(goldenPath, 'utf8'));

  it('covers the same cases as the recorded outcomes', () => {
    expect(Object.keys(outcomes).sort()).toEqual(Object.keys(golden).sort());
  });

  it.each(equivalenceCases.map((testCase) => [testCase.id]))('%s', (id) => {
    expect(outcomes[id]).toEqual(golden[id]);
  });
});
