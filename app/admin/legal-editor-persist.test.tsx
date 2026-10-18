// @vitest-environment jsdom
import { setProviderAccessLevel } from '@/lib/collab/provider-control-state';

import { create } from '@bufbuild/protobuf';
import { contentBlockCatalogFingerprint } from '@echovisionlab/geul-proto/content/block_catalog.ts';
import {
  LocalizedRichTextDocumentSchema,
  RichTextProfile,
} from '@echovisionlab/geul-proto/content/block_content_pb.ts';
import { act, type ReactElement, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrivacyEditor } from '@/features/policy/PrivacyEditor';
import { TermsEditor } from '@/features/policy/TermsEditor';
import { PRIVACY_STATUS, TERMS_STATUS } from '@/lib/policy-status';
import { flushEditorSaves } from '@/lib/editor/editor-save-registry';

const mocks = vi.hoisted(() => ({
  persistNow: vi.fn(),
  schedulePrivacy: vi.fn(),
  activatePrivacy: vi.fn(),
  scheduleTerms: vi.fn(),
  activateTerms: vi.fn(),
  notifications: vi.fn(),
  routerRefresh: vi.fn(),
  routerPush: vi.fn(),
  provider: { name: 'source-provider' },
  activeLocaleOverride: null as Record<string, unknown> | null,
  richTextController: vi.fn(),
  policyEditor: vi.fn(),
  roomProtocol: {
    updateMetadata: vi.fn(),
    getSnapshot: vi.fn(),
  },
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mocks.routerRefresh, push: mocks.routerPush }),
}));

vi.mock('next-intl', () => ({
  useLocale: () => 'en',
  useTranslations: () => (key: string) => key,
}));

vi.mock('@/components/core/Notification', () => ({
  notifications: { show: mocks.notifications },
}));

vi.mock('@/components/core/Modal', () => ({
  DialogActions: ({ children, leadingActions }: { children?: ReactNode; leadingActions?: ReactNode }) => (
    <div>
      {leadingActions}
      {children}
    </div>
  ),
  ContentModal: ({ opened, children }: { opened: boolean; children?: ReactNode }) =>
    opened ? <div data-testid="modal">{children}</div> : null,
  ConfirmModal: ({ opened, title }: { opened: boolean; title?: ReactNode }) =>
    opened ? <section role="alertdialog">{title}</section> : null,
}));

vi.mock('@/components/core/Alert', () => ({
  Alert: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/core/Badge', () => ({
  LabelBadge: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
}));

vi.mock('@/components/core/Button', () => ({
  Button: ({ children, disabled, onClick }: { children?: ReactNode; disabled?: boolean; onClick?: () => void }) => (
    <button type="button" disabled={disabled} onClick={onClick}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/core/Input', () => ({
  SegmentedControl: () => null,
  DateTimePicker: ({ onChange }: { onChange: (value: string) => void }) => (
    <button type="button" data-testid="set-effective-date" onClick={() => onChange('2030-01-01T00:00:00Z')}>
      Set date
    </button>
  ),
}));

vi.mock('@/features/editor/EditorHeader', () => ({
  EditorHeader: ({
    actionItems,
    onTitleChange,
  }: {
    actionItems: Array<{ key: string; label: string; onClick: () => void }>;
    onTitleChange?: (title: string) => void;
  }) => (
    <header>
      {onTitleChange ? (
        <input
          aria-label="legal title"
          data-testid="legal-title"
          onChange={(event) => onTitleChange(event.currentTarget.value)}
        />
      ) : null}
      {actionItems.map((item) => (
        <button key={item.key} type="button" data-testid={`action-${item.key}`} onClick={item.onClick}>
          {item.label}
        </button>
      ))}
    </header>
  ),
}));

vi.mock('@/features/policy/LegalOgImagePanel', () => ({ LegalOgImagePanel: () => null }));
vi.mock('@/features/policy/LegalRichTextContent', () => ({ LegalRichTextContent: () => null }));
vi.mock('@/features/policy/PolicyEditor/PolicyEditor', () => ({
  PolicyEditor: (props: Record<string, unknown>) => {
    mocks.policyEditor(props);
    return <div data-testid="locale-policy-editor" />;
  },
}));
vi.mock('@/features/share/ShareLinkSection', () => ({ ShareLinkSection: () => null }));
vi.mock('@/features/translation/ActiveEditLocaleContentPreview', () => ({
  ActiveEditLocaleContentPreview: () => <div data-testid="target-api-preview" />,
}));
vi.mock('@/features/translation/EditorActiveLocaleMenu', () => ({ EditorActiveLocaleMenu: () => null }));
vi.mock('@/features/translation/EntityTranslationsPanel', () => ({ EntityTranslationsPanel: () => null }));

vi.mock('@/features/translation/useActiveEditLocale', () => ({
  useActiveEditLocale: ({ sourceTitle }: { sourceTitle: string }) => ({
    sourceLocale: 'en',
    isSourceLocaleReady: true,
    isControlVisible: false,
    isSourceLocale: true,
    hasLiveRow: false,
    activeLocale: 'en',
    activeLocaleLabel: 'English',
    displayTitle: sourceTitle,
    displaySummary: '',
    localeOptions: [],
    setActiveLocale: vi.fn(),
    isLoading: false,
    canEditActiveLocale: true,
    handleTitleChange: vi.fn(),
    contentHtml: '',
    contentPreview: '',
    contentJson: null,
    contentPreviewLoading: false,
    ogGenerationRun: null,
    ...mocks.activeLocaleOverride,
  }),
}));

vi.mock('@/features/editor/hooks/useBlockRoomTiptapController', () => ({
  useRichTextBlockRoomController: (...args: unknown[]) => mocks.richTextController(...args),
}));

vi.mock('@/lib/collab/useBlockRoomConnection', () => ({
  useBlockRoomConnection: () => {
    const locale = String(mocks.activeLocaleOverride?.activeLocale ?? 'en');
    const sourceLocale = 'en';
    return {
      provider: mocks.provider,
      doc: { clientID: 7 },
      bootstrap: {
        sourceLocale,
        locale,
        localeExists: true,
        documentRevision: '11111111-1111-4111-8111-111111111111',
        targetRevision: locale === sourceLocale ? undefined : '22222222-2222-4222-8222-222222222222',
      },
      protocol: mocks.roomProtocol,
      isConnected: true,
      isSynced: true,
      isLoading: false,
      error: null,
      reloadCanonical: vi.fn(),
      acceptEpochAck: vi.fn(() => true),
    };
  },
}));

vi.mock('@/lib/contexts/EditorRuntimeContext', () => ({
  EditorRuntimeProvider: ({ children }: { children?: ReactNode }) => <>{children}</>,
}));

vi.mock('@/lib/collab/persist-now', () => ({
  persistCollaborativeDocumentNow: mocks.persistNow,
}));

vi.mock('@/lib/actions/privacy', () => ({
  activatePrivacyNowAction: mocks.activatePrivacy,
  cancelPrivacyScheduleAction: vi.fn(),
  deletePrivacyVersionAction: vi.fn(),
  regeneratePrivacyHtmlAction: vi.fn(),
  schedulePrivacyAction: mocks.schedulePrivacy,
}));

vi.mock('@/lib/actions/terms', () => ({
  activateTermsNowAction: mocks.activateTerms,
  cancelTermsScheduleAction: vi.fn(),
  deleteTermsVersionAction: vi.fn(),
  regenerateTermsHtmlAction: vi.fn(),
  scheduleTermsAction: mocks.scheduleTerms,
}));

const variants = [
  {
    name: 'PrivacyEditor',
    render: (canEdit = true) => (
      <PrivacyEditor
        initialPrivacy={{
          id: 'privacy-1',
          version: 1,
          title: 'Privacy draft',
          document: null,
          status: PRIVACY_STATUS.DRAFT,
          effectiveFrom: null,
          effectiveUntil: null,
          createdAt: null,
          updatedAt: null,
        }}
        siteSettings={null}
        canEdit={canEdit}
      />
    ),
    schedule: mocks.schedulePrivacy,
    activate: mocks.activatePrivacy,
    documentKey: 'privacy:privacy-1',
  },
  {
    name: 'TermsEditor',
    render: (canEdit = true) => (
      <TermsEditor
        initialTerms={{
          id: 'terms-1',
          version: 1,
          title: 'Terms draft',
          document: null,
          status: TERMS_STATUS.DRAFT,
          effectiveFrom: null,
          effectiveUntil: null,
          createdAt: null,
          updatedAt: null,
        }}
        siteSettings={null}
        canEdit={canEdit}
      />
    ),
    schedule: mocks.scheduleTerms,
    activate: mocks.activateTerms,
    documentKey: 'terms:terms-1',
  },
] satisfies Array<{
  name: string;
  render: (canEdit?: boolean) => ReactElement;
  schedule: ReturnType<typeof vi.fn>;
  activate: ReturnType<typeof vi.fn>;
  documentKey: string;
}>;

describe.each(variants)('$name persist-before-lifecycle boundary', (variant) => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    setProviderAccessLevel(mocks.provider, 'edit');
    vi.clearAllMocks();
    mocks.activeLocaleOverride = null;
    mocks.richTextController.mockReturnValue(null);
    mocks.persistNow.mockRejectedValue(new Error('persist failed'));
    mocks.roomProtocol.updateMetadata.mockResolvedValue({
      documentRevision: '33333333-3333-4333-8333-333333333333',
      changed: true,
      sourceChanged: true,
      changedLocales: ['en'],
      locale: 'en',
    });
    mocks.roomProtocol.getSnapshot.mockImplementation(async () => {
      const locale = String(mocks.activeLocaleOverride?.activeLocale ?? 'en');
      return {
        documentRevision: '33333333-3333-4333-8333-333333333333',
        sourceLocale: 'en',
        locale,
        localeExists: true,
      };
    });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    act(() => {
      root.render(<QueryClientProvider client={queryClient}>{variant.render()}</QueryClientProvider>);
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('upgrades refreshed viewer props and downgrades without replacing the legal body', async () => {
    mocks.richTextController.mockReturnValue({
      extension: {},
      initialContent: {},
      getLocalizedDocumentSnapshot: () =>
        create(LocalizedRichTextDocumentSchema, {
          blockCatalogFingerprint: contentBlockCatalogFingerprint,
          profile: RichTextProfile.POLICY,
          locale: 'en',
          base: { nodes: [] },
          localeOverlay: { locale: 'en', blocks: [] },
        }),
    });
    act(() => setProviderAccessLevel(mocks.provider, 'view'));
    // Mount the room body even while its preview is visible.
    const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    await act(async () =>
      root.render(<QueryClientProvider client={queryClient}>{variant.render(false)}</QueryClientProvider>),
    );
    const body = container.querySelector('[data-testid="locale-policy-editor"]');
    expect(body).not.toBeNull();
    expect(mocks.policyEditor.mock.lastCall?.[0].readOnly).toBe(true);
    act(() => setProviderAccessLevel(mocks.provider, 'edit'));
    expect(mocks.policyEditor.mock.lastCall?.[0].readOnly).toBe(true);
    await act(async () =>
      root.render(<QueryClientProvider client={queryClient}>{variant.render(true)}</QueryClientProvider>),
    );
    expect(mocks.policyEditor.mock.lastCall?.[0].readOnly).toBe(false);
    expect(container.querySelector('[data-testid="locale-policy-editor"]')).toBe(body);
    act(() => setProviderAccessLevel(mocks.provider, 'view'));
    expect(mocks.policyEditor.mock.lastCall?.[0].readOnly).toBe(true);
    expect(container.querySelector('[data-testid="locale-policy-editor"]')).toBe(body);
    expect(container.querySelector('[role="alertdialog"]')).toBeNull();
    expect(container.querySelector('[data-testid="action-schedule"]')).toBeNull();
  });

  it('does not schedule when persist-now fails', async () => {
    act(() => {
      (container.querySelector('[data-testid="action-schedule"]') as HTMLButtonElement).click();
    });
    act(() => {
      (container.querySelector('[data-testid="set-effective-date"]') as HTMLButtonElement).click();
    });
    const submit = Array.from(container.querySelectorAll('[data-testid="modal"] button')).find(
      (button) => button.textContent === 'schedule',
    ) as HTMLButtonElement;

    await act(async () => {
      submit.click();
      await Promise.resolve();
    });

    expect(mocks.persistNow).toHaveBeenCalledWith(mocks.provider);
    expect(variant.schedule).not.toHaveBeenCalled();
  });

  it('does not activate when persist-now fails', async () => {
    act(() => {
      (container.querySelector('[data-testid="action-activate-now"]') as HTMLButtonElement).click();
    });
    const submit = Array.from(container.querySelectorAll('[data-testid="modal"] button')).find(
      (button) => button.textContent === 'activateNow',
    ) as HTMLButtonElement;

    await act(async () => {
      submit.click();
      await Promise.resolve();
    });

    expect(mocks.persistNow).toHaveBeenCalledWith(mocks.provider);
    expect(variant.activate).not.toHaveBeenCalled();
  });

  it('registers the debounced title with the locale/navigation save queue', async () => {
    mocks.persistNow.mockResolvedValue(undefined);
    const title = container.querySelector('[data-testid="legal-title"]') as HTMLInputElement;

    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      setter?.call(title, 'Updated policy title');
      title.dispatchEvent(new Event('input', { bubbles: true }));
    });

    await act(async () => {
      expect(await flushEditorSaves(variant.documentKey)).toBe(true);
    });

    expect(mocks.roomProtocol.updateMetadata).toHaveBeenCalledWith(
      'locale',
      { title: 'Updated policy title' },
      undefined,
    );
  });
});

describe('LegalPolicyEditor archived administration', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    setProviderAccessLevel(mocks.provider, 'edit');
    vi.clearAllMocks();
    mocks.activeLocaleOverride = null;
    mocks.richTextController.mockReturnValue({ id: 'archived-source-controller' });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root.render(
        <QueryClientProvider client={new QueryClient()}>
          <TermsEditor
            initialTerms={{
              id: 'terms-archived',
              version: 1,
              title: 'Archived terms',
              document: null,
              status: TERMS_STATUS.ARCHIVED,
              effectiveFrom: new Date('2026-03-01T00:00:00.000Z'),
              effectiveUntil: new Date('2026-04-01T00:00:00.000Z'),
              createdAt: new Date('2026-02-01T00:00:00.000Z'),
              updatedAt: new Date('2026-04-01T00:00:00.000Z'),
            }}
            siteSettings={null}
            canEdit
          />
        </QueryClientProvider>,
      );
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('keeps the archived source document editable for an admin', () => {
    expect(container.querySelector('[data-testid="locale-policy-editor"]')).not.toBeNull();
    expect(mocks.policyEditor).toHaveBeenCalledWith(
      expect.objectContaining({ readOnly: false, structureLocked: false }),
    );
    expect(container.querySelector('[data-testid="action-regenerate-html"]')).not.toBeNull();
  });
});
