import { expect, userEvent, within } from 'storybook/test';
import { DEFAULT_LOCALE, normalizeLocale } from '@/lib/i18n/locale';
import { useState } from 'react';
import { createTranslator, useTranslations } from 'next-intl';
import { goBackPreview } from '../shared/preview-navigation';
import type { Meta, StoryObj } from '@storybook/nextjs';
import {
  ArtistDetailEditorView,
  type ArtistDetailEditorViewModel,
} from '@/features/artist/ArtistEditor/ArtistDetailEditor';
import { PageLoader } from '@/features/site/PageLoader';
import { DocumentEditorFrame, editorPageParameters, editorStateArgTypes } from './fixtures/DocumentEditorFrame';
import { readyQuery } from './fixtures/editor-pages';
import { useDocumentEditor, pending, type EditorPreviewState } from './fixtures/use-document-editor';
function Preview({ state = 'ready' }: { state?: EditorPreviewState }) {
  const local = useDocumentEditor('artist', state),
    t = useTranslations('artistAdminDetail');
  const [normalizedStatus, setStatus] = useState<ArtistDetailEditorViewModel['normalizedStatus']>('draft');
  const [fields, setFields] = useState<ArtistDetailEditorViewModel['fields']>({
    slug: 'night-signals',
    realName: '',
    countryCode: 'KR',
    website: 'https://studio.example.com',
    labelIds: [],
    parentArtistId: null,
  });
  const [localSocialLinks, setSocialLinks] = useState<ArtistDetailEditorViewModel['localSocialLinks']>({});
  const [assignUsersModalOpened, setAssignUsersModalOpened] = useState(false),
    [deleteDialogOpened, setDeleteDialogOpened] = useState(false);
  if (!local.room || !local.session) {
    return <PageLoader />;
  }
  const model: ArtistDetailEditorViewModel = {
    currentProvider: local.room.provider,
    id: 'local-artist',
    protocol: null,
    labelsQuery: { ...readyQuery, data: [], isLoading: false },
    parentArtistOptionsQuery: { ...readyQuery, data: [], isLoading: false },
    displayedName: local.title,
    canEditLocalizedName: local.canEdit,
    handleScopedLocaleNameChange: local.setTitle,
    tCommon: local.tCommon,
    currentIsConnected: local.connected,
    currentIsSynced: local.connected,
    normalizedStatus,
    artistStatusOptions: [
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
    handleBack: async () => goBackPreview(),
    canEditNeutral: local.canEdit,
    canPublish: local.canEdit,
    canUnpublish: local.canEdit,
    handleStatusChange: async (value) => setStatus(value),
    canDelete: local.canEdit,
    deletePreparationPending: false,
    handleDelete: local.remove,
    publishArtist: pending,
    unpublishArtist: pending,
    activeEditLocale: local.activeEditLocale,
    canManageParticipants: false,
    t,
    setAssignUsersModalOpened,
    ogImage: local.ogImage,
    canMutate: local.canEdit,
    regenerateOgImage: local.regenerateOgImage,
    artist: { images: [], imageRevision: '0' },
    ...local.site,
    fields,
    slugMgmt: local.slugMgmt,
    slugError: undefined,
    handleSlugChange: (value) => setFields((current) => ({ ...current, slug: value })),
    setField: (key, value) => setFields((current) => ({ ...current, [key]: value })),
    isEditingScopedLocale: local.locale !== 'ko',
    hasScopedLocaleLiveRow: true,
    localizedBioSession: local.session,
    bioEditorKey: local.locale,
    currentLocaleCanEdit: local.canEdit,
    editorSession: local.session,
    labelOptions: [],
    handleLabelsChange: (value) => setFields((current) => ({ ...current, labelIds: value })),
    parentArtistOptions: [],
    localSocialLinks,
    handleSocialLinksChange: setSocialLinks,
    canManageShareLinks: false,
    assignUsersModalOpened,
    canRemoveOwner: false,
    deleteDialogOpened,
    setDeleteDialogOpened,
    router: local.router,
    permissionRevocation: { revoked: false, sessionExpired: false },
  };
  return (
    <DocumentEditorFrame client={local.client} completed={local.deleted}>
      <ArtistDetailEditorView model={model} />
    </DocumentEditorFrame>
  );
}
const meta = {
  argTypes: editorStateArgTypes,
  title: 'Pages/Editors/Artist',
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
