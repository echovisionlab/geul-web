import { downloadMarkdown } from '@/lib/utils/export';
import { useEffect, useMemo, useState } from 'react';
import { createTranslator, useTranslations } from 'next-intl';
import { DEFAULT_LOCALE, normalizeLocale } from '@/lib/i18n/locale';
import { goBackPreview } from '../shared/preview-navigation';
import type { Meta, StoryObj } from '@storybook/nextjs';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { AuthoringExtensionsProvider } from '@/features/authoring/AuthoringExtensionsContext';
import { TranslationServicesProvider } from '@/features/translation/TranslationServicesContext';
import { EditorMediaServicesProvider } from '@/features/editor/contexts/EditorMediaServicesContext';
import { AppNotificationRegion } from '@/lib/providers/AppNotificationRegion';
import { EditorNavigationProvider } from '@/lib/providers/EditorNavigationProvider';
import { useEditorAccessLevel } from '@/features/editor/useEditorAccessLevel';
import { setProviderAccessLevel } from '@/lib/collab/provider-control-state';
import { authorTranslationFixture, type AuthorTranslationState } from './fixtures/author-translations';
import { authorMediaFixture, type AuthorMediaState } from './fixtures/author-media';
import { PostEditorView, type PostEditorViewModel } from '@/features/post/PostEditor/PostEditor';
import { PostMetaStateProvider, type PostMetaContextValue } from '@/lib/contexts/PostMetaContext';
import { PageLoader } from '@/features/site/PageLoader';
import { DocumentEditorFrame, editorPageParameters, editorStateArgTypes } from './fixtures/DocumentEditorFrame';
import { useDocumentEditor, noop, pending, type EditorPreviewState } from './fixtures/use-document-editor';
// The room provider of the access scenario stories, for their play functions.
let accessScenarioProvider: object | null = null;
const previewOgImage = `data:image/svg+xml;charset=utf-8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><rect width="1200" height="630" fill="#202020"/><text x="80" y="330" fill="white" font-family="sans-serif" font-size="72">Post editor preview</text><text x="800" y="560" fill="#b02d23" font-family="sans-serif" font-weight="bold" font-size="64">Rawsector</text></svg>')}`;
function Preview({
  state = 'ready',
  zen = false,
  withImages = false,
  translationState = 'ready',
  mediaState = 'ready',
  followRoomAccess = false,
}: {
  state?: EditorPreviewState;
  /** Edit authority follows the room's reported access level (room.access_changed), as in PostEditor. */
  followRoomAccess?: boolean;
  zen?: boolean;
  withImages?: boolean;
  translationState?: AuthorTranslationState;
  mediaState?: AuthorMediaState;
}) {
  const local = useDocumentEditor('post', state),
    t = useTranslations('postEditor');
  const roomAccess = useEditorAccessLevel(local.room?.provider);
  const canEdit = local.canEdit && (!followRoomAccess || roomAccess === 'edit');
  useEffect(() => {
    accessScenarioProvider = followRoomAccess ? (local.room?.provider ?? null) : null;
  }, [followRoomAccess, local.room?.provider]);
  const translation = useMemo(() => authorTranslationFixture(translationState), [translationState]);
  const media = useMemo(() => authorMediaFixture(mediaState), [mediaState]);
  useEffect(() => translation.seed(local.client), [translation, local.client]);
  const translationServices = useMemo(
    () => ({ ...translation.services, openLocale: local.setLocale }),
    [translation, local.setLocale],
  );
  const [status, setStatus] = useState<PostEditorViewModel['status']>('draft'),
    [isZenMode, setIsZenMode] = useState(zen);
  const [commentsEnabled, setCommentsEnabled] = useState(true),
    [categoryIds, setCategoryIds] = useState<string[]>([]),
    [tagIds, setTagIds] = useState<string[]>([]);
  const [scheduleOpened, setScheduleOpened] = useState(false),
    [participantsOpened, setParticipantsOpened] = useState(false);
  const [scheduledAt, setScheduledAt] = useState<string | null>(null),
    [scheduledTimeZone, setScheduledTimeZone] = useState<string | null>(null);
  if (!local.room || !local.session) {
    return <PageLoader />;
  }
  const meta: PostMetaContextValue = {
    ...local.connection,
    localeSession: local.localeSession,
    sourceTitle: local.title,
    sourceSummary: local.summary,
    setSourceTitle: local.setTitle,
    setSourceSummary: local.setSummary,
    slug: local.slug,
    setSlug: (value) => local.setSlug(value ?? ''),
    categoryIds,
    setCategoryIds,
    tagIds,
    setTagIds,
    commentsEnabled,
    setCommentsEnabled,
    featuredImageUrl: local.featuredImageUrl ?? (withImages ? '/storybook/media/video-poster.jpg' : null),
    setFeaturedImage: (_id, url) => {
      local.setFeaturedImageUrl(url);
      return true;
    },
    layout: local.layout,
    setLayout: local.setLayout,
  };
  const model: PostEditorViewModel = {
    currentProvider: local.room.provider,
    protocol: null,
    postId: 'local-post',
    isZenMode,
    displayedTitle: local.title,
    canEditLocaleDocument: canEdit,
    handleScopedLocaleTitleChange: local.setTitle,
    status,
    lifecycle: {
      statusOptions: [
        {
          value: 'draft',
          label: local.tCommon('statuses.draft'),
          actionLabel: local.tCommon('actions.unpublish'),
          tone: 'neutral',
        },
        {
          value: 'published',
          label: local.tCommon('statuses.published'),
          actionLabel: local.tCommon('actions.publish'),
          tone: 'positive',
        },
      ],
      isChanging: false,
      changeStatus: setStatus,
      deletePost: local.deleteMutation,
      schedule: {
        isPending: false,
        mutate: (schedule) => {
          setScheduledAt(schedule.instant.toISOString());
          setScheduledTimeZone(schedule.timeZone);
          setStatus('scheduled');
          setScheduleOpened(false);
        },
      },
    },
    currentIsConnected: local.connected,
    currentIsSynced: local.connected,
    activeEditLocale: local.activeEditLocale,
    scheduledAt,
    scheduledTimeZone,
    handleBack: async () => goBackPreview(),
    canDelete: canEdit,
    canViewVersions: false,
    openVersionHistory: () => local.setVersionsOpened(true),
    hasParticipantActions: false,
    openParticipants: () => setParticipantsOpened(true),
    canSchedule: canEdit,
    openSchedule: () => setScheduleOpened(true),
    handleExportMarkdown: async () =>
      downloadMarkdown(local.title, `# ${local.title}\n\n${local.room?.controller?.getText() ?? ''}`),
    setIsZenMode,
    showEditorChrome: !isZenMode,
    ...local.site,
    slug: local.slug,
    slugMgmt: local.slugMgmt,
    postConfigUpdate: pending,
    canMutateSourceDocument: canEdit && local.locale === 'ko',
    canManageShareLinks: false,
    t,
    shareLinks: [],
    canMutateContent: canEdit,
    ogImage: withImages ? { ...local.ogImage, src: previewOgImage, status: 'ready' } : local.ogImage,
    ogRegenerationLocale: local.locale,
    regenerateOgImage: local.regenerateOgImage,
    tCommonLabels: local.tCommonLabels,
    commentsEnabled,
    handleCommentsEnabledChange: setCommentsEnabled,
    layout: local.layout,
    handleLayoutChange: local.setLayout,
    tLayout: local.tLayout,
    displayedSummary: local.summary,
    editorAiTarget: undefined,
    currentDoc: local.room.document,
    ...local.identity,
    handleScopedLocaleSummaryChange: local.setSummary,
    featuredImageUrl: local.featuredImageUrl ?? (withImages ? '/storybook/media/video-poster.jpg' : null),
    canEditSharedTaxonomy: canEdit && local.locale === 'ko',
    isAdmin: false,
    categories: [],
    tags: [],
    initialSeriesId: null,
    initialSeriesOrder: null,
    series: [],
    permissionRevocation: { revoke: noop, revoked: false, sessionExpired: false },
    mapPlaceId: null,
    handleMapPlaceChange: noop,
    handleCreatePlaceStart: () => local.setCreatePlaceOpened(true),
    bodyMode: 'locale-editor',
    editorSession: local.session,
    tCommon: local.tCommon,
    bodyPreviewLoading: false,
    participantsOpened,
    closeParticipants: () => setParticipantsOpened(false),
    canAddAuthor: false,
    canRemoveAuthor: false,
    canManageCollaborators: false,
    versionHistoryOpened: local.versionsOpened,
    closeVersionHistory: () => local.setVersionsOpened(false),
    canRestoreCurrentVersion: false,
    reloadCanonical: noop,
    scheduleOpened,
    closeSchedule: () => setScheduleOpened(false),
    createPlaceOpened: local.createPlaceOpened,
    closeCreatePlace: () => local.setCreatePlaceOpened(false),
    handleCreatePlaceSubmit: () => local.setCreatePlaceOpened(false),
    createPlace: pending,
    createPlaceInitialName: '',
  };
  return (
    <DocumentEditorFrame client={local.client} completed={local.deleted}>
      <AuthoringExtensionsProvider
        available={{ sharing: false, translations: true, relations: false, uploads: false, generation: false }}
      >
        <TranslationServicesProvider services={translationServices}>
          <EditorMediaServicesProvider services={media}>
            <PostMetaStateProvider value={meta}>
              {followRoomAccess ? (
                <EditorNavigationProvider>
                  <PostEditorView model={model} />
                </EditorNavigationProvider>
              ) : (
                <PostEditorView model={model} />
              )}
              <AppNotificationRegion />
            </PostMetaStateProvider>
          </EditorMediaServicesProvider>
        </TranslationServicesProvider>
      </AuthoringExtensionsProvider>
    </DocumentEditorFrame>
  );
}
const meta = {
  argTypes: {
    ...editorStateArgTypes,
    translationState: {
      control: 'select',
      options: [
        'ready',
        'loading',
        'load-error',
        'request-error',
        'queued',
        'running',
        'completed',
        'generation-disabled',
      ],
    },
    mediaState: {
      control: 'select',
      options: ['ready', 'upload-error', 'library-loading', 'library-error', 'library-empty'],
    },
  },
  title: 'Pages/Editors/Post',
  component: Preview,
  args: { state: 'ready', zen: false, withImages: false, translationState: 'ready', mediaState: 'ready' },
  parameters: editorPageParameters,
} satisfies Meta<typeof Preview>;
export default meta;
type Story = StoryObj<typeof meta>;
async function scenarioTranslations(globals: Record<string, unknown>) {
  const locale = normalizeLocale(typeof globals.locale === 'string' ? globals.locale : undefined) ?? DEFAULT_LOCALE;
  const { default: messages } = await import(`../../messages/${locale}.json`);
  return createTranslator({ locale, messages });
}

async function reachWithKeyboard(canvasElement: HTMLElement, element: HTMLElement) {
  for (let index = 0; index < 100 && canvasElement.ownerDocument.activeElement !== element; index += 1) {
    await userEvent.tab();
  }
  await expect(element).toHaveFocus();
}

async function openTranslations(canvasElement: HTMLElement, globals: Record<string, unknown>) {
  const canvas = within(canvasElement);
  const t = await scenarioTranslations(globals);
  await canvas.findByRole('textbox', { name: t('common.labels.body') });
  const settings = canvas.queryByRole('tab', { name: t('common.labels.settings') });
  if (settings) {
    await reachWithKeyboard(canvasElement, canvas.getByRole('tab', { name: t('common.labels.body') }));
    await userEvent.keyboard('{ArrowRight}');
    await expect(settings).toHaveAttribute('aria-selected', 'true');
  }
  const toggle = await waitFor(() => {
    const element = canvasElement.querySelector<HTMLElement>('#entity-translations-panel-toggle');
    expect(element).not.toBeNull();
    return element!;
  });
  await reachWithKeyboard(canvasElement, toggle);
  await userEvent.keyboard('{Enter}');
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  return { canvas, t };
}

export const Ready: Story = {};
export const KeyboardAuthoring: Story = {
  tags: ['a11y-author'],
  play: async ({ canvasElement, globals, step }) => {
    const canvas = within(canvasElement);
    const locale = normalizeLocale(globals.locale) ?? DEFAULT_LOCALE;
    const { default: messages } = await import(`../../messages/${locale}.json`);
    const t = createTranslator({ locale, messages, namespace: 'common' });
    const body = await canvas.findByRole('textbox', { name: t('labels.body') });
    const title = canvas.getByRole('textbox', { name: t('labels.title') });

    await step('Author locates correctly named title and body in document order', async () => {
      await expect(title).toHaveValue('밤의 기록');
      await expect(body).toHaveAttribute('contenteditable', 'true');
      await expect(body).toHaveAttribute('aria-multiline', 'true');
      // Reading order is a separate contract from keyboard focus order.
      await expect(Boolean(title.compareDocumentPosition(body) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
      // Authored language is independent of the interface language.
      await expect(body).toHaveAttribute('lang', 'ko');
    });
    await step('Author reaches navigation, title, then body through the keyboard', async () => {
      await userEvent.tab();
      await expect(canvas.getByRole('button', { name: t('actions.back') })).toHaveFocus();
      await userEvent.tab();
      await expect(title).toHaveFocus();
      // Other header commands and the body tab precede the editing surface.
      // The bound detects traps; reaching the body alone does not certify those commands.
      for (let index = 0; index < 60 && canvasElement.ownerDocument.activeElement !== body; index += 1) {
        await userEvent.tab();
      }
      await expect(body).toHaveFocus();
    });
    await step('Author writes paragraphs without losing field identity', async () => {
      await userEvent.keyboard('{Enter}Accessible author draft.{Enter}Second paragraph.');
      await expect(body).toHaveTextContent('Accessible author draft.');
      await expect(body).toHaveTextContent('Second paragraph.');
      await expect(body).toHaveAccessibleName(t('labels.body'));
      await expect(body).toHaveFocus();
    });
    await step('Author can leave the editor and return without losing text', async () => {
      await userEvent.tab();
      await expect(body).not.toHaveFocus();
      await userEvent.tab({ shift: true });
      await expect(body).toHaveFocus();
      await expect(body).toHaveTextContent('Accessible author draft.');
      await expect(body).toHaveTextContent('Second paragraph.');
    });
  },
};
export const Zen: Story = { args: { zen: true } };
export const Disconnected: Story = { args: { state: 'disconnected' } };
export const ReadOnly: Story = {
  args: { state: 'readonly' },
  tags: ['a11y-author'],
  play: async ({ canvasElement, globals, step }) => {
    const canvas = within(canvasElement);
    const locale = normalizeLocale(globals.locale) ?? DEFAULT_LOCALE;
    const { default: messages } = await import(`../../messages/${locale}.json`);
    const t = createTranslator({ locale, messages, namespace: 'common' });
    const body = await canvas.findByRole('document', { name: t('labels.body') });
    await step('Read-only post exposes a title and readable document without an editing field', async () => {
      const title = canvas.getByRole('heading', { name: '밤의 기록', level: 1 });
      await expect(body).toHaveAttribute('contenteditable', 'false');
      await expect(body).not.toHaveAttribute('aria-multiline');
      await expect(body).toHaveAttribute('lang', 'ko');
      await expect(Boolean(title.compareDocumentPosition(body) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
      await expect(canvas.queryByRole('textbox', { name: t('labels.body') })).not.toBeInTheDocument();
      await expect(canvas.queryByRole('textbox', { name: t('labels.title') })).not.toBeInTheDocument();
    });
  },
};
async function changeRoomAccess(access: 'view' | 'edit') {
  const provider = await waitFor(() => {
    expect(accessScenarioProvider).not.toBeNull();
    return accessScenarioProvider!;
  });
  setProviderAccessLevel(provider, access);
}
/** Downgraded to view while open: the body turns read-only in place and a notice explains why. */
export const DowngradedInPlace: Story = {
  args: { followRoomAccess: true },
  play: async ({ canvasElement, globals, step }) => {
    const canvas = within(canvasElement);
    const page = within(canvasElement.ownerDocument.body);
    const t = await scenarioTranslations(globals);
    await canvas.findByRole('textbox', { name: t('common.labels.body') });
    await step('The room reports view access', () => changeRoomAccess('view'));
    await expect(await page.findByText(t('editorCommon.accessDowngraded.message'))).toBeInTheDocument();
    const body = await canvas.findByRole('document', { name: t('common.labels.body') });
    await expect(body).toHaveAttribute('contenteditable', 'false');
  },
};
/** Granted edit access while open: the same editor becomes editable without a reload. */
export const UpgradedInPlace: Story = {
  args: { followRoomAccess: true },
  play: async ({ canvasElement, globals, step }) => {
    const canvas = within(canvasElement);
    const page = within(canvasElement.ownerDocument.body);
    const t = await scenarioTranslations(globals);
    await canvas.findByRole('textbox', { name: t('common.labels.body') });
    await step('The room reports view access', () => changeRoomAccess('view'));
    await canvas.findByRole('document', { name: t('common.labels.body') });
    await step('The room reports edit access again', () => changeRoomAccess('edit'));
    await expect(await page.findByText(t('editorCommon.accessUpgraded.message'))).toBeInTheDocument();
    const body = await canvas.findByRole('textbox', { name: t('common.labels.body') });
    await expect(body).toHaveAttribute('contenteditable', 'true');
  },
};
export const Phone: Story = { globals: { viewport: { value: 'phone', isRotated: false } } };
export const WithImages: Story = { args: { withImages: true } };
export const PhoneWithImages: Story = {
  args: { withImages: true },
  globals: { viewport: { value: 'phone', isRotated: false } },
};
export const TabletWithImages: Story = {
  args: { withImages: true },
  globals: { viewport: { value: 'tablet', isRotated: false } },
};
export const DesktopWithImages: Story = {
  args: { withImages: true },
  globals: { viewport: { value: 'desktop', isRotated: false } },
};

export const TranslationLoading: Story = { args: { translationState: 'loading' } };
export const TranslationLoadError: Story = {
  args: { translationState: 'load-error' },
  tags: ['a11y-author'],
  play: async ({ canvasElement, globals, step }) => {
    const { canvas, t } = await openTranslations(canvasElement, globals);
    await step('Translation load failure remains readable in the post settings', async () => {
      await expect(await canvas.findByRole('alert')).toHaveTextContent(t('translationPanel.states.loadFailed'));
    });
  },
};
export const TranslationQueued: Story = { args: { translationState: 'queued' } };
export const TranslationRunning: Story = { args: { translationState: 'running' } };
export const TranslationCompleted: Story = { args: { translationState: 'completed' } };
export const TranslationUnavailable: Story = {
  args: { translationState: 'generation-disabled' },
  tags: ['a11y-author'],
  play: async ({ canvasElement, globals, step }) => {
    const { canvas, t } = await openTranslations(canvasElement, globals);
    await step('Unavailable generation cannot submit a translation request', async () => {
      await expect(
        canvas.getByRole('button', { name: t('translationPanel.actions.generateLocaleAria', { locale: 'English' }) }),
      ).toBeDisabled();
    });
  },
};
export const RequestTranslation: Story = {
  tags: ['a11y-author'],
  play: async ({ canvasElement, globals, step }) => {
    const { canvas, t } = await openTranslations(canvasElement, globals);
    const row = await canvas.findByTestId('translation-locale-row-en');
    const generate = within(row).getByRole('button', {
      name: t('translationPanel.actions.generateLocaleAria', { locale: 'English' }),
    });
    await step('Author requests the named English translation', async () => {
      await reachWithKeyboard(canvasElement, generate);
      await userEvent.keyboard('{Enter}');
      await waitFor(() => expect(within(row).getByRole('status')).toHaveTextContent(t('common.statuses.queued')));
    });
    await step('Queued and running states identify the language and keep its active command reachable', async () => {
      await waitFor(() => expect(within(row).getByRole('status')).toHaveTextContent(t('common.statuses.running')), {
        timeout: 6000,
      });
      await expect(within(row).getByRole('button', { name: `${t('common.actions.cancel')}: English` })).toHaveFocus();
    });
    await step('Completion exposes an editable target, and returning preserves source text', async () => {
      await waitFor(
        () => {
          const status = within(row).getByRole('status');
          expect(status).toHaveTextContent('English');
          expect(status).not.toHaveTextContent(t('translationPanel.states.missingTarget'));
          expect(
            within(row).getByRole('button', {
              name: t('translationPanel.actions.regenerateLocaleAria', { locale: 'English' }),
            }),
          ).toBeEnabled();
          expect(within(row).queryByRole('button', { name: `${t('common.actions.cancel')}: English` })).toBeNull();
        },
        { timeout: 7000 },
      );
      const edit = within(row).getByRole('button', { name: `${t('common.actions.edit')}: English` });
      await reachWithKeyboard(canvasElement, edit);
      await userEvent.keyboard('{Enter}');
      const bodyTab = canvas.queryByRole('tab', { name: t('common.labels.body') });
      if (bodyTab) {
        await reachWithKeyboard(canvasElement, canvas.getByRole('tab', { name: t('common.labels.settings') }));
        await userEvent.keyboard('{ArrowLeft}');
      }
      const body = await canvas.findByRole('textbox', { name: t('common.labels.body') });
      await waitFor(() => expect(body).toHaveAttribute('lang', 'en'));
      await reachWithKeyboard(canvasElement, body);
      await userEvent.keyboard('Edited translation. ');
      await expect(body).toHaveTextContent('Edited translation.');
    });
  },
};
export const TranslationRequestRecovery: Story = {
  args: { translationState: 'request-error' },
  tags: ['a11y-author'],
  play: async ({ canvasElement, globals, step }) => {
    const { canvas, t } = await openTranslations(canvasElement, globals);
    const generate = await canvas.findByRole('button', {
      name: t('translationPanel.actions.generateLocaleAria', { locale: 'English' }),
    });
    await step('Failed request gives an error and leaves the target available for retry', async () => {
      await reachWithKeyboard(canvasElement, generate);
      await userEvent.keyboard('{Enter}');
      await expect(
        await within(canvasElement.ownerDocument.body).findByText(t('translationPanel.notifications.regenerateFailed')),
      ).toBeVisible();
      await waitFor(() => expect(generate).toBeEnabled());
      await expect(generate).toHaveFocus();
      await userEvent.keyboard('{Enter}');
      await waitFor(() =>
        expect(within(canvas.getByTestId('translation-locale-row-en')).getByRole('status')).toHaveTextContent(
          t('common.statuses.queued'),
        ),
      );
    });
  },
};
export const CancelTranslation: Story = {
  args: { translationState: 'queued' },
  tags: ['a11y-author'],
  play: async ({ canvasElement, globals, step }) => {
    const { canvas, t } = await openTranslations(canvasElement, globals);
    const row = await canvas.findByTestId('translation-locale-row-en');
    await step('Author cancels the English job and can request it again', async () => {
      const cancel = within(row).getByRole('button', { name: `${t('common.actions.cancel')}: English` });
      await reachWithKeyboard(canvasElement, cancel);
      await userEvent.keyboard('{Enter}');
      await waitFor(() =>
        expect(
          within(row).queryByRole('button', { name: `${t('common.actions.cancel')}: English` }),
        ).not.toBeInTheDocument(),
      );
      await expect(
        within(row).getByRole('button', {
          name: t('translationPanel.actions.generateLocaleAria', { locale: 'English' }),
        }),
      ).toBeEnabled();
      await expect(
        within(row).getByRole('button', {
          name: t('translationPanel.actions.generateLocaleAria', { locale: 'English' }),
        }),
      ).toHaveFocus();
    });
  },
};
