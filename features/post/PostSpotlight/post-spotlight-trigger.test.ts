// @vitest-environment jsdom

import { expect, it, vi } from 'vitest';

const chunk = vi.hoisted(() => {
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { pending, release };
});

vi.mock('./PostSpotlight', async () => {
  await chunk.pending;
  return { PostSpotlight: () => null };
});

import {
  consumePostSpotlightOpen,
  hasPendingPostSpotlightOpen,
  openPostSpotlight,
  postSpotlightPalette,
} from './post-spotlight-trigger';

it('keeps the launch pending until the palette chunk is ready and retains the queued open request', async () => {
  const readiness = openPostSpotlight();
  expect(hasPendingPostSpotlightOpen()).toBe(true);

  const first = Promise.race([readiness.then(() => 'palette ready'), chunk.pending.then(() => 'chunk released')]);
  chunk.release();
  await expect(first).resolves.toBe('chunk released');
  await readiness;

  expect(postSpotlightPalette.peek()?.PostSpotlight).toBeTypeOf('function');
  expect(consumePostSpotlightOpen()).toBe(true);
  expect(hasPendingPostSpotlightOpen()).toBe(false);
});
