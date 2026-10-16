// @geul-test-tier node-unit
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ prepare: vi.fn() }));
vi.mock('@storybook/test-runner', () => ({ setupPage: mocks.prepare }));
vi.mock('@storybook/test-runner/dist/jest-playwright-entries/test-environment.js', () => ({
  default: class {
    global = {
      context: { close: vi.fn(async () => {}), route: vi.fn(async () => {}) },
      page: { evaluate: vi.fn(async () => {}), screenshot: vi.fn(async () => {}) },
      jestPlaywright: { resetContext: vi.fn(async () => {}) },
    };
    async setup() {
      const freshContext = () => ({ close: vi.fn(async () => {}), route: vi.fn(async () => {}) });
      const freshPage = () => ({ evaluate: vi.fn(async () => {}), screenshot: vi.fn(async () => {}) });
      this.global.context = freshContext();
      this.global.page = freshPage();
      this.global.jestPlaywright = {
        resetContext: vi.fn(async () => {
          this.global.context = freshContext();
          this.global.page = freshPage();
        }),
      };
    }
    async handleTestEvent() {}
    async teardown() {}
  },
}));
import StorybookEnvironment from './test-environment.mjs';

interface EnvironmentProbe {
  global: { context: { close: () => Promise<void> }; page: object };
  setup: () => Promise<void>;
  teardown: () => Promise<void>;
  handleTestEvent: (event: { name: string; test?: { errors: unknown[] } }, state: object) => Promise<void>;
}

// The runner ships its environment declaration as `unknown`. Keep that
// untyped package boundary local while checking the probe's consumed surface.
const Environment = StorybookEnvironment as unknown as {
  new (config: object, context: { testPath: string }): EnvironmentProbe;
};

afterEach(() => {
  vi.unstubAllEnvs();
  mocks.prepare.mockReset();
});

function environment() {
  vi.stubEnv('STORYBOOK_ISOLATED_CI', 'false');
  vi.stubEnv('STORYBOOK_TEST_RESULT_DIR', '');
  return new Environment({}, { testPath: 'owned-story.test.js' });
}

describe('Storybook browser context ownership', () => {
  it('replaces context and page between stories and closes both successful and failed cases', async () => {
    const runner = environment();
    await runner.setup();
    const firstContext = runner.global.context;
    const firstPage = runner.global.page;
    try {
      await runner.handleTestEvent({ name: 'test_start' }, {});
      expect(mocks.prepare).toHaveBeenCalledTimes(1);
      await runner.handleTestEvent({ name: 'test_done', test: { errors: [] } }, {});
      expect(firstContext.close).toHaveBeenCalledOnce();

      await runner.handleTestEvent({ name: 'test_start' }, {});
      expect(runner.global.context).not.toBe(firstContext);
      expect(runner.global.page).not.toBe(firstPage);
      expect(mocks.prepare).toHaveBeenCalledTimes(2);
      await runner.handleTestEvent({ name: 'test_done', test: { errors: [new Error('play failed')] } }, {});
      expect(runner.global.context.close).toHaveBeenCalledOnce();
    } finally {
      await runner.teardown();
    }
  });

  it('closes the owning context when Storybook preparation fails before a test starts', async () => {
    const runner = environment();
    mocks.prepare.mockRejectedValueOnce(new Error('preview could not load'));
    try {
      await expect(runner.setup()).rejects.toThrow('preview could not load');
      expect(runner.global.context.close).toHaveBeenCalledOnce();
    } finally {
      await runner.teardown();
    }
  });
});
