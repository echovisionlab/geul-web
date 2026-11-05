import { expect, userEvent, within } from 'storybook/test';
import { DEFAULT_LOCALE, normalizeLocale } from '@/lib/i18n/locale';
import { useCallback, useState } from 'react';
import { createTranslator, useTranslations } from 'next-intl';
import { goBackPreview } from '../shared/preview-navigation';
import type { Meta, StoryObj } from '@storybook/nextjs';
import { WorkEditorView, type WorkEditorViewModel } from '@/features/work/WorkEditor/WorkEditor';
import { WorkMetaStateProvider, type WorkMetaContextValue } from '@/lib/contexts/WorkMetaContext';
import { DEFAULT_WORK_META, type WorkMeta } from '@/lib/collab/work-meta';
import { PageLoader } from '@/features/site/PageLoader';
import { DocumentEditorFrame, editorPageParameters, editorStateArgTypes } from './fixtures/DocumentEditorFrame';
import { useDocumentEditor, noop, pending, type EditorPreviewState } from './fixtures/use-document-editor';
function Preview({ state = 'ready' }: { state?: EditorPreviewState }) {
  const local = useDocumentEditor('work', state),
    t = useTranslations('workEditor');
  const [status, setStatus] = useState<WorkEditorViewModel['status']>('draft');
  const [fields, setFields] = useState<WorkMeta>({
    ...DEFAULT_WORK_META,
    type: 'portfolio',
    year: 2026,
    month: 10,
    untilYear: 2026,
    untilMonth: 10,
  });
  const setField = <K extends keyof WorkMeta>(key: K, value: WorkMeta[K]) =>
    setFields((current) => ({ ...current, [key]: value }));
  const setCreditOrder = useCallback<WorkMetaContextValue['setCreditOrder']>(
    (creditOrder) => setFields((current) => ({ ...current, creditOrder })),
    [],
  );
  if (!local.room || !local.session) {
    return <PageLoader />;
  }
  const meta: WorkMetaContextValue = {
    ...fields,
    ...local.connection,
    localeSession: local.localeSession,
    workId: 'local-work',
    title: local.title,
    summary: local.summary,
    slug: local.slug,
    featuredImageUrl: local.featuredImageUrl,
    setTitle: local.setTitle,
    setSummary: local.setSummary,
    setSlug: (value) => local.setSlug(value ?? ''),
    setType: (value) => setField('type', value),
    setYear: (value) => setField('year', value),
    setMonth: (value) => setField('month', value),
    setPeriod: (value) => setFields((current) => ({ ...current, ...value })),
    setMetadata: (value) => setField('metadata', value),
    setFeatured: (value) => setField('featured', value),
    setFeaturedImage: (_id, url) => {
      local.setFeaturedImageUrl(url);
      return true;
    },
    incrementCreditsVersion: () => setField('creditsVersion', fields.creditsVersion + 1),
    setCreditOrder,
    setClients: (value) => setField('clients', value),
  };
  const model: WorkEditorViewModel = {
    currentProvider: local.room.provider,
    workId: 'local-work',
    protocol: null,
    displayedTitle: local.title,
    currentLocaleCanEdit: local.canEdit,
    currentIsSynced: local.connected,
    handleScopedLocaleTitleChange: local.setTitle,
    tCommon: local.tCommon,
    roomLocale: local.locale,
    status,
    lifecycle: {
      isChanging: false,
      controls: {
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
        canDelete: local.canEdit,
      },
      deleteWork: pending,
    },
    currentIsConnected: local.connected,
    handleBack: async () => goBackPreview(),
    canEditNeutral: local.canEdit,
    handleStatusChange: async (value) => setStatus(value),
    handleDelete: local.remove,
    tCommonLabels: local.tCommonLabels,
    setVersionHistoryOpened: local.setVersionsOpened,
    activeEditLocale: local.activeEditLocale,
    ogImage: local.ogImage,
    canEditWork: local.canEdit,
    regenerateOgImage: local.regenerateOgImage,
    ...local.site,
    slug: local.slug,
    slugMgmt: local.slugMgmt,
    updateSlug: pending,
    t,
    isAdmin: false,
    mapPlaceId: null,
    handleMapPlaceChange: noop,
    handleCreatePlaceStart: () => local.setCreatePlaceOpened(true),
    type: fields.type,
    year: fields.year,
    month: fields.month,
    untilYear: fields.untilYear,
    untilMonth: fields.untilMonth,
    isPresent: fields.isPresent,
    metadata: fields.metadata,
    featured: fields.featured,
    handleMetaChange: (value) => setFields((current) => ({ ...current, ...value })),
    displayedSummary: local.summary,
    canEditTranslationSource: local.locale === 'ko' && local.canEdit,
    ...local.identity,
    handleSummaryChange: local.setSummary,
    featuredImageUrl: local.featuredImageUrl,
    initialClientDetails: [],
    blockRoomController: local.room.controller,
    versionHistoryOpened: local.versionsOpened,
    reloadCanonical: noop,
    createPlaceOpened: local.createPlaceOpened,
    setCreatePlaceOpened: local.setCreatePlaceOpened,
    handleCreatePlaceSubmit: () => local.setCreatePlaceOpened(false),
    createPlace: pending,
    createPlaceInitialName: '',
  };
  return (
    <DocumentEditorFrame client={local.client} completed={local.deleted}>
      <WorkMetaStateProvider value={meta}>
        <WorkEditorView model={model} />
      </WorkMetaStateProvider>
    </DocumentEditorFrame>
  );
}
const meta = {
  argTypes: editorStateArgTypes,
  title: 'Pages/Editors/Work',
  component: Preview,
  args: { state: 'ready' },
  parameters: editorPageParameters,
} satisfies Meta<typeof Preview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Ready: Story = {};
export const Disconnected: Story = { args: { state: 'disconnected' } };
export const ReadOnly: Story = { args: { state: 'readonly' } };
export const Phone: Story = { globals: { viewport: { value: 'phone', isRotated: false } } };

export const KeyboardTitleAuthoring: Story = {
  tags: ['a11y-author'],
  play: async ({ canvasElement, globals, step }) => {
    const canvas = within(canvasElement);
    const locale = normalizeLocale(globals.locale) ?? DEFAULT_LOCALE;
    const { default: messages } = await import(`../../messages/${locale}.json`);
    const t = createTranslator({ locale, messages, namespace: 'common' });
    const title = await canvas.findByRole('textbox', { name: t('labels.title') });
    await step('The named title remains reachable and editable by keyboard', async () => {
      for (let index = 0; index < 60 && canvasElement.ownerDocument.activeElement !== title; index += 1) {
        await userEvent.tab();
      }
      await expect(title).toHaveFocus();
      const before = (title as HTMLInputElement).value;
      await userEvent.keyboard('{End} accessible draft');
      await expect(title).toHaveValue(`${before} accessible draft`);
      await expect(title).toHaveAccessibleName(t('labels.title'));
      await userEvent.tab();
      await expect(title).not.toHaveFocus();
      await userEvent.tab({ shift: true });
      await expect(title).toHaveFocus();
    });
  },
};
