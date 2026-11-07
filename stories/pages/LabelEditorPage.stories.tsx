import { expect, userEvent, within } from 'storybook/test';
import { DEFAULT_LOCALE, normalizeLocale } from '@/lib/i18n/locale';
import { useState } from 'react';
import { createTranslator, useTranslations } from 'next-intl';
import { goBackPreview } from '../shared/preview-navigation';
import type { Meta, StoryObj } from '@storybook/nextjs';
import { LabelEditorView, type LabelEditorViewModel } from '@/features/label/AdminLabelDetailClient';
import { PageLoader } from '@/features/site/PageLoader';
import { DocumentEditorFrame, editorPageParameters, editorStateArgTypes } from './fixtures/DocumentEditorFrame';
import { readyQuery } from './fixtures/editor-pages';
import { useDocumentEditor, pending, type EditorPreviewState } from './fixtures/use-document-editor';
function Preview({ state = 'ready' }: { state?: EditorPreviewState }) {
  const local = useDocumentEditor('label', state),
    t = useTranslations('labelAdminDetail');
  const [currentStatus, setStatus] = useState<LabelEditorViewModel['currentStatus']>('draft'),
    [participantsOpened, setParticipantsOpened] = useState(false);
  const [fields, setFields] = useState<LabelEditorViewModel['fields']>({
    slug: 'night-signals',
    countryCode: 'KR',
    website: 'https://studio.example.com',
    parentLabelId: null,
    socialLinks: {},
  });
  const [logoImages, setLogoImages] = useState<LabelEditorViewModel['logoImages']>({ light: null, dark: null });
  if (!local.room || !local.session) {
    return <PageLoader />;
  }
  const model: LabelEditorViewModel = {
    currentProvider: local.room.provider,
    id: 'local-label',
    protocol: null,
    labelsForParentQuery: readyQuery,
    displayedName: local.title,
    canEditLocalizedName: local.canEdit,
    handleScopedLocaleNameChange: local.setTitle,
    tCommon: local.tCommon,
    currentStatus,
    labelStatusOptions: [
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
    handleBack: async () => goBackPreview(),
    canEditNeutral: local.canEdit,
    canPublish: local.canEdit,
    canUnpublish: local.canEdit,
    handleStatusChange: async (value) => setStatus(value),
    publishLabel: pending,
    unpublishLabel: pending,
    t,
    activeEditLocale: { ...local.activeEditLocale, isLoading: false },
    canMutate: local.canEdit,
    canManageParticipants: false,
    setParticipantsOpened,
    logoImages,
    handleParentChange: (value) => setFields((current) => ({ ...current, parentLabelId: value })),
    canChangeParent: local.canEdit,
    handleImageChange: (variant, url) => setLogoImages((current) => ({ ...current, [variant]: url })),
    baseUrl: local.site.baseUrl,
    fields,
    slugMgmt: { ...local.slugMgmt, handleChange: (value) => setFields((current) => ({ ...current, slug: value })) },
    isEditingScopedLocale: local.locale !== 'ko',
    hasScopedLocaleLiveRow: true,
    localizedDescriptionSession: local.session,
    descriptionEditorKey: local.locale,
    currentLocaleCanEdit: local.canEdit,
    editorSession: local.session,
    setField: (key, value) => setFields((current) => ({ ...current, [key]: value })),
    parentLabelOptions: [],
    canManageShareLinks: false,
    participantsOpened,
    canRemoveOwner: false,
    canDelete: local.canEdit,
    deletePreparationPending: false,
    handleDelete: local.remove,
    deleteDialogOpened: false,
    setDeleteDialogOpened: () => undefined,
    permissionRevocation: { revoked: false, sessionExpired: false },
    router: local.router,
    label: { slug: fields.slug },
  };
  return (
    <DocumentEditorFrame client={local.client} completed={local.deleted}>
      <LabelEditorView model={model} />
    </DocumentEditorFrame>
  );
}
const meta = {
  argTypes: editorStateArgTypes,
  title: 'Pages/Editors/Label',
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
