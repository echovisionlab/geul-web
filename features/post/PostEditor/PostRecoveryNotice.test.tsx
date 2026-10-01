// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MantineProvider } from '@mantine/core';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { BlockRoomRecoverySnapshot } from '@/lib/collab/block-room-recovery';
import { downloadPostRecoverySnapshot } from './post-recovery-download';
import { PostRecoveryNotice } from './PostRecoveryNotice';

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
vi.mock('./post-recovery-download', () => ({ downloadPostRecoverySnapshot: vi.fn() }));

let root: Root;
let container: HTMLDivElement;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.clearAllMocks();
});

it('shows the recoverable copy and exports only the supplied room snapshot', () => {
  const snapshot = { documentType: 'post', entityId: 'post-1', locale: 'ko' } as BlockRoomRecoverySnapshot;
  const draft = {
    title: 'Local title',
    summary: 'Local summary',
    commentsEnabled: false,
    mapPlaceId: null,
    layout: { contentHeight: 'content', pageChrome: 'flow', footer: 'flow' } as const,
  };

  act(() =>
    root.render(
      <MantineProvider>
        <PostRecoveryNotice snapshot={snapshot} draft={draft} />
      </MantineProvider>,
    ),
  );

  expect(container.querySelector('[role="status"]')?.textContent).toContain('message');
  const action = container.querySelector('button');
  expect(action?.textContent).toContain('action');
  act(() => action?.click());
  expect(downloadPostRecoverySnapshot).toHaveBeenCalledExactlyOnceWith(snapshot, draft);
});
