// @vitest-environment jsdom

import { MantineProvider } from '@mantine/core';
import { fromJson } from '@bufbuild/protobuf';
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { contentBlockCatalogFingerprint } from '@echovisionlab/geul-proto/content/block_catalog.ts';
import {
  LocalizedRichTextDocumentSchema,
  RichTextProfile,
} from '@echovisionlab/geul-proto/content/block_content_pb.ts';
import { hydrateCanonicalBlockRoom } from '@echovisionlab/geul-common/collaboration/block-room-codec';
import * as Y from 'yjs';
import { createBlockRoomDocumentName, type BlockRoomBootstrap } from '@/lib/collab/block-room-bootstrap';
import { createBlockRoomRecoverySnapshot } from '@/lib/collab/block-room-recovery';
import {
  downloadPostConfigRecoveryCopy,
  PostConfigConflictRecoveryNotice,
  serializePostConfigRecoveryCopy,
} from './PostConfigConflictRecoveryNotice';
import { EditorReloadRequiredDialog } from '@/features/editor/EditorReloadRequiredDialog';

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
vi.mock('@/components/core', () => ({
  BlockingAlertDialog: ({
    opened,
    onAction,
    title,
    message,
    actionLabel,
  }: {
    opened: boolean;
    onAction: () => void;
    title: string;
    message: ReactNode;
    actionLabel: string;
  }) =>
    opened ? (
      <section>
        <h1>{title}</h1>
        {message}
        <button data-testid="reload" onClick={onAction} type="button">
          {actionLabel}
        </button>
      </section>
    ) : null,
}));

const copy = {
  postId: '11111111-1111-4111-8111-111111111111',
  expectedConfigurationRevision: '10000000-0000-4000-8000-000000000001',
  patch: { commentsEnabled: false, slug: 'local-slug' },
};
const otherPostId = '22222222-2222-4222-8222-222222222222';

function createRecoverySnapshot(admitted = true, postId = copy.postId) {
  const canonicalDocument = fromJson(LocalizedRichTextDocumentSchema, {
    blockCatalogFingerprint: contentBlockCatalogFingerprint,
    profile: RichTextProfile.POST,
    locale: 'en',
    base: {
      nodes: [
        {
          block: { id: '33333333-3333-4333-8333-333333333333', paragraph: { props: {} } },
          placement: { index: 0 },
        },
      ],
    },
    localeOverlay: {
      locale: 'en',
      blocks: [
        {
          blockId: '33333333-3333-4333-8333-333333333333',
          paragraph: { props: {}, content: [{ text: { text: 'Local body' } }] },
        },
      ],
    },
  });
  const document = new Y.Doc();
  hydrateCanonicalBlockRoom(document, 'post', 'en', canonicalDocument, []);
  const bootstrap: BlockRoomBootstrap = {
    documentType: 'post',
    documentName: createBlockRoomDocumentName('post', postId, 'en'),
    document: canonicalDocument,
    documentRevision: 'saved-revision',
    sourceLocale: 'en',
    locale: 'en',
    localeExists: true,
    presentLocaleValues: [],
    sourceMetadata: { locale: 'en', title: 'Saved title', summary: 'Saved summary' },
    localeMetadata: { locale: 'en', title: 'Saved title', summary: 'Saved summary' },
    blockCatalogFingerprint: contentBlockCatalogFingerprint,
    serverInstanceId: 'collab-1',
    roomEpoch: '44444444-4444-4444-8444-444444444444',
    bootstrapChallenge: 'challenge-1',
    yjsBootstrapUpdate: Y.encodeStateAsUpdate(document),
  };
  const snapshot = createBlockRoomRecoverySnapshot({
    documentType: 'post',
    entityId: postId,
    locale: 'en',
    admitted,
    bootstrap,
    yjsUpdate: Y.encodeStateAsUpdate(document),
    capturedAt: 1000,
  });
  document.destroy();
  return snapshot;
}

let root: Root;
let container: HTMLDivElement;

function Harness({ onReload }: { onReload: () => void }) {
  return (
    <MantineProvider>
      <EditorReloadRequiredDialog
        opened
        onReload={onReload}
        recoveryAction={<PostConfigConflictRecoveryNotice copy={copy} />}
      />
    </MantineProvider>
  );
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('Post configuration conflict recovery', () => {
  it('exports the resident revision and latest local patch in the recovery copy', () => {
    expect(JSON.parse(serializePostConfigRecoveryCopy(copy))).toEqual({
      version: 1,
      kind: 'post-configuration-recovery',
      ...copy,
    });
  });

  it('includes the admitted Post document and frozen local metadata in the recovery JSON', () => {
    const snapshot = createRecoverySnapshot();
    expect(snapshot).not.toBeNull();
    const serialized = serializePostConfigRecoveryCopy({
      ...copy,
      documentRecovery: {
        snapshot: snapshot!,
        draft: {
          title: 'Local title',
          summary: 'Local summary',
          commentsEnabled: false,
          mapPlaceId: 'place-1',
          layout: { contentHeight: 'viewport', pageChrome: 'pinned', footer: 'flow' },
        },
      },
    });
    const recovery = JSON.parse(serialized).documentRecovery;

    expect(recovery).toMatchObject({
      format: 'geul-post-recovery-v1',
      postId: copy.postId,
      locale: 'en',
      localMetadata: {
        title: 'Local title',
        summary: 'Local summary',
        commentsEnabled: false,
        mapPlaceId: 'place-1',
        layout: { contentHeight: 'viewport', pageChrome: 'pinned', footer: 'flow' },
      },
    });
    expect(JSON.stringify(recovery.localDocument)).toContain('Local body');
    expect(recovery.yjsUpdate.length).toBeGreaterThan(0);
  });

  it('omits an unadmitted room and rejects a recovery snapshot for another Post', () => {
    const unadmitted = createRecoverySnapshot(false);
    expect(unadmitted).toBeNull();

    const otherPost = createRecoverySnapshot(true, otherPostId);
    expect(otherPost).not.toBeNull();
    expect(() =>
      serializePostConfigRecoveryCopy({
        ...copy,
        documentRecovery: { snapshot: otherPost!, draft: undefined },
      }),
    ).toThrow('Post configuration recovery cannot include another Post document.');
  });

  it('evaluates optional room recovery at download time and omits unadmitted state', async () => {
    let downloadedBlob: Blob | null = null;
    const NativeURL = URL;
    vi.stubGlobal(
      'URL',
      class extends NativeURL {
        static createObjectURL = vi.fn((blob: Blob) => {
          downloadedBlob = blob;
          return 'blob:post-config-recovery';
        });
        static revokeObjectURL = vi.fn();
      },
    );
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    const getDocumentRecovery = vi.fn(() => {
      const snapshot = createRecoverySnapshot(false);
      return snapshot ? { snapshot } : null;
    });

    downloadPostConfigRecoveryCopy(copy, getDocumentRecovery);

    expect(getDocumentRecovery).toHaveBeenCalledOnce();
    expect(downloadedBlob).not.toBeNull();
    expect(JSON.parse(await downloadedBlob!.text())).not.toHaveProperty('documentRecovery');
  });

  it('keeps the recovery copy and manual reload action available together', () => {
    const onReload = vi.fn();
    act(() => root.render(<Harness onReload={onReload} />));

    expect(container.textContent).toContain('message');
    expect(container.textContent).toContain('action');
    const reload = container.querySelector<HTMLButtonElement>('[data-testid="reload"]');
    expect(reload).not.toBeNull();
    act(() => reload?.click());
    expect(onReload).toHaveBeenCalledOnce();
  });
});
