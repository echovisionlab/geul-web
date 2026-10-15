import { useState } from 'react';
import { createTranslator, useTranslations } from 'next-intl';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { DEFAULT_LOCALE, normalizeLocale } from '@/lib/i18n/locale';
import type { Meta, StoryObj } from '@storybook/nextjs';
import { PageEditorView, type PageEditorViewModel } from '@/features/page/PageEditor/PageEditor';
import { PageLoader } from '@/features/site/PageLoader';
import { DocumentEditorFrame, editorPageParameters, editorStateArgTypes } from './fixtures/DocumentEditorFrame';
import { readyQuery } from './fixtures/editor-pages';
import { useDocumentEditor, noop, pending, type EditorPreviewState } from './fixtures/use-document-editor';
function Preview({ state = 'ready' }: { state?: EditorPreviewState }) {
  const local = useDocumentEditor('page', state),
    t = useTranslations('pageEditor');
  const [status, setStatus] = useState<PageEditorViewModel['status']>('draft'),
    [showTitle, setShowTitle] = useState(true);
  const [accessPolicy, setAccessPolicy] = useState<PageEditorViewModel['accessPolicy']>({
    mode: 'public',
    match: 'any',
    roles: [],
    userTagIds: [],
    newsletterSubscriber: false,
  });
  if (!local.room) {
    return <PageLoader />;
  }
  const model: PageEditorViewModel = {
    currentTextProvider: local.room.provider,
    pageId: 'local-page',
    protocol: null,
    accessTags: { ...readyQuery, data: [], isLoading: false },
    displayedTitle: local.title,
    canEditLocaleDocument: local.canEdit,
    handleLocaleTitleChange: local.setTitle,
    tCommon: local.tCommon,
    status,
    pageStatusOptions: [
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
    currentIsConnected: local.connected,
    currentIsSynced: local.connected,
    navigateWithSave: async (navigation) => {
      await navigation();
      return true;
    },
    router: local.router,
    canEditNeutral: local.canEdit,
    handleStatusChange: async (value) => setStatus(value),
    deletePage: local.deleteMutation,
    publish: pending,
    unpublish: pending,
    tCommonLabels: local.tCommonLabels,
    openVersionHistory: () => local.setVersionsOpened(true),
    activeEditLocale: local.activeEditLocale,
    ...local.site,
    slug: local.slug,
    slugMgmt: local.slugMgmt,
    slugError: undefined,
    updateSlug: pending,
    setSlugMutationErrorReason: noop,
    t,
    canManageTranslations: local.canEdit,
    canMutate: local.canEdit,
    showTitle,
    handleShowTitleChange: setShowTitle,
    layout: local.layout,
    handleLayoutChange: local.setLayout,
    tLayout: local.tLayout,
    displayedSummary: local.summary,
    roomLocale: local.locale,
    provider: local.room.provider,
    doc: local.room.document,
    ...local.identity,
    handleLocaleSummaryChange: local.setSummary,
    accessPolicy,
    handleAccessSave: async (value) => {
      setAccessPolicy(value);
      return { ok: true, accessPolicy: value };
    },
    ogImage: local.ogImage,
    featuredImageUrl: local.featuredImageUrl,
    ogRegenerationLocale: local.locale,
    regenerateOgImage: local.regenerateOgImage,
    setFeaturedImageUrl: local.setFeaturedImageUrl,
    durabilityProtocol: local.room.protocol,
    isSynced: true,
    versionHistoryOpened: local.versionsOpened,
    closeVersionHistory: () => local.setVersionsOpened(false),
    reloadCanonical: noop,
    permissionRevocation: { interruption: null },
  };
  return (
    <DocumentEditorFrame client={local.client} completed={local.deleted}>
      <PageEditorView model={model} />
    </DocumentEditorFrame>
  );
}
const meta = {
  argTypes: editorStateArgTypes,
  title: 'Pages/Editors/Page',
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

async function keyboardReach(canvasElement: HTMLElement, target: HTMLElement) {
  const user = userEvent.setup({ document: canvasElement.ownerDocument });
  for (let index = 0; index < 140 && canvasElement.ownerDocument.activeElement !== target; index += 1) {
    await user.tab();
  }
  await expect(target).toHaveFocus();
}

export const KeyboardSectionAuthoring: Story = {
  tags: ['a11y-author'],
  play: async ({ canvasElement, globals, step }) => {
    const canvas = within(canvasElement);
    const locale = normalizeLocale(globals.locale) ?? DEFAULT_LOCALE;
    const { default: messages } = await import(`../../messages/${locale}.json`);
    const t = createTranslator({ locale, messages, namespace: 'pageEditor' });
    const common = createTranslator({ locale, messages, namespace: 'common' });
    const textLabel = t('sectionTypes.richText');
    const columnsLabel = t('sectionTypes.columns');
    const title = await canvas.findByRole('textbox', { name: common('labels.title') });
    const first = await canvas.findByRole('group', { name: textLabel });
    // Rich-text and columns sections start expanded so their SSR body stays visible through the handoff.
    const toggle = within(first).getByRole('button', {
      name: t('sectionItem.actions.collapse', { section: textLabel }),
    });
    await step(
      'Section names, positions and disclosure relationships preserve the authored reading order',
      async () => {
        await expect(first).toHaveAccessibleDescription(
          t('a11y.sectionPosition', { section: textLabel, index: 1, count: 1 }),
        );
        await expect(Boolean(title.compareDocumentPosition(first) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
        await expect(toggle).toHaveAttribute('aria-expanded', 'true');
        const panel = canvasElement.ownerDocument.getElementById(toggle.getAttribute('aria-controls')!);
        await expect(panel).toHaveAccessibleName(t('a11y.sectionPosition', { section: textLabel, index: 1, count: 1 }));
        // The disclosure still collapses and reopens from the keyboard.
        await keyboardReach(canvasElement, toggle);
        await userEvent.keyboard('{Enter}');
        await expect(toggle).toHaveAttribute('aria-expanded', 'false');
        await expect(toggle).toHaveAccessibleName(t('sectionItem.actions.expand', { section: textLabel }));
        await userEvent.keyboard('{Enter}');
        await expect(toggle).toHaveAttribute('aria-expanded', 'true');
      },
    );
    await step('Author adds a column section and receives focus at its structural control', async () => {
      const add = canvas.getByRole('button', { name: t('columnsEditor.menuLabel') });
      await keyboardReach(canvasElement, add);
      await userEvent.keyboard('{Enter}');
      const menu = within(canvasElement.ownerDocument.body);
      const firstItem = await menu.findByRole('menuitem', { name: textLabel });
      await expect(firstItem).toHaveFocus();
      await userEvent.keyboard('{ArrowDown}{Enter}');
      const columns = await canvas.findByRole('group', { name: columnsLabel });
      const columnToggle = within(columns).getByRole('button', {
        name: t('sectionItem.actions.collapse', { section: columnsLabel }),
      });
      // SectionList restores structural focus on the frame after the section commit.
      await waitFor(() => expect(columnToggle).toHaveFocus());
      await expect(columns).toHaveAccessibleDescription(
        t('a11y.sectionPosition', { section: columnsLabel, index: 2, count: 2 }),
      );
    });
    await step('Deleting the added section restores focus to the surviving section', async () => {
      const columns = canvas.getByRole('group', { name: columnsLabel });
      const remove = within(columns).getByRole('button', {
        name: t('sectionItem.actions.delete', { section: columnsLabel }),
      });
      await keyboardReach(canvasElement, remove);
      await userEvent.keyboard('{Enter}');
      await expect(canvas.queryByRole('group', { name: columnsLabel })).not.toBeInTheDocument();
      await waitFor(() => expect(toggle).toHaveFocus());
      await expect(first).toHaveAccessibleDescription(
        t('a11y.sectionPosition', { section: textLabel, index: 1, count: 1 }),
      );
    });
  },
};
