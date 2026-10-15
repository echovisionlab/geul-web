// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  template: {
    id: 'template-1',
    name: 'Template',
    subject: 'Subject',
    key: 'custom',
    variables: [],
    layoutId: 'original',
  },
  save: vi.fn(),
  refetch: vi.fn(),
  getTemplate: vi.fn(),
  queryFn: null as (() => Promise<unknown>) | null,
  peer: null as (() => void) | null,
  refreshPreview: vi.fn(),
}));
vi.mock('next/navigation', () => ({ useParams: () => ({ id: 'template-1' }), useRouter: () => ({ push: vi.fn() }) }));
vi.mock('next-intl', () => ({ useLocale: () => 'en', useTranslations: () => (key: string) => key }));
vi.mock('@tanstack/react-query', () => ({
  useQuery: ({ queryKey, queryFn }: { queryKey: string[]; queryFn: () => Promise<unknown> }) => {
    if (queryKey[0] === 'emailTemplates') {
      mocks.queryFn = queryFn;
      return { data: mocks.template, isLoading: false, refetch: mocks.refetch };
    }
    return { data: [], isLoading: false };
  },
  useMutation: ({ mutationFn }: { mutationFn: (values: unknown) => Promise<unknown> }) => ({
    mutateAsync: mutationFn,
    isPending: false,
  }),
}));
vi.mock('@mantine/hooks', async () => {
  const React = await import('react');
  return {
    useDebouncedCallback: () => mocks.refreshPreview,
    useDisclosure: (initial = false) => {
      const [opened, setOpened] = React.useState(initial);
      return [opened, { open: () => setOpened(true), close: () => setOpened(false) }];
    },
  };
});
vi.mock('@/lib/actions/email-template', () => ({
  getEmailTemplateAction: mocks.getTemplate,
  previewEmailTemplateAction: vi.fn(),
  sendTestEmailTemplateAction: vi.fn(),
  updateEmailTemplateLayoutAction: mocks.save,
}));
vi.mock('@/components/core/Notification', () => ({ notifications: { show: vi.fn() } }));
vi.mock('@/components/core/Input', () => ({
  TextInput: () => null,
  Select: ({ value, onChange }: { value: string | null; onChange: (value: string) => void }) => (
    <div>
      <output data-testid="layout">{value}</output>
      <button type="button" data-testid="first" onClick={() => onChange('first')}>
        First
      </button>
      <button type="button" data-testid="second" onClick={() => onChange('second')}>
        Second
      </button>
    </div>
  ),
}));
vi.mock('@/components/core/Modal', () => ({ ContentModal: () => null, DialogActions: () => null }));
vi.mock('@/features/editor/EditorHeader', () => ({ EditorHeader: () => null }));
vi.mock('@/features/site/PageLoader', () => ({ PageLoader: () => null }));
vi.mock('@/features/admin/IconViewModeControl', () => ({ IconViewModeControl: () => null }));
vi.mock('@/features/email/EmailTemplateEditor/EmailTemplateEditor', () => ({ EmailTemplateEditor: () => null }));
vi.mock('@/features/translation/EntityTranslationsPanel', () => ({ EntityTranslationsPanel: () => null }));
vi.mock('@/features/translation/TranslationLocaleControl', () => ({ TranslationLocaleControl: () => null }));
vi.mock('@/features/translation/locale-display-fields', () => ({
  canEditLocaleDocumentField: () => true,
  resolveResidentLocaleField: ({ sourceValue }: { sourceValue: string }) => sourceValue,
}));
vi.mock('@/features/translation/useLocaleDocumentSession', () => ({
  useLocaleDocumentSession: () => ({
    activeEditLocale: {
      activeLocale: 'en',
      sourceLocale: 'en',
      isSourceLocale: true,
      canEditActiveLocale: true,
      displayTitle: 'Subject',
      localeOptions: [],
    },
    roomLocale: 'en',
    mode: { shouldUseLocaleDocument: true },
    hasRoomMutationAuthority: () => true,
  }),
}));
vi.mock('@/lib/contexts/EditorRuntimeContext', () => ({
  EditorRuntimeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('@/lib/editor/editor-save-registry', () => ({ flushEditorSaves: vi.fn(async () => true) }));
vi.mock('@/lib/editor/editor-entity-changes', () => ({
  publishEditorEntityChange: vi.fn(),
  useEditorEntityChanges: (_document: string, callback: () => void) => {
    mocks.peer = callback;
  },
}));
vi.mock('@/lib/editor/useBlockRoomMetadataUpdates', () => ({ useBlockRoomMetadataUpdates: vi.fn() }));
vi.mock('@/lib/editor/useDebouncedRoomMetadata', () => ({ useDebouncedRoomMetadata: () => vi.fn() }));
vi.mock('@/features/editor/hooks/useBlockRoomTiptapController', () => ({ useRichTextBlockRoomController: () => null }));
vi.mock('@/lib/collab/useBlockRoomConnection', () => ({
  useBlockRoomConnection: () => ({
    provider: null,
    doc: null,
    bootstrap: null,
    protocol: null,
    isConnected: true,
    isSynced: true,
  }),
}));
vi.mock('@/lib/collab/block-room-metadata', () => ({ updateBlockRoomLocaleMetadata: vi.fn() }));
vi.mock('@/lib/collab/persist-now', () => ({ persistCollaborativeDocumentNow: vi.fn() }));
vi.mock('@/lib/queries/email-layout', () => ({ listEmailLayoutsSimple: vi.fn() }));
vi.mock('@/lib/i18n/locale', () => ({
  getSupportedLocaleOptions: () => [],
  normalizeLocale: (value: string) => value,
}));
vi.mock('@/lib/utils/not-found-guard', () => ({ guardNotFound: vi.fn() }));

import EmailTemplateEditPage from './EmailTemplateEditPage';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { resolve, promise };
}

describe('Email template authoritative layout', () => {
  let container: HTMLDivElement;
  let root: Root;
  beforeEach(() => {
    mocks.template = { ...mocks.template, layoutId: 'original' };
    mocks.save.mockReset();
    mocks.getTemplate.mockReset().mockImplementation(async () => mocks.template);
    mocks.refetch.mockReset().mockImplementation(async () => ({ data: await mocks.queryFn?.() }));
    mocks.peer = null;
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('keeps the optimistic layout when an older peer read resolves after a successful write', async () => {
    const stale = deferred<typeof mocks.template>();
    const original = { ...mocks.template };
    mocks.getTemplate.mockImplementationOnce(() => stale.promise);
    mocks.save.mockImplementation(async (_id: string, layoutId: string) => {
      mocks.template = { ...mocks.template, layoutId };
      return { success: true };
    });
    await act(async () => root.render(<EmailTemplateEditPage />));
    act(() => mocks.peer?.());
    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-testid="first"]')!.click();
    });
    expect(container.querySelector('[data-testid="layout"]')?.textContent).toBe('first');
    await act(async () => {
      stale.resolve(original);
      await stale.promise;
      // React Query may cache a response even when its field ticket was rejected.
      mocks.template = original;
      root.render(<EmailTemplateEditPage />);
    });
    expect(container.querySelector('[data-testid="layout"]')?.textContent).toBe('first');
    expect(mocks.save).toHaveBeenCalledWith('template-1', 'first', expect.any(String));
  });

  it('settles every overlapping request and preserves the newer saved layout', async () => {
    const first = deferred<{ success: true }>();
    const second = deferred<{ success: true }>();
    mocks.save.mockImplementation((_id: string, layoutId: string) =>
      layoutId === 'first' ? first.promise : second.promise,
    );
    await act(async () => root.render(<EmailTemplateEditPage />));
    act(() => container.querySelector<HTMLButtonElement>('[data-testid="first"]')!.click());
    act(() => container.querySelector<HTMLButtonElement>('[data-testid="second"]')!.click());
    mocks.template = { ...mocks.template, layoutId: 'second' };
    await act(async () => {
      second.resolve({ success: true });
      await second.promise;
    });
    expect(container.querySelector('[data-testid="layout"]')?.textContent).toBe('second');
    await act(async () => {
      first.resolve({ success: true });
      await first.promise;
    });
    expect(container.querySelector('[data-testid="layout"]')?.textContent).toBe('second');
    expect(mocks.refetch).toHaveBeenCalledTimes(2);
  });
});
