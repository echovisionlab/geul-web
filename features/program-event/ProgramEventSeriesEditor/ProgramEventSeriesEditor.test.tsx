// @vitest-environment jsdom

import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MantineProvider } from '@mantine/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  updateProgramEventSeriesAction: vi.fn(),
  notification: vi.fn(),
  routerPush: vi.fn(),
}));

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mocks.routerPush }) }));
vi.mock('next-intl', () => ({
  useTranslations: () => {
    const translate = ((key: string) => key) as ((key: string) => string) & {
      rich: (key: string) => string;
    };
    translate.rich = (key: string) => key;
    return translate;
  },
}));
vi.mock('@mantine/hooks', () => ({
  useDebouncedCallback: (callback: (...args: unknown[]) => unknown) => callback,
}));
vi.mock('@mantine/notifications', () => ({ notifications: { show: mocks.notification } }));
vi.mock('@/features/editor/EditorHeader', () => ({
  createDraftPublishedStatusOptions: () => [],
  EditorHeader: ({
    status,
    onStatusChange,
    onBack,
    onDelete,
    onTitleChange,
  }: {
    status: 'draft' | 'published';
    onStatusChange?: (status: 'draft' | 'published') => void;
    onBack?: () => void;
    onDelete?: () => void;
    onTitleChange?: (title: string) => void;
  }) => (
    <div>
      <span data-testid="series-status">{status}</span>
      <button type="button" data-testid="back" onClick={() => onBack?.()}>
        back
      </button>
      <button type="button" data-testid="edit-title" onClick={() => onTitleChange?.('Edited series')}>
        edit title
      </button>
      <button
        type="button"
        data-testid="change-status"
        onClick={() => onStatusChange?.(status === 'draft' ? 'published' : 'draft')}
      >
        change status
      </button>
      <button type="button" data-testid="delete" onClick={() => onDelete?.()}>
        delete
      </button>
    </div>
  ),
}));
vi.mock('@/components/core/Input', () => ({ Textarea: () => null }));
vi.mock('@/components/core/MediaPreviewGrid', () => ({
  MediaPreviewGrid: ({ children }: { children: ReactNode }) => children,
}));
vi.mock('@/components/core/Section', () => ({
  SectionCard: ({ children }: { children: ReactNode }) => children,
}));
vi.mock('@/features/metadata/UrlSection', () => ({ UrlSection: () => null }));
vi.mock('@/features/upload/ImageUploadCropController', () => ({ ImageUploadCropController: () => null }));
vi.mock('@/features/metadata/MetadataPanel/MetadataPanel', () => ({ MetadataPanel: () => null }));
vi.mock('@/lib/actions/program-event', () => ({
  deleteProgramEventSeriesAction: vi.fn(),
  removeProgramEventSeriesPosterAction: vi.fn(),
  setProgramEventSeriesPosterAction: vi.fn(),
  updateProgramEventSeriesAction: mocks.updateProgramEventSeriesAction,
}));
vi.mock('@/lib/hooks/useUpload', () => ({
  useUpload: () => ({ upload: vi.fn(), isUploading: false }),
}));

import { ProgramEventSeriesEditor } from './ProgramEventSeriesEditor';
import { clearEditorSaveRecovery } from '@/lib/editor/editor-save-recovery';

let container: HTMLDivElement;
let root: Root;

describe('ProgramEventSeriesEditor status transition', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.updateProgramEventSeriesAction.mockResolvedValue({ success: true });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    clearEditorSaveRecovery('program_event_series:series-1');
    window.sessionStorage.clear();
  });

  it('restores the authoritative status when persistence fails', async () => {
    let resolveUpdate: ((result: { error: string }) => void) | undefined;
    mocks.updateProgramEventSeriesAction.mockReturnValue(
      new Promise((resolve) => {
        resolveUpdate = resolve;
      }),
    );
    const queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    });

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <MantineProvider env="test">
            <ProgramEventSeriesEditor
              seriesId="series-1"
              initialTitle="Series"
              initialSlug="series"
              initialSummary={null}
              initialDescription={null}
              initialStatus="draft"
              initialPosterUrl={null}
              canonicalOrigin="https://example.test"
              siteName="Geul"
              baseUrl="https://example.test"
            />
          </MantineProvider>
        </QueryClientProvider>,
      );
    });

    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-testid="change-status"]')?.click();
      await vi.waitFor(() =>
        expect(container.querySelector('[data-testid="series-status"]')?.textContent).toBe('published'),
      );
    });
    expect(container.querySelector('[data-testid="series-status"]')?.textContent).toBe('published');

    await act(async () => resolveUpdate?.({ error: 'transition failed' }));
    await vi.waitFor(() => expect(container.querySelector('[data-testid="series-status"]')?.textContent).toBe('draft'));
    expect(mocks.notification).toHaveBeenCalledWith({ message: 'transition failed', color: 'red' });
  });

  it('flushes a pending title edit before navigating back', async () => {
    let resolveUpdate: ((result: { success?: boolean }) => void) | undefined;
    mocks.updateProgramEventSeriesAction.mockReturnValue(
      new Promise((resolve) => {
        resolveUpdate = resolve;
      }),
    );
    const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <MantineProvider env="test">
            <ProgramEventSeriesEditor
              seriesId="series-1"
              initialTitle="Series"
              initialSlug="series"
              initialSummary={null}
              initialDescription={null}
              initialStatus="draft"
              initialPosterUrl={null}
              canonicalOrigin="https://example.test"
              siteName="Geul"
              baseUrl="https://example.test"
            />
          </MantineProvider>
        </QueryClientProvider>,
      );
    });

    act(() => container.querySelector<HTMLButtonElement>('[data-testid="edit-title"]')?.click());
    act(() => container.querySelector<HTMLButtonElement>('[data-testid="back"]')?.click());
    await vi.waitFor(() =>
      expect(mocks.updateProgramEventSeriesAction).toHaveBeenCalledWith('series-1', { title: 'Edited series' }),
    );
    expect(mocks.routerPush).not.toHaveBeenCalled();

    await act(async () => resolveUpdate?.({ success: true }));
    await vi.waitFor(() => expect(mocks.routerPush).toHaveBeenCalledWith('/admin/event-series'));
  });

  it('keeps the editor open when flushing a pending title edit fails', async () => {
    mocks.updateProgramEventSeriesAction.mockResolvedValue({ error: 'save failed' });
    const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <MantineProvider env="test">
            <ProgramEventSeriesEditor
              seriesId="series-1"
              initialTitle="Series"
              initialSlug="series"
              initialSummary={null}
              initialDescription={null}
              initialStatus="draft"
              initialPosterUrl={null}
              canonicalOrigin="https://example.test"
              siteName="Geul"
              baseUrl="https://example.test"
            />
          </MantineProvider>
        </QueryClientProvider>,
      );
    });

    act(() => container.querySelector<HTMLButtonElement>('[data-testid="edit-title"]')?.click());
    act(() => container.querySelector<HTMLButtonElement>('[data-testid="back"]')?.click());
    await vi.waitFor(() =>
      expect(mocks.updateProgramEventSeriesAction).toHaveBeenCalledWith('series-1', { title: 'Edited series' }),
    );
    await vi.waitFor(() => expect(mocks.routerPush).not.toHaveBeenCalled());
    expect(mocks.notification).toHaveBeenCalledWith({ message: 'saveFailed', color: 'red' });
  });
});
