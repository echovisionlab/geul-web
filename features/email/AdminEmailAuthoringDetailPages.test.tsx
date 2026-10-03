// @vitest-environment jsdom

import { act, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MantineProvider } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import EmailLayoutEditPage from '@/app/admin/email-layouts/[id]/page';
import EmailTemplateEditPage from '@/app/admin/email-templates/[id]/page';

type TestMetadataUpdate = {
  operation: 'locale' | 'document' | 'page_layout';
  values: Record<string, unknown>;
  sequence: number;
};

const metadataUpdates = vi.hoisted(() => {
  const listeners: Array<(update: TestMetadataUpdate) => void> = [];
  return {
    listeners,
    protocol: {
      subscribeMetadata(listener: (update: TestMetadataUpdate) => void) {
        listeners.push(listener);
        return () => {
          const index = listeners.indexOf(listener);
          if (index >= 0) {
            listeners.splice(index, 1);
          }
        };
      },
    },
  };
});

const api = vi.hoisted(() => ({
  getEmailLayout: vi.fn(),
  getEmailTemplateAction: vi.fn(),
  listEmailLayoutsSimple: vi.fn(),
  listEntityTranslations: vi.fn(),
  previewEmailTemplateAction: vi.fn(),
  sendTestEmailTemplateAction: vi.fn(),
  updateEmailLayoutAction: vi.fn(),
  updateEmailTemplateLayoutAction: vi.fn(),
  flushEditorSaves: vi.fn(),
  persistCollaborativeDocumentNow: vi.fn(),
  publishEditorEntityChange: vi.fn(),
  entityChangeHandlers: new Map<string, () => void>(),
  pendingEditorPatch: {} as Record<string, unknown>,
  saveStateListeners: [] as Array<() => void>,
  subjectSave: Object.assign(vi.fn(), { flush: vi.fn() }),
}));

const localeRoom = vi.hoisted(() => ({
  activeLocale: 'en',
  sourceLocale: 'en',
  isSourceLocale: true,
  hasLiveRow: true,
  displayTitle: null as string | null,
  contentHtml: '' as string | null,
  isSynced: true,
  layoutInitialContent: [] as string[],
  targetUnits: [] as Array<{ handle: string; value: string }>,
  acceptEpochAck: vi.fn(() => true),
  reloadCanonical: vi.fn(),
}));

const pushMock = vi.hoisted(() => vi.fn());
const TEMPLATE_ID = '11111111-1111-4111-8111-111111111111';
const LAYOUT_ID = '22222222-2222-4222-8222-222222222222';
let routeId = TEMPLATE_ID;

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: routeId }),
  useRouter: () => ({ push: pushMock, replace: vi.fn() }),
  usePathname: () => `/admin/email-templates/${routeId}`,
  useSearchParams: () => ({ toString: () => '' }) as URLSearchParams,
}));

vi.mock('next-intl', () => ({
  useLocale: () => 'en',
  useTranslations: (namespace: string) => {
    const translate = (key: string) => `${namespace}.${key}`;
    return Object.assign(translate, { rich: translate });
  },
}));

vi.mock('@mantine/notifications', () => ({
  notifications: { show: vi.fn() },
}));

vi.mock('@mantine/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@mantine/core')>();
  return {
    ...actual,
    Modal: ({ opened, children }: { opened: boolean; children: ReactNode }) =>
      opened ? <div role="dialog">{children}</div> : null,
  };
});

vi.mock('@/lib/actions/email-template', () => ({
  getEmailTemplateAction: api.getEmailTemplateAction,
  previewEmailTemplateAction: api.previewEmailTemplateAction,
  sendTestEmailTemplateAction: api.sendTestEmailTemplateAction,
  updateEmailTemplateLayoutAction: api.updateEmailTemplateLayoutAction,
}));

vi.mock('@/lib/editor/editor-save-registry', () => ({
  flushEditorSaves: api.flushEditorSaves,
  getPendingEditorPatch: () => api.pendingEditorPatch,
  subscribeToEditorSaveState: (_document: string, listener: () => void) => {
    api.saveStateListeners.push(listener);
    return () => {
      const index = api.saveStateListeners.indexOf(listener);
      if (index >= 0) {
        api.saveStateListeners.splice(index, 1);
      }
    };
  },
}));

vi.mock('@/lib/editor/editor-entity-changes', () => ({
  publishEditorEntityChange: api.publishEditorEntityChange,
  useEditorEntityChanges: (document: string, onChange: () => void) => {
    api.entityChangeHandlers.set(document, onChange);
  },
}));

vi.mock('@/lib/editor/useDebouncedRoomMetadata', () => ({
  useDebouncedRoomMetadata: () => api.subjectSave,
}));

vi.mock('@/lib/collab/persist-now', () => ({
  persistCollaborativeDocumentNow: api.persistCollaborativeDocumentNow,
}));

vi.mock('@/lib/actions/email-layout', () => ({
  updateEmailLayoutAction: api.updateEmailLayoutAction,
}));

vi.mock('@/lib/queries/email-layout', () => ({
  getEmailLayout: api.getEmailLayout,
  listEmailLayoutsSimple: api.listEmailLayoutsSimple,
}));

vi.mock('@/lib/api/browser/secure-translation', () => ({
  createTranslationClient: () => ({ listEntityTranslations: api.listEntityTranslations }),
}));

vi.mock('@/features/translation/useActiveEditLocale', () => ({
  useActiveEditLocale: ({ sourceTitle }: { sourceTitle: string }) => ({
    activeLocale: localeRoom.activeLocale,
    activeLocaleLabel: 'English',
    canEditActiveLocale: true,
    contentHtml: localeRoom.contentHtml,
    contentJson: undefined,
    contentPreview: '',
    contentPreviewLoading: false,
    displayOgImageUrl: null,
    displaySummary: '',
    displayTitle: localeRoom.displayTitle ?? sourceTitle,
    handleContentChange: vi.fn(),
    handleSummaryChange: vi.fn(),
    handleTitleChange: vi.fn(),
    hasLiveRow: localeRoom.hasLiveRow,
    isControlVisible: false,
    isLoading: false,
    isSourceLocale: localeRoom.isSourceLocale,
    isSourceLocaleReady: true,
    localeOptions: [],
    ogGenerationRun: null,
    setActiveLocale: vi.fn(),
    sourceLocale: localeRoom.sourceLocale,
    sourceLocaleLabel: 'English',
  }),
}));

vi.mock('@/lib/collab/useBlockRoomConnection', () => ({
  useBlockRoomConnection: () => ({
    provider: {},
    doc: { clientID: 7 },
    bootstrap: {
      sourceLocale: localeRoom.sourceLocale,
      locale: localeRoom.activeLocale,
      localeExists: true,
      documentRevision: 'revision-1',
      ...(localeRoom.isSourceLocale ? {} : { targetRevision: 'target-revision-1' }),
    },
    protocol: metadataUpdates.protocol,
    isConnected: true,
    isSynced: localeRoom.isSynced,
    isLoading: false,
    error: null,
    acceptEpochAck: localeRoom.acceptEpochAck,
    reloadCanonical: localeRoom.reloadCanonical,
  }),
}));

vi.mock('@/features/editor/hooks/useBlockRoomTiptapController', () => ({
  useRichTextBlockRoomController: () => ({
    initialContent: { type: 'doc', content: [] },
    extension: {},
    connect: vi.fn(),
    getLocalizedDocumentSnapshot: vi.fn(),
  }),
}));

vi.mock('@/features/translation/useSourceDocumentCollaboration', () => ({
  useEmailLayoutCollaboration: () => ({
    provider: {},
    doc: { clientID: 8 },
    isConnected: true,
    isSynced: localeRoom.isSynced,
    targetUnits: localeRoom.targetUnits,
    setTargetValue: vi.fn(),
    useSourceFallback: vi.fn(),
  }),
}));

vi.mock('@/lib/contexts/EditorRuntimeContext', () => ({
  EditorRuntimeProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock('@/features/editor/EditorHeader', () => ({
  EditorHeader: ({
    title,
    onBack,
    actionItems = [],
  }: {
    title: string;
    onBack?: () => void;
    actionItems?: Array<{ key?: string; label?: string; onClick?: () => void }>;
  }) => (
    <div>
      <h1>{title}</h1>
      {onBack ? (
        <button type="button" onClick={onBack}>
          back
        </button>
      ) : null}
      {actionItems.map((item, index) => (
        <button type="button" key={item.key ?? index} onClick={item.onClick}>
          {item.label}
        </button>
      ))}
    </div>
  ),
}));

vi.mock('@/features/admin/IconViewModeControl', () => ({
  IconViewModeControl: () => <div data-testid="view-mode-control" />,
}));

vi.mock('@/features/admin/email-layout/EmailLayoutEditor', () => ({
  EmailLayoutEditor: ({ initialContent }: { initialContent: string }) => {
    localeRoom.layoutInitialContent.push(initialContent);
    return <div data-testid="layout-editor" />;
  },
}));

vi.mock('@/features/admin/email-layout/EmailLayoutTargetEditor', () => ({
  EmailLayoutTargetEditor: ({ units }: { units: Array<{ handle: string }> }) => (
    <div data-testid="layout-target-editor">{units.map((unit) => unit.handle).join(',')}</div>
  ),
}));

vi.mock('@/features/admin/email-layout/EmailLayoutPreview', () => ({
  EmailLayoutPreview: () => <div data-testid="layout-preview" />,
}));

vi.mock('@/features/email/EmailTemplateEditor/EmailTemplateEditor', () => ({
  EmailTemplateEditor: () => <div data-testid="template-editor" />,
}));

vi.mock('@/features/translation/EmailEntityTranslationsPanel', () => ({
  EmailEntityTranslationsPanel: () => <div data-testid="email_layout-translations" />,
}));

vi.mock('@/features/translation/EntityTranslationsPanel', () => ({
  EntityTranslationsPanel: ({ entityType }: { entityType: string }) => (
    <div data-testid={`${entityType}-translations`} />
  ),
}));

vi.mock('@/features/translation/TranslationLocaleControl', () => ({
  TranslationLocaleControl: () => null,
}));

vi.mock('@/features/site/PageLoader', () => ({
  PageLoader: () => <div>Loading</div>,
}));

let container: HTMLDivElement | null = null;
let root: Root | null = null;
let queryClient: QueryClient | null = null;

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

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

globalThis.ResizeObserver = ResizeObserverMock;

function renderPage(node: ReactNode) {
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root?.render(
      <QueryClientProvider client={queryClient!}>
        <MantineProvider>{node}</MantineProvider>
      </QueryClientProvider>,
    );
  });
}

async function flush() {
  await act(async () => {
    for (let pass = 0; pass < 5; pass += 1) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  });
}

function findInputByLabelText(labelText: string): HTMLInputElement {
  const label = [...document.querySelectorAll('label')].find((candidate) => candidate.textContent?.includes(labelText));
  const input = label?.htmlFor ? document.getElementById(label.htmlFor) : null;
  if (!(input instanceof HTMLInputElement)) {
    throw new Error(`Input with label ${labelText} was not rendered.`);
  }
  return input;
}

function setInputValue(input: HTMLInputElement, value: string) {
  const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  setValue?.call(input, value);
  act(() => input.dispatchEvent(new Event('input', { bubbles: true })));
}

function findButtonByText(text: string, occurrence = 0): HTMLButtonElement {
  const buttons = [...document.querySelectorAll('button')].filter((button) => button.textContent?.includes(text));
  const button = buttons[occurrence];
  if (!(button instanceof HTMLButtonElement)) {
    throw new Error(`Button with text ${text} was not rendered.`);
  }
  return button;
}

function emitMetadataUpdate(update: TestMetadataUpdate) {
  act(() => {
    for (const listener of [...metadataUpdates.listeners]) {
      listener(update);
    }
  });
}

function notifySaveStateChanged() {
  act(() => {
    for (const listener of [...api.saveStateListeners]) {
      listener();
    }
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  localeRoom.activeLocale = 'en';
  localeRoom.sourceLocale = 'en';
  localeRoom.isSourceLocale = true;
  localeRoom.hasLiveRow = true;
  localeRoom.displayTitle = null;
  localeRoom.contentHtml = '';
  localeRoom.isSynced = true;
  localeRoom.layoutInitialContent.length = 0;
  localeRoom.targetUnits = [];
  api.listEntityTranslations.mockResolvedValue({ sourceLocale: 'en', entries: [] });
  api.listEmailLayoutsSimple.mockResolvedValue([]);
  api.previewEmailTemplateAction.mockResolvedValue({ subject: 'Preview', html: '<p>Preview</p>' });
  api.flushEditorSaves.mockResolvedValue(true);
  api.persistCollaborativeDocumentNow.mockResolvedValue(undefined);
  api.subjectSave.flush.mockResolvedValue(true);
  api.subjectSave.mockClear();
  api.updateEmailLayoutAction.mockResolvedValue({ success: true });
  api.updateEmailTemplateLayoutAction.mockResolvedValue({ success: true });
  Object.keys(api.pendingEditorPatch).forEach((key) => delete api.pendingEditorPatch[key]);
  api.saveStateListeners.length = 0;
  metadataUpdates.listeners.length = 0;
  api.entityChangeHandlers.clear();
  api.getEmailTemplateAction.mockResolvedValue({
    id: TEMPLATE_ID,
    key: 'custom-template',
    name: 'Custom template detail',
    subject: 'Subject',
    variables: [],
    isSystem: false,
    isActive: true,
    deliveryRunCount: 12,
    createdAt: new Date('2026-01-01T00:00:00Z'),
  });
  api.getEmailLayout.mockResolvedValue({
    id: LAYOUT_ID,
    key: 'custom-layout',
    name: 'Custom layout detail',
    htmlContent: '{{content}}',
    campaignCount: 0,
    templateCount: 0,
    deliveryRunCount: 12,
    createdAt: new Date('2026-01-01T00:00:00Z'),
  });
});

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  queryClient?.clear();
  root = null;
  container = null;
  queryClient = null;
});

describe('email authoring detail pages', () => {
  it('renders the current email template detail without archive lifecycle controls', async () => {
    routeId = TEMPLATE_ID;
    renderPage(<EmailTemplateEditPage />);
    await flush();

    expect(document.body.textContent).toContain('Custom template detail');
    expect(document.querySelector('[data-testid="email_template-translations"]')).not.toBeNull();
    expect(document.body.textContent?.toLowerCase()).not.toMatch(/archive|restore|include archived/);
  });

  it('renders the current email layout detail without archive lifecycle controls', async () => {
    routeId = LAYOUT_ID;
    renderPage(<EmailLayoutEditPage />);
    await flush();

    expect(document.body.textContent).toContain('Custom layout detail');
    expect(document.querySelector('[data-testid="email_layout-translations"]')).not.toBeNull();
    expect(document.body.textContent?.toLowerCase()).not.toMatch(/archive|restore|include archived/);
  });

  it('keeps an existing empty target subject empty and read-only before exact room sync', async () => {
    routeId = TEMPLATE_ID;
    localeRoom.activeLocale = 'ko';
    localeRoom.isSourceLocale = false;
    localeRoom.hasLiveRow = true;
    localeRoom.displayTitle = '';
    localeRoom.isSynced = false;

    renderPage(<EmailTemplateEditPage />);
    await flush();

    const subject = findInputByLabelText('common.labels.subject');
    expect(subject.value).toBe('');
    expect(subject.disabled).toBe(true);
  });

  it('uses the stable-unit target editor without mounting the source HTML editor', async () => {
    routeId = LAYOUT_ID;
    localeRoom.activeLocale = 'ko';
    localeRoom.isSourceLocale = false;
    localeRoom.hasLiveRow = true;
    localeRoom.contentHtml = '';
    localeRoom.targetUnits = [{ handle: 'unit-1', value: 'Source fallback' }];

    renderPage(<EmailLayoutEditPage />);
    await flush();

    expect(document.querySelector('[data-testid="layout-target-editor"]')?.textContent).toContain('unit-1');
    expect(document.querySelector('[data-testid="layout-editor"]')).toBeNull();
    expect(localeRoom.layoutInitialContent).toEqual([]);
  });

  it('registers subject edits and blocks Back when pending saves cannot flush', async () => {
    routeId = TEMPLATE_ID;
    renderPage(<EmailTemplateEditPage />);
    await flush();

    setInputValue(findInputByLabelText('common.labels.subject'), 'Changed subject');
    expect(api.subjectSave).toHaveBeenCalledWith({ locale: 'en', subject: 'Changed subject' });

    api.flushEditorSaves.mockResolvedValue(false);
    act(() => findButtonByText('back').click());
    await flush();

    expect(api.flushEditorSaves).toHaveBeenCalledWith(`email_template:${TEMPLATE_ID}`);
    expect(pushMock).not.toHaveBeenCalled();
    expect(notifications.show).toHaveBeenCalledWith({
      message: 'common.notifications.saveFailed',
      color: 'red',
    });
  });

  it('adopts initial peer subject metadata without queuing another write', async () => {
    routeId = TEMPLATE_ID;
    renderPage(<EmailTemplateEditPage />);
    await flush();

    emitMetadataUpdate({ operation: 'locale', values: { subject: 'Peer subject' }, sequence: 1 });
    await flush();

    expect(findInputByLabelText('common.labels.subject').value).toBe('Peer subject');
    expect(api.subjectSave).not.toHaveBeenCalled();
  });

  it('protects locally queued subject input from peer adoption until the save clears', async () => {
    routeId = TEMPLATE_ID;
    renderPage(<EmailTemplateEditPage />);
    await flush();

    const subject = findInputByLabelText('common.labels.subject');
    setInputValue(subject, 'Local typing');
    api.pendingEditorPatch.subject = 'Local typing';
    emitMetadataUpdate({ operation: 'locale', values: { subject: 'Peer subject' }, sequence: 2 });
    await flush();

    expect(subject.value).toBe('Local typing');
    expect(api.subjectSave).toHaveBeenCalledOnce();

    delete api.pendingEditorPatch.subject;
    notifySaveStateChanged();
    await flush();

    expect(subject.value).toBe('Peer subject');
    expect(api.subjectSave).toHaveBeenCalledOnce();
  });

  it('stops the mocked test action when pending editor saves fail', async () => {
    routeId = TEMPLATE_ID;
    renderPage(<EmailTemplateEditPage />);
    await flush();

    act(() => findButtonByText('common.actions.sendTest').click());
    await flush();
    const email = document.querySelector('input[type="email"]');
    if (!(email instanceof HTMLInputElement)) {
      throw new Error('Test email input was not rendered.');
    }
    setInputValue(email, 'test@example.test');
    await flush();

    api.flushEditorSaves.mockResolvedValue(false);
    act(() => findButtonByText('common.actions.sendTest', 1).click());
    await flush();

    expect(api.flushEditorSaves).toHaveBeenCalledWith(`email_template:${TEMPLATE_ID}`);
    expect(api.persistCollaborativeDocumentNow).not.toHaveBeenCalled();
    expect(api.sendTestEmailTemplateAction).not.toHaveBeenCalled();
  });

  it('awaits registered saves and provider durability before the mocked test action', async () => {
    routeId = TEMPLATE_ID;
    api.sendTestEmailTemplateAction.mockResolvedValue({ success: true });
    renderPage(<EmailTemplateEditPage />);
    await flush();

    act(() => findButtonByText('common.actions.sendTest').click());
    await flush();
    const email = document.querySelector('input[type="email"]');
    if (!(email instanceof HTMLInputElement)) {
      throw new Error('Test email input was not rendered.');
    }
    setInputValue(email, 'test@example.test');
    await flush();

    act(() => findButtonByText('common.actions.sendTest', 1).click());
    await flush();

    expect(api.flushEditorSaves).toHaveBeenCalledWith(`email_template:${TEMPLATE_ID}`);
    expect(api.persistCollaborativeDocumentNow).toHaveBeenCalledWith(expect.any(Object));
    expect(api.sendTestEmailTemplateAction).toHaveBeenCalledOnce();
    expect(api.flushEditorSaves.mock.invocationCallOrder[0]).toBeLessThan(
      api.persistCollaborativeDocumentNow.mock.invocationCallOrder[0],
    );
    expect(api.persistCollaborativeDocumentNow.mock.invocationCallOrder[0]).toBeLessThan(
      api.sendTestEmailTemplateAction.mock.invocationCallOrder[0],
    );
  });

  it('publishes an email template layout change hint after the asset update succeeds', async () => {
    routeId = TEMPLATE_ID;
    api.listEmailLayoutsSimple.mockResolvedValue([{ id: LAYOUT_ID, key: 'custom-layout', name: 'Custom layout' }]);
    renderPage(<EmailTemplateEditPage />);
    await flush();

    const layout = findInputByLabelText('adminList.emailTemplates.detail.fields.layoutLabel');
    act(() => layout.click());
    await flush();
    const option = [...document.querySelectorAll('[role="option"]')].find((candidate) =>
      candidate.textContent?.includes('Custom layout'),
    );
    if (!(option instanceof HTMLElement)) {
      throw new Error('Email layout option was not rendered.');
    }
    act(() => option.click());
    await flush();

    expect(api.updateEmailTemplateLayoutAction).toHaveBeenCalledWith(TEMPLATE_ID, LAYOUT_ID);
    expect(api.publishEditorEntityChange).toHaveBeenCalledWith(`email_template:${TEMPLATE_ID}`);
  });

  it('refetches full email template metadata when an entity change hint arrives', async () => {
    routeId = TEMPLATE_ID;
    api.listEmailLayoutsSimple.mockResolvedValue([{ id: LAYOUT_ID, key: 'custom-layout', name: 'Custom layout' }]);
    renderPage(<EmailTemplateEditPage />);
    await flush();

    api.getEmailTemplateAction.mockResolvedValue({
      id: TEMPLATE_ID,
      key: 'custom-template',
      name: 'Custom template detail',
      subject: 'Subject',
      layoutId: LAYOUT_ID,
      variables: [],
      isSystem: false,
      isActive: true,
      deliveryRunCount: 12,
      createdAt: new Date('2026-01-01T00:00:00Z'),
    });
    api.entityChangeHandlers.get(`email_template:${TEMPLATE_ID}`)?.();
    await flush();

    expect(api.getEmailTemplateAction).toHaveBeenCalledTimes(2);
    expect(findInputByLabelText('adminList.emailTemplates.detail.fields.layoutLabel').value).toBe('Custom layout');
  });
});
