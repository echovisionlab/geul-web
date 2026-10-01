// @vitest-environment jsdom

import { act, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import type { BlockRoomRecoverySnapshot } from '@/lib/collab/block-room-recovery';
import type { PostRecoveryDraft } from './post-recovery-download';
import { usePostRecoveryDraft } from './usePostRecoveryDraft';

const container = document.createElement('div');
document.body.appendChild(container);
let root = createRoot(container);
let recovery: PostRecoveryDraft | undefined;
let edit: (draft: PostRecoveryDraft) => void;

const layout: PostRecoveryDraft['layout'] = { contentHeight: 'viewport', pageChrome: 'pinned', footer: 'flow' };

function Harness({ snapshot, canonicalTitle }: { snapshot: BlockRoomRecoverySnapshot | null; canonicalTitle: string }) {
  const [draft, setDraft] = useState<PostRecoveryDraft>({
    title: canonicalTitle,
    summary: 'Local summary',
    commentsEnabled: false,
    mapPlaceId: 'place-local',
    layout,
  });
  edit = setDraft;
  recovery = usePostRecoveryDraft(snapshot, draft);
  useEffect(() => {
    setDraft({
      title: canonicalTitle,
      summary: 'Canonical summary',
      commentsEnabled: true,
      mapPlaceId: 'place-canonical',
      layout: { contentHeight: 'content', pageChrome: 'flow', footer: 'flow' },
    });
  }, [canonicalTitle]);
  return null;
}

afterEach(() => {
  act(() => root.unmount());
  root = createRoot(container);
  recovery = undefined;
});

describe('Post recovery form fields', () => {
  it('captures local title, summary, and configuration before canonical values replace them', () => {
    const snapshot = { capturedAt: 1000 } as BlockRoomRecoverySnapshot;
    act(() => root.render(<Harness snapshot={null} canonicalTitle="Saved title" />));
    act(() =>
      edit({
        title: 'Local title before reconnect',
        summary: 'Local summary before reconnect',
        commentsEnabled: false,
        mapPlaceId: 'place-pending',
        layout,
      }),
    );
    act(() => root.render(<Harness snapshot={snapshot} canonicalTitle="New canonical title" />));

    expect(recovery).toEqual({
      title: 'Local title before reconnect',
      summary: 'Local summary before reconnect',
      commentsEnabled: false,
      mapPlaceId: 'place-pending',
      layout,
    });
  });
});
