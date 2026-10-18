// @vitest-environment jsdom
import { setProviderAccessLevel } from '@/lib/collab/provider-control-state';

import { render, screen, type RenderResult } from '@/test/render';
import { act } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useOptionalEditorRuntimeContext } from '@/lib/contexts/EditorRuntimeContext';
import { AdminFormLayoutClient } from './AdminFormLayoutClient';

const pushMock = vi.fn();
const updateFormActionMock = vi.fn();
const deleteFormActionMock = vi.fn();
const mockSetField = vi.fn();
const mockLocaleSetField = vi.fn();
const notifyOgGenerationLookupMock = vi.fn();

let mockPathname = '/admin/forms/form-1';
let mockSearchParams = new URLSearchParams('lang=ko');
let mockFormEditorContext: any;
let mockFormTranslationContext: any;
let runtimeContext: ReturnType<typeof useOptionalEditorRuntimeContext>;

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
  }),
  usePathname: () => mockPathname,
  useSearchParams: () => mockSearchParams,
}));

vi.mock('next-intl', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next-intl')>()),
  useTranslations: (namespace: string) => {
    const translate = (key: string, values?: Record<string, unknown>) => {
      const fullKey = `${namespace}.${key}`;
      const map: Record<string, string> = {
        'common.labels.overview': 'Overview',
        'common.labels.submissions': 'Submissions',
        'common.labels.settings': 'Settings',
        'common.entities.translations': 'Translations',
        'common.statuses.draft': 'Draft',
        'common.statuses.published': 'Published',
        'common.actions.unpublish': 'Unpublish',
        'common.actions.publish': 'Publish',
        'common.actions.back': 'Back',
        'common.notifications.updateFailed': 'Update failed',
        'common.states.untitledPlain': 'Untitled form',
        'common.states.synced': 'Synced',
        'common.states.syncing': 'Syncing',
        'common.states.offline': 'Offline',
        'formAdmin.navigation.tabs.builder': 'Builder',
        'formAdmin.navigation.backToForms': 'Back to forms',
        'formAdmin.status.closed': 'Closed',
        'formAdmin.statusActions.reopen': 'Reopen',
        'editorHeader.collab.button': 'Collab',
        'editorHeader.collab.buttonWithStatus': `Collab ${String(values?.status ?? '')}`.trim(),
        'editorHeader.collab.sections.connection': 'Connection',
        'editorHeader.collab.current': 'Current',
      };
      return map[fullKey] ?? fullKey;
    };

    return Object.assign(translate, {
      rich: translate,
    });
  },
}));

vi.mock('@/lib/editor/collaborative-document-save', () => ({ registerCollaborativeDocumentSave: () => () => {} }));

vi.mock('@/components/core/Notification', () => ({
  notifications: {
    show: vi.fn(),
  },
}));

vi.mock('@/features/site/PageLoader', () => ({
  PageLoader: () => <div data-testid="page-loader">Loading</div>,
}));

vi.mock('@/features/translation/EditorActiveLocaleMenu', () => ({
  EditorActiveLocaleMenu: () => <div data-testid="locale-menu">Locale menu</div>,
}));

vi.mock('@/features/editor/EditorHeader', () => ({
  EditorHeader: (props: {
    title: string;
    titleDisabled?: boolean;
    onTitleChange?: (value: string) => void;
    onStatusChange?: (value: 'draft' | 'published' | 'closed') => void;
    onDelete?: () => void;
    controls?: React.ReactNode;
  }) => (
    <div data-testid="editor-header">
      <div data-testid="editor-title">{props.title}</div>
      <div data-testid="editor-title-disabled">{String(Boolean(props.titleDisabled))}</div>
      <div data-testid="editor-status-enabled">{String(Boolean(props.onStatusChange))}</div>
      <div data-testid="editor-delete-enabled">{String(Boolean(props.onDelete))}</div>
      {props.controls}
      <button type="button" onClick={() => props.onTitleChange?.('Updated title')}>
        Trigger title change
      </button>
    </div>
  ),
}));

vi.mock('@/lib/contexts/FormEditorContext', () => ({
  useFormEditorContext: () => mockFormEditorContext,
}));

vi.mock('@/features/form/FormTranslationContext', () => ({
  useFormTranslationContext: () => mockFormTranslationContext,
}));

vi.mock('@/lib/actions/form', () => ({
  updateFormAction: (...args: unknown[]) => updateFormActionMock(...args),
  deleteFormAction: (...args: unknown[]) => deleteFormActionMock(...args),
}));

let view: (RenderResult & { user: ReturnType<typeof render>['user'] }) | undefined;
let queryClient: QueryClient;

function renderLayout(node: React.ReactNode) {
  queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });
  view = render(<QueryClientProvider client={queryClient}>{node}</QueryClientProvider>);
}

function RuntimeContextProbe() {
  runtimeContext = useOptionalEditorRuntimeContext();
  return null;
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
  });
}

beforeEach(() => {
  pushMock.mockReset();
  updateFormActionMock.mockReset();
  deleteFormActionMock.mockReset();
  mockSetField.mockReset();
  mockLocaleSetField.mockReset();
  notifyOgGenerationLookupMock.mockReset();
  updateFormActionMock.mockResolvedValue({ success: true });
  deleteFormActionMock.mockResolvedValue({ success: true });
  mockPathname = '/admin/forms/form-1';
  mockSearchParams = new URLSearchParams('lang=ko');
  mockFormEditorContext = {
    isConnected: true,
    isSynced: true,
    provider: null,
    fields: {
      title: 'Old title',
      slug: '',
      status: 'draft',
    },
    setField: mockSetField,
    ogGenerationLookup: null,
    notifyOgGenerationLookup: notifyOgGenerationLookupMock,
  };
  mockFormTranslationContext = {
    activeEditLocale: {
      activeLocale: 'en',
      activeLocaleLabel: 'English',
      sourceLocale: 'en',
      localeOptions: [],
      setActiveLocale: vi.fn(),
      isLoading: false,
      isControlVisible: false,
      isSourceLocale: true,
      hasLiveRow: false,
      displayTitle: 'Old title',
      canEditActiveLocale: true,
    },
    isEditingScopedLocale: false,
    localeCollab: null,
  };
});

afterEach(() => {
  view?.unmount();
  queryClient?.clear();
  view = undefined;
});

describe('AdminFormLayoutClient', () => {
  it('upgrades and downgrades form header controls without replacing its content', () => {
    const provider = { on: vi.fn(), off: vi.fn() };
    setProviderAccessLevel(provider, 'view');
    mockFormEditorContext = { ...mockFormEditorContext, provider };
    renderLayout(
      <AdminFormLayoutClient formId="form-1">
        <p data-testid="form-body">Readable form</p>
      </AdminFormLayoutClient>,
    );
    const body = screen.getByTestId('form-body');
    expect(screen.getByTestId('editor-title-disabled')?.textContent).toBe('true');
    act(() => setProviderAccessLevel(provider, 'edit'));
    expect(screen.getByTestId('editor-title-disabled')?.textContent).toBe('false');
    expect(screen.getByTestId('form-body')).toBe(body);
    act(() => setProviderAccessLevel(provider, 'view'));
    expect(screen.getByTestId('editor-title-disabled')?.textContent).toBe('true');
    expect(screen.getByTestId('editor-status-enabled')?.textContent).toBe('false');
    expect(screen.getByTestId('editor-delete-enabled')?.textContent).toBe('false');
    expect(screen.getByTestId('form-body')).toBe(body);
  });
  it('exposes the active form collaboration runtime to nested translation panels', () => {
    renderLayout(
      <AdminFormLayoutClient formId="form-1">
        <RuntimeContextProbe />
      </AdminFormLayoutClient>,
    );

    expect(runtimeContext).toMatchObject({ entityType: 'form', entityId: 'form-1', provider: null });
    expect(runtimeContext?.getBlockRoomSnapshot).toEqual(expect.any(Function));
  });

  it('connects the selected settings tab to its single named panel', () => {
    mockSearchParams = new URLSearchParams('edit=true&tab=settings');
    renderLayout(<AdminFormLayoutClient formId="form-1">Settings body</AdminFormLayoutClient>);
    const tab = screen.getByRole('tab', { name: 'Settings', selected: true });
    const panel = screen.getByRole('tabpanel', { name: 'Settings' });
    expect(tab).toHaveAttribute('aria-controls', panel.id);
    expect(panel).toHaveAttribute('aria-labelledby', tab.id);
    expect(screen.getAllByRole('tabpanel')).toHaveLength(1);
  });

  it('preserves the current query string when switching tabs', async () => {
    mockSearchParams = new URLSearchParams('lang=ko&foo=bar');

    renderLayout(<AdminFormLayoutClient formId="form-1">Body</AdminFormLayoutClient>);

    await view!.user.click(screen.getByRole('tab', { name: 'Settings' }));

    expect(pushMock).toHaveBeenCalledWith('/forms/form-1?lang=ko&foo=bar&edit=true&tab=settings');
  });

  it.each([
    { locale: 'source', title: 'Old title', target: null, localeMenu: false },
    {
      locale: 'existing target',
      title: '번역 제목',
      target: {
        activeLocale: 'ko',
        activeLocaleLabel: 'Korean',
        isControlVisible: true,
        isSourceLocale: false,
        hasLiveRow: true,
        displayTitle: '번역 제목',
      },
      localeMenu: true,
    },
  ])(
    'edits the $locale form title through its collaborative document without mixing DB settings into Yjs',
    async ({ title, target, localeMenu }) => {
      if (target) {
        mockFormEditorContext.fields.title = title;
        mockFormTranslationContext = {
          ...mockFormTranslationContext,
          activeEditLocale: { ...mockFormTranslationContext.activeEditLocale, ...target },
          isEditingScopedLocale: true,
        };
      }

      renderLayout(<AdminFormLayoutClient formId="form-1">Body</AdminFormLayoutClient>);

      expect(screen.queryByTestId('editor-title')?.textContent).toBe(title);
      expect(Boolean(screen.queryByTestId('locale-menu'))).toBe(localeMenu);
      expect(screen.queryByTestId('editor-title-disabled')?.textContent).toBe('false');

      await view!.user.click(screen.getByRole('button', { name: 'Trigger title change' }));
      await flush();

      expect(mockSetField).toHaveBeenCalledTimes(1);
      expect(mockSetField).toHaveBeenCalledWith('title', 'Updated title');
      expect(updateFormActionMock).not.toHaveBeenCalled();
    },
  );
});
