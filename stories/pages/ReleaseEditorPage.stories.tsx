import { expect, userEvent, within } from 'storybook/test';
import { DEFAULT_LOCALE, normalizeLocale } from '@/lib/i18n/locale';
import { useState } from 'react';
import { createTranslator, useTranslations } from 'next-intl';
import type { Meta, StoryObj } from '@storybook/nextjs';
import { ReleaseEditorView, type ReleaseEditorViewModel } from '@/features/release/ReleaseEditor/ReleaseEditor';
import { PageLoader } from '@/features/site/PageLoader';
import { DocumentEditorFrame, editorPageParameters, editorStateArgTypes } from './fixtures/DocumentEditorFrame';
import { useDocumentEditor, noop, pending, type EditorPreviewState } from './fixtures/use-document-editor';
function Preview({ state = 'ready' }: { state?: EditorPreviewState }) {
  const local = useDocumentEditor('release', state),
    t = useTranslations('releaseEditor'),
    tActions = useTranslations('common.actions'),
    tStates = useTranslations('common.states'),
    tTypes = useTranslations('releasePage.types');
  const [status, setStatus] = useState<ReleaseEditorViewModel['status']>('draft'),
    [releaseDateValue, setReleaseDate] = useState<string | null>('2026-10-11');
  const [fields, setFields] = useState<ReleaseEditorViewModel['fields']>({
    artworkUrl: null,
    type: 'album',
    spotifyUrl: '',
    appleMusicUrl: '',
    bandcampUrl: '',
    youtubeMusicUrl: '',
    artists: [],
    labels: [],
    categories: [],
    genres: [],
    styles: [],
    formats: [],
    credits: [],
    tracks: [],
  });
  const [creditNotes, setCreditNotes] = useState<Record<string, string>>({});
  if (!local.room || !local.session) {
    return <PageLoader />;
  }
  const model: ReleaseEditorViewModel = {
    currentProvider: local.room.provider,
    releaseId: 'local-release',
    protocol: null,
    relationRefreshError: null,
    relationRefreshPending: false,
    refreshReleaseRelations: async () => {},
    displayedTitle: local.title,
    canEditLocalizedTitle: local.canEdit,
    handleScopedLocaleTitleChange: local.setTitle,
    tCommon: local.tCommon,
    status,
    releaseStatusOptions: [
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
    runReleaseTransition: async (transition) => {
      await transition();
      return true;
    },
    router: local.router,
    canEditNeutral: local.canEdit,
    handleStatusChange: setStatus,
    deleteRelease: local.deleteMutation,
    tActions,
    t,
    publishRelease: pending,
    unpublishRelease: pending,
    activeEditLocale: local.activeEditLocale,
    ...local.site,
    slug: local.slug,
    slugMgmt: local.slugMgmt,
    updateSlug: pending,
    fields,
    setField: (key, value) => setFields((current) => ({ ...current, [key]: value })),
    releaseTypeOptions: ['album', 'ep', 'single', 'compilation'].map((value) => ({
      value,
      label: tTypes(value as 'album' | 'ep' | 'single' | 'compilation'),
    })),
    releaseDateValue,
    handleReleaseDateChange: setReleaseDate,
    isEditingScopedLocale: local.locale !== 'ko',
    shouldUseLocaleDocument: true,
    localizedDescriptionSession: local.session,
    descriptionEditorKey: local.locale,
    currentLocaleCanEdit: local.canEdit,
    tStates,
    editorSession: local.session,
    beginRelationSave: noop,
    settleRelationSave: noop,
    creditNotes,
    blockRoomController: local.room.controller,
    handleCreditNoteChange: (id, note) => setCreditNotes((current) => ({ ...current, [id]: note })),
    canEditTranslationSource: local.canEdit && local.locale === 'ko',
  };
  return (
    <DocumentEditorFrame client={local.client} completed={local.deleted}>
      <ReleaseEditorView model={model} />
    </DocumentEditorFrame>
  );
}
const meta = {
  argTypes: editorStateArgTypes,
  title: 'Pages/Editors/Release',
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
    const tRelease = createTranslator({ locale, messages, namespace: 'releaseEditor' });
    const titles = await canvas.findAllByRole('textbox', { name: t('labels.title') });
    const title = titles.find((control) => control.id.endsWith('-header-title'));
    if (!title) {
      throw new Error('Expected the named release header title.');
    }
    await step('The named title remains reachable and editable by keyboard', async () => {
      for (let index = 0; index < 60 && canvasElement.ownerDocument.activeElement !== title; index += 1) {
        await userEvent.tab();
      }
      await expect(title).toHaveFocus();
      const before = (title as HTMLInputElement).value;
      await userEvent.keyboard('{End} accessible draft');
      await expect(title).toHaveValue(`${before} accessible draft`);
      const basicInformation = canvas.getByRole('group', { name: tRelease('sections.basicInformation') });
      await expect(within(basicInformation).getByRole('textbox', { name: t('labels.title') })).toHaveValue(
        `${before} accessible draft`,
      );
      await expect(title).toHaveAccessibleName(t('labels.title'));
      await userEvent.tab();
      await expect(title).not.toHaveFocus();
      await userEvent.tab({ shift: true });
      await expect(title).toHaveFocus();
    });
  },
};
