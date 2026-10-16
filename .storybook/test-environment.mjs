import { mkdir, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { setupPage } from '@storybook/test-runner';
import PlaywrightEnvironment from '@storybook/test-runner/dist/jest-playwright-entries/test-environment.js';

/** Every story owns its browser storage, globals, timers, mocks, workers, and page. */
export default class StorybookEnvironment extends PlaywrightEnvironment {
  constructor(config, context) {
    super(config, context);
    this.testPath = context.testPath;
    this.started = false;
    this.blockedRequests = [];
  }

  async prepareStoryContext() {
    this.contextId = randomUUID();
    this.blockedRequests = [];
    if (process.env.STORYBOOK_ISOLATED_CI === 'true') {
      const origin = new URL(process.env.TARGET_URL).origin;
      await this.global.context.route('**/*', async (route) => {
        const url = new URL(route.request().url());
        if (['http:', 'https:'].includes(url.protocol) && url.origin !== origin) {
          this.blockedRequests.push(`${route.request().method()} ${url.origin}${url.pathname}`);
          await route.abort('blockedbyclient');
        } else {
          await route.continue();
        }
      });
    }
    await setupPage(this.global.page, this.global.context);
    await this.global.page.evaluate((contextId) => {
      const key = 'geul.storybook.test-context';
      if (localStorage.getItem(key) || sessionStorage.getItem(key)) {
        throw new Error('Story inherited storage from an earlier browser test');
      }
      localStorage.setItem(key, contextId);
      sessionStorage.setItem(key, contextId);
    }, this.contextId);
  }

  async setup() {
    await super.setup();
    try {
      await this.prepareStoryContext();
    } catch (error) {
      await this.global.context?.close();
      throw error;
    }
  }

  async handleTestEvent(event, state) {
    await super.handleTestEvent(event, state);
    if (event.name === 'test_start') {
      if (this.started) {
        // Legacy test-storybook groups several stories in one file. Recreate
        // the context too, rather than merely clearing a reused page's DOM.
        await this.global.jestPlaywright.resetContext();
        try {
          await this.prepareStoryContext();
        } catch (error) {
          await this.global.context?.close();
          throw error;
        }
      }
      this.started = true;
    }
    if (event.name === 'test_done') {
      const output = process.env.STORYBOOK_TEST_RESULT_DIR;
      try {
        if (output && event.test.errors.length) {
          await mkdir(output, { recursive: true });
          await this.global.page.screenshot({ path: join(output, `${basename(this.testPath)}.png`) });
        }
      } finally {
        await this.global.context?.close();
      }
      if (output) {
        await mkdir(output, { recursive: true });
        await writeFile(
          join(output, `${basename(this.testPath)}.json`),
          JSON.stringify({
            testFile: basename(this.testPath),
            workerId: process.env.JEST_WORKER_ID,
            contextId: this.contextId,
            closed: true,
            storageWasEmpty: true,
            failed: event.test.errors.length > 0,
            blockedRequests: this.blockedRequests,
          }),
        );
      }
      if (this.blockedRequests.length) {
        throw new Error(`Story contacted a service outside its fixture: ${this.blockedRequests.join(', ')}`);
      }
    }
  }

  async teardown() {
    try {
      await this.global.context?.close();
    } finally {
      await super.teardown();
    }
  }
}
