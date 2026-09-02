// @vitest-environment jsdom

import { act } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MantineProvider } from '@mantine/core';
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

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
  }),
  usePathname: () => mockPathname,
  useSearchParams: () => mockSearchParams,
}));

vi.mock('next-intl', () => ({
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

vi.mock('@mantine/notifications', () => ({
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

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() {
      return false;
    },
  }),
});

let container: HTMLDivElement | null = null;
let root: Root | null = null;

function render(node: React.ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false },
    },
  });

  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);

  act(() => {
    root?.render(
      <QueryClientProvider client={queryClient}>
        <MantineProvider>{node}</MantineProvider>
      </QueryClientProvider>,
    );
  });
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
  });
}

beforeEach(() => {
  vi.useFakeTimers();
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
    provider: {},
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
  act(() => {
    root?.unmount();
  });
  container?.remove();
  root = null;
  container = null;
  vi.useRealTimers();
});

describe('AdminFormLayoutClient', () => {
  it('preserves the current query string when switching tabs', () => {
    mockSearchParams = new URLSearchParams('lang=ko&foo=bar');

    render(<AdminFormLayoutClient formId="form-1">Body</AdminFormLayoutClient>);

    const builderTab = Array.from(document.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'Builder',
    );
    expect(builderTab).not.toBeNull();

    act(() => {
      builderTab?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(pushMock).toHaveBeenCalledWith('/forms/form-1?lang=ko&foo=bar&edit=true&tab=builder');
  });

  it('updates the source form title through collaboration without mixing DB settings into Yjs', async () => {
    render(<AdminFormLayoutClient formId="form-1">Body</AdminFormLayoutClient>);

    const triggerButton = Array.from(document.querySelectorAll('button')).find(
      (button) => button.textContent === 'Trigger title change',
    );
    expect(triggerButton).not.toBeNull();

    act(() => {
      triggerButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(mockSetField).toHaveBeenNthCalledWith(1, 'title', 'Updated title');
    expect(mockSetField).toHaveBeenCalledTimes(1);
    expect(updateFormActionMock).not.toHaveBeenCalled();
  });

  it('edits an existing target title through the locale-scoped collaborative document', async () => {
    mockFormEditorContext.fields.title = '번역 제목';
    mockFormTranslationContext = {
      activeEditLocale: {
        activeLocale: 'ko',
        activeLocaleLabel: 'Korean',
        sourceLocale: 'en',
        localeOptions: [],
        setActiveLocale: vi.fn(),
        isLoading: false,
        isControlVisible: true,
        isSourceLocale: false,
        hasLiveRow: true,
        displayTitle: '번역 제목',
        canEditActiveLocale: true,
      },
      isEditingScopedLocale: true,
    };

    render(<AdminFormLayoutClient formId="form-1">Body</AdminFormLayoutClient>);

    expect(document.body.textContent).toContain('번역 제목');
    expect(document.body.textContent).toContain('Locale menu');
    expect(document.querySelector('[data-testid="editor-title-disabled"]')?.textContent).toBe('false');

    const triggerButton = Array.from(document.querySelectorAll('button')).find(
      (button) => button.textContent === 'Trigger title change',
    );
    expect(triggerButton).not.toBeNull();

    act(() => {
      triggerButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await flush();

    expect(mockSetField).toHaveBeenCalledWith('title', 'Updated title');
    expect(updateFormActionMock).not.toHaveBeenCalled();
  });
});
