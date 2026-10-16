import { afterEach, vi } from 'vitest';

// Node logic tests must provide their own transport; never contact a service from the runner.
// Assign the baseline directly so unstubAllGlobals() restores this guard, not native fetch.
globalThis.fetch = () => Promise.reject(new Error('Unexpected network request: mock fetch in this test.'));

afterEach(() => {
  vi.unstubAllGlobals();
});
