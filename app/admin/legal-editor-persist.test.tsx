// @vitest-environment jsdom

import { act, type ReactElement, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrivacyEditor } from '@/features/policy/PrivacyEditor';
import { TermsEditor } from '@/features/policy/TermsEditor';
import { PRIVACY_STATUS, TERMS_STATUS } from '@/lib/policy-status';

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
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mocks.routerRefresh, push: mocks.routerPush }),
}));

vi.mock('next-intl', () => ({
  useLocale: () => 'en',
  useTranslations: () => (key: string) => key,
}));

vi.mock('@mantine/notifications', () => ({
  notifications: { show: mocks.notifications },
}));

vi.mock('@mantine/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@mantine/core')>();
  return {
    ...actual,
    Box: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    Divider: () => <hr />,
    Group: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    Modal: ({ opened, title, children }: { opened: boolean; title?: ReactNode; children?: ReactNode }) =>
      opened ? (
        <section data-testid="modal">
          <h2>{title}</h2>
          {children}
        </section>
      ) : null,
    Stack: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    Text: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
    Title: ({ children }: { children?: ReactNode }) => <h1>{children}</h1>,
  };
});

vi.mock('@mantine/dates', () => ({
  DateTimePicker: ({ onChange }: { onChange: (value: string | null) => void }) => (
    <button type="button" data-testid="set-effective-date" onClick={() => onChange('2026-09-01T00:00:00.000Z')}>
      set date
    </button>
  ),
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
}));

vi.mock('@/features/editor/EditorHeader', () => ({
  EditorHeader: ({ actionItems }: { actionItems: Array<{ key: string; label: string; onClick: () => void }> }) => (
    <header>
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
      doc: null,
      bootstrap: {
        sourceLocale,
        locale,
        localeExists: true,
        documentRevision: '11111111-1111-4111-8111-111111111111',
        targetRevision: locale === sourceLocale ? undefined : '22222222-2222-4222-8222-222222222222',
      },
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
    render: () => (
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
        canEdit
      />
    ),
    schedule: mocks.schedulePrivacy,
    activate: mocks.activatePrivacy,
  },
  {
    name: 'TermsEditor',
    render: () => (
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
        canEdit
      />
    ),
    schedule: mocks.scheduleTerms,
    activate: mocks.activateTerms,
  },
] satisfies Array<{
  name: string;
  render: () => ReactElement;
  schedule: ReturnType<typeof vi.fn>;
  activate: ReturnType<typeof vi.fn>;
}>;

describe.each(variants)('$name persist-before-lifecycle boundary', (variant) => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.activeLocaleOverride = null;
    mocks.richTextController.mockReturnValue(null);
    mocks.persistNow.mockRejectedValue(new Error('persist failed'));
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
});

describe('LegalPolicyEditor target locale collaboration', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.richTextController.mockReturnValue({ id: 'target-controller' });
    mocks.activeLocaleOverride = {
      isControlVisible: true,
      isSourceLocale: false,
      isSourceLocaleReady: true,
      hasLiveRow: true,
      activeLocale: 'ko',
      activeLocaleLabel: '한국어',
      displayTitle: '번역 약관',
      contentPreview: '번역 본문',
      contentPreviewLoading: false,
      canEditActiveLocale: true,
    };
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root.render(
        <QueryClientProvider client={new QueryClient()}>
          <TermsEditor
            initialTerms={{
              id: 'terms-target-preview',
              version: 1,
              title: 'Terms source',
              document: null,
              status: TERMS_STATUS.DRAFT,
              effectiveFrom: null,
              effectiveUntil: null,
              createdAt: null,
              updatedAt: null,
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
    mocks.activeLocaleOverride = null;
  });

  it('renders the existing target room as localized-editable with neutral structure locked', () => {
    expect(container.querySelector('[data-testid="target-api-preview"]')).toBeNull();
    expect(container.querySelector('[data-testid="locale-policy-editor"]')).not.toBeNull();
    expect(mocks.richTextController).toHaveBeenCalledWith('terms-history', null, 'ko');
    expect(mocks.policyEditor).toHaveBeenCalledWith(
      expect.objectContaining({ readOnly: false, structureLocked: true }),
    );
    expect(container.textContent).toContain('참고 번역이며 원문이 우선합니다');
  });
});

describe('LegalPolicyEditor archived administration', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
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
