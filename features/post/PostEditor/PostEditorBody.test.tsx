// @vitest-environment jsdom

import { act, type ComponentProps, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { HocuspocusProvider } from '@hocuspocus/provider';
import { MantineProvider } from '@mantine/core';
import type { PostBlockRoomTiptapController } from '@/features/editor/tiptap/block-room-tiptap-controller';
import { getEditorBodyLoadingId, getEditorBodyReadyId } from '@/features/editor/lib/media-test-ids';
import { PostEditorBody } from './PostEditorBody';

const localizedEditorMock = vi.hoisted(() => vi.fn());

vi.mock('@/features/translation/ActiveEditLocaleContentPreview', () => ({
  ActiveEditLocaleContentPreview: ({ children }: { children?: ReactNode }) => (
    <div data-testid="locale-preview">{children}</div>
  ),
}));

vi.mock('@/features/translation/LocalizedRichTextFragmentEditor', () => ({
  LocalizedRichTextFragmentEditor: (props: Record<string, unknown>) => {
    localizedEditorMock(props);
    return <div data-testid="rich-text-editor" />;
  },
}));

vi.mock('@/features/site/PageLoader', () => ({
  PageLoader: () => <div data-testid="page-loader" />,
}));

const editorSession = {
  provider: {} as HocuspocusProvider,
  controller: {} as PostBlockRoomTiptapController,
};

const baseProps = {
  postId: 'post-1',
  userName: 'Editor',
  editable: true,
  showLabel: true,
  bodyLabel: 'Body',
  activeLocale: 'ko',
  activeLocaleLabel: '한국어',
  hasLiveRow: true,
  contentPreview: '',
  previewLoading: false,
  isSourceLocale: true,
};

let container: HTMLDivElement | null = null;
let root: Root | null = null;

async function render(bodyMode: ComponentProps<typeof PostEditorBody>['bodyMode'], withSession = true) {
  await act(async () => {
    root?.render(
      <MantineProvider>
        <PostEditorBody {...baseProps} bodyMode={bodyMode} session={withSession ? editorSession : null} />
      </MantineProvider>,
    );
    await Promise.resolve();
  });
}

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

beforeEach(() => {
  localizedEditorMock.mockReset();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
});

describe('PostEditorBody', () => {
  it('renders the selected locale editor only for a ready resident session', async () => {
    await render('locale-editor');
    expect(container?.querySelector(`#${getEditorBodyReadyId('post', 'post-1')}`)).not.toBeNull();
    expect(container?.querySelector('[data-testid="rich-text-editor"]')).not.toBeNull();

    await render('locale-editor', false);
    expect(container?.querySelector(`#${getEditorBodyLoadingId('post', 'post-1')}`)).not.toBeNull();
  });

  it('shows a missing target through the source room without exposing a mutation surface', async () => {
    await render('missing-target-fallback');
    expect(container?.querySelector('[data-testid="locale-preview"]')).not.toBeNull();
    expect(container?.querySelector('[data-testid="rich-text-editor"]')).not.toBeNull();
    expect(localizedEditorMock).toHaveBeenCalledWith(
      expect.objectContaining({ editable: false, allowNeutralBlockEdits: false, allowStructuralEdits: false }),
    );
  });

  it('keeps target authoring on locale leaves while source authoring retains neutral structure controls', async () => {
    await render('locale-editor');
    expect(localizedEditorMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        editable: true,
        allowNeutralBlockEdits: true,
        allowStructuralEdits: true,
      }),
    );

    await act(async () => {
      root?.render(
        <MantineProvider>
          <PostEditorBody
            {...baseProps}
            bodyMode="locale-editor"
            session={editorSession}
            activeLocale="en"
            isSourceLocale={false}
          />
        </MantineProvider>,
      );
      await Promise.resolve();
    });

    expect(localizedEditorMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        editable: true,
        allowNeutralBlockEdits: false,
        allowStructuralEdits: false,
        aiTarget: { type: 'post', id: 'post-1', locale: 'en' },
      }),
    );
  });

  it('mounts an archived Author in the real room while keeping every editor mutation read-only', async () => {
    await act(async () => {
      root?.render(
        <MantineProvider>
          <PostEditorBody {...baseProps} bodyMode="locale-editor" session={editorSession} editable={false} />
        </MantineProvider>,
      );
      await Promise.resolve();
    });

    expect(container?.querySelector('[data-testid="rich-text-editor"]')).not.toBeNull();
    expect(localizedEditorMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        provider: editorSession.provider,
        editable: false,
        aiTarget: undefined,
      }),
    );
  });
});
