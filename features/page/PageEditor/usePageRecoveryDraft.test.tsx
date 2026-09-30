// @vitest-environment jsdom

import { act, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import type { BlockRoomRecoverySnapshot } from '@/lib/collab/block-room-recovery';
import type { PageRecoveryDraft } from './page-recovery-download';
import { usePageRecoveryDraft } from './usePageRecoveryDraft';

const container = document.createElement('div');
document.body.appendChild(container);
let root = createRoot(container);
let recovery: PageRecoveryDraft | undefined;
let edit: (title: string) => void;

function Harness({ snapshot, canonicalTitle }: { snapshot: BlockRoomRecoverySnapshot | null; canonicalTitle: string }) {
  const [title, setTitle] = useState(canonicalTitle);
  edit = setTitle;
  recovery = usePageRecoveryDraft(snapshot, {
    title,
    summary: 'Local summary',
    layout: { contentHeight: 'viewport', pageChrome: 'flow', footer: 'flow' },
  });
  useEffect(() => setTitle(canonicalTitle), [canonicalTitle]);
  return null;
}
afterEach(() => {
  act(() => root.unmount());
  root = createRoot(container);
});

describe('Page recovery form fields', () => {
  it('captures local form values before canonical bootstrap resets and keeps them with the matching copy', () => {
    const snapshot = { capturedAt: 1000 } as BlockRoomRecoverySnapshot;
    act(() => root.render(<Harness snapshot={null} canonicalTitle="Saved title" />));
    act(() => edit('Local title before reconnect'));
    act(() => root.render(<Harness snapshot={snapshot} canonicalTitle="New canonical title" />));
    expect(recovery?.title).toBe('Local title before reconnect');
    expect(recovery?.summary).toBe('Local summary');
    expect(recovery?.layout.contentHeight).toBe('viewport');
    act(() => edit('New edit in the fresh room'));
    expect(recovery?.title).toBe('Local title before reconnect');
    act(() =>
      root.render(<Harness snapshot={{ ...snapshot, capturedAt: 2000 }} canonicalTitle="Newest canonical title" />),
    );
    expect(recovery?.title).toBe('New edit in the fresh room');
    act(() => root.render(<Harness snapshot={null} canonicalTitle="Another locale title" />));
    expect(recovery).toBeUndefined();
  });
});
