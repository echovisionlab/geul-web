// @vitest-environment jsdom

import { act, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MantineProvider } from '@mantine/core';
import EmailLayoutEditPage from '@/app/admin/email-layouts/[id]/page';
import EmailTemplateEditPage from '@/app/admin/email-templates/[id]/page';

const api = vi.hoisted(() => ({
  getEmailLayout: vi.fn(),
  getEmailTemplateAction: vi.fn(),
  listEmailLayoutsSimple: vi.fn(),
  listEntityTranslations: vi.fn(),
  previewEmailTemplateAction: vi.fn(),
  sendTestEmailTemplateAction: vi.fn(),
  updateEmailLayoutAction: vi.fn(),
  updateEmailTemplateLayoutAction: vi.fn(),
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

vi.mock('@/lib/actions/email-template', () => ({
  getEmailTemplateAction: api.getEmailTemplateAction,
  previewEmailTemplateAction: api.previewEmailTemplateAction,
  sendTestEmailTemplateAction: api.sendTestEmailTemplateAction,
  updateEmailTemplateLayoutAction: api.updateEmailTemplateLayoutAction,
}));

vi.mock('@/lib/actions/email-layout', () => ({
  updateEmailLayoutAction: api.updateEmailLayoutAction,
}));

vi.mock('@/lib/queries/email-layout', () => ({
  getEmailLayout: api.getEmailLayout,
  listEmailLayoutsSimple: api.listEmailLayoutsSimple,
}));

vi.mock('@/lib/api/browser-client', () => ({
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
    bootstrap: {},
    protocol: {},
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
  EditorHeader: ({ title }: { title: string }) => <h1>{title}</h1>,
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
  api.updateEmailLayoutAction.mockResolvedValue({ success: true });
  api.updateEmailTemplateLayoutAction.mockResolvedValue({ success: true });
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
});
