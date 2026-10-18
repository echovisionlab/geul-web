import { existsSync, readFileSync } from 'node:fs';
import { afterEach, expect, it, vi } from 'vitest';
import { geulFontStylesheets } from '../lib/styles/geul-fonts.generated';

vi.mock('node:fs', async (importOriginal) => ({
  ...(await importOriginal<typeof import('node:fs')>()),
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
}));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
  vi.clearAllMocks();
});

it.each([
  ['complete', true, true],
  ['absent', false, false],
  ['partial', false, false],
  ['stale', true, false],
] as const)('uses matching local fonts or the static host for %s artifacts', async (state, complete, useLocal) => {
  vi.stubEnv('LOCAL_CONTRACTS', '0');
  vi.stubEnv('PUBLIC_FONT_BASE_URL', 'https://static.example.test/fonts/');
  vi.mocked(existsSync).mockReturnValue(state !== 'absent');
  vi.mocked(readFileSync).mockReturnValue(
    JSON.stringify({
      complete,
      stylesheets: state === 'stale' ? { base: 'old.css' } : geulFontStylesheets,
    }),
  );
  const { default: config } = await import('./main');
  const head = await config.previewHead?.('');
  const base = useLocal ? '/fonts' : 'https://static.example.test/fonts';
  expect(head).toContain(`href="${base}/${geulFontStylesheets.latin}"`);
  expect(head).toContain(`data-font-base-url="${base}"`);
  if (useLocal) {
    expect(config.staticDirs).toContainEqual({ from: expect.stringContaining('/dist/fonts/'), to: '/fonts' });
  } else {
    expect(config.staticDirs).not.toContainEqual(expect.objectContaining({ to: '/fonts' }));
  }
});
