import { expect, userEvent, waitFor, within } from 'storybook/test';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { Meta, StoryObj } from '@storybook/nextjs';
import { IconHammer, IconInbox, IconLanguage, IconSettings } from '@tabler/icons-react';
import { FormLayoutView, type FormLayoutViewModel } from '@/features/form/AdminFormLayoutClient';
import { FormSettingsContent, type FormSettingsBindings } from '@/features/form/FormSettingsContent';
import { EntityTranslationsPanel } from '@/features/translation/EntityTranslationsPanel';
import { ShareLinkServicesProvider } from '@/features/share/ShareLinkServicesContext';
import { formShareLinkFixture } from './fixtures/form-share-links';
import { TranslationServicesProvider } from '@/features/translation/TranslationServicesContext';
import { AuthoringExtensionsProvider } from '@/features/authoring/AuthoringExtensionsContext';
import { actionSuccess } from '@/lib/actions/action-result';
import { formTranslationFixture } from './fixtures/form-translations';
import { createLocalOgPreview } from './fixtures/local-og-preview';
import { FormOperationsPreview } from './FormOperations.stories';
import { FormEditor } from '@/features/form/FormEditor/FormEditor';
import { FormTranslationProvider } from '@/features/form/FormTranslationContext';
import { FormEditorStateProvider, type FormEditorContextValue } from '@/lib/contexts/FormEditorContext';
import { DEFAULT_FORM_FIELDS } from '@/lib/collab/form-fields';
import { DocumentEditorFrame, editorPageParameters, editorStateArgTypes } from './fixtures/DocumentEditorFrame';
import { useDocumentEditor, noop, type EditorPreviewState } from './fixtures/use-document-editor';
const featuredImagePreview = createLocalOgPreview('Listening room', '');
const settingsBindings: FormSettingsBindings = {
  update: async () => actionSuccess({ success: true }),
  setFeaturedImage: async () => actionSuccess({ imageUrl: featuredImagePreview }),
  removeFeaturedImage: async () => actionSuccess({ success: true }),
  regenerateOgImage: async () => actionSuccess({ success: true }),
  checkSlug: async () => ({ available: true }),
  ogRead: {
    latest: async () => actionSuccess({ generation: undefined }),
    generation: async () => {
      throw new Error('No local generation is active');
    },
  },
  upload: async (_blob, options) => {
    options?.onProgress?.({ loaded: 0, total: 1, percentage: 0 });
    await new Promise((resolve) => setTimeout(resolve, 300));
    options?.onProgress?.({ loaded: 1, total: 1, percentage: 100 });
    return { fileId: 'local-featured', url: featuredImagePreview };
  },
};
type FormTab = 'builder' | 'settings' | 'translations' | 'submissions';
function Preview({
  state = 'ready',
  tab = 'builder',
  detail = false,
}: {
  state?: EditorPreviewState;
  tab?: FormTab;
  detail?: boolean;
}) {
  const local = useDocumentEditor('post', state),
    t = useTranslations('formAdmin');
  const [shareServices] = useState(formShareLinkFixture);
  const [currentTab, setCurrentTab] = useState<FormTab>(tab);
  const [translationFixture] = useState(() => {
    const fixture = formTranslationFixture('ready');
    fixture.seed(local.client);
    return fixture;
  });
  const [status, setStatus] = useState<FormLayoutViewModel['status']>('draft');
  const [fields, setFields] = useState<FormEditorContextValue['fields']>({
    ...DEFAULT_FORM_FIELDS,
    title: 'Listening room · 참가 신청',
    schema: {
      id: 'local-form',
      steps: [
        {
          id: 'details',
          title: '참가 정보',
          fields: [
            { id: 'name', key: 'name', type: 'text', label: '이름' },
            { id: 'email', key: 'email', type: 'email', label: '이메일' },
          ],
        },
      ],
    },
  });
  const setField: FormEditorContextValue['setField'] = (key, value) =>
    setFields((current) => ({ ...current, [key]: value }));
  const context: FormEditorContextValue = {
    provider: null,
    doc: null,
    formFieldsMap: null,
    isConnected: local.connected,
    isSynced: local.connected,
    fields,
    setField,
    activeEditLocale: local.activeEditLocale,
    ogGenerationLookup: null,
    notifyOgGenerationLookup: noop,
  };
  const model: FormLayoutViewModel = {
    provider: null,
    formId: 'local-form',
    displayedTitle: fields.title,
    titleChangeHandler: local.canEdit ? (value) => setField('title', value) : undefined,
    tCommon: local.tCommon,
    titleDisabled: !local.canEdit,
    status,
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
    currentIsConnected: local.connected,
    currentIsSynced: local.connected,
    router: local.router,
    formsListPath: '/admin/forms',
    t,
    updateStatus: { isPending: false, mutate: setStatus },
    deleteForm: local.deleteMutation,
    activeEditLocale: local.activeEditLocale,
    currentTab,
    handleTabChange: (value) => {
      if (value && ['builder', 'settings', 'translations', 'submissions'].includes(value)) {
        setCurrentTab(value as FormTab);
      }
    },
    navItems: [
      { value: 'builder', label: t('navigation.tabs.builder'), Icon: IconHammer },
      { value: 'submissions', label: local.tCommon('labels.submissions'), Icon: IconInbox },
      { value: 'settings', label: local.tCommon('labels.settings'), Icon: IconSettings },
      { value: 'translations', label: local.tCommon('entities.translations'), Icon: IconLanguage },
    ],
    children:
      currentTab === 'builder' ? (
        <FormEditor />
      ) : currentTab === 'settings' ? (
        <FormSettingsContent
          formId="local-form"
          baseUrl="https://example.test"
          initialSlug="listening-room"
          initialIsPublic
          initialOpensAt={null}
          initialClosesAt={null}
          initialMaxSubmissions={null}
          initialRequireAuth={false}
          initialAllowedRoles={[]}
          initialAllowDuplicateSubmission
          initialHasPassword={false}
          initialOgImageUrl={createLocalOgPreview(fields.title, '')}
          initialFeaturedImageUrl={null}
          bindings={settingsBindings}
        />
      ) : currentTab === 'translations' ? (
        <EntityTranslationsPanel entityType="form" entityId="local-form" collapsible={false} />
      ) : (
        <FormOperationsPreview surface={detail ? 'detail' : 'submissions'} embedded />
      ),
  };
  return (
    <DocumentEditorFrame client={local.client} completed={local.deleted}>
      <FormEditorStateProvider value={{ ...context, isSynced: local.canEdit }}>
        <FormTranslationProvider>
          <AuthoringExtensionsProvider available={{ translations: true, sharing: true }}>
            <TranslationServicesProvider services={translationFixture.services}>
              <ShareLinkServicesProvider services={shareServices}>
                <FormLayoutView model={model} />
              </ShareLinkServicesProvider>
            </TranslationServicesProvider>
          </AuthoringExtensionsProvider>
        </FormTranslationProvider>
      </FormEditorStateProvider>
    </DocumentEditorFrame>
  );
}
const meta = {
  argTypes: editorStateArgTypes,
  title: 'Pages/Editors/Form',
  component: Preview,
  args: { state: 'ready', tab: 'builder', detail: false },
  render: (args) => <Preview key={`${args.state}:${args.tab}:${args.detail}`} {...args} />,
  parameters: {
    ...editorPageParameters,
    docs: {
      description: {
        component:
          'Production FormLayoutView contains its four real tabs and named tabpanel. Builder, settings, submissions/detail and translations render production owners with typed local actions, OG/slug/upload transports and an in-memory form translation client. Header and schema edits stay local. Both form preview and dashboard share-link lists, creation and revocation use their independent local records. Native collaboration, persistence, delivery and OS assistive technology integration remain deferred.',
      },
    },
  },
} satisfies Meta<typeof Preview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Builder: Story = {};
export const Disconnected: Story = { args: { state: 'disconnected' } };
export const ReadOnly: Story = { args: { state: 'readonly' } };
export const Phone: Story = { globals: { viewport: { value: 'phone', isRotated: false } } };

export const Settings: Story = {
  args: { tab: 'settings' },
  tags: ['a11y-author'],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const panel = within(canvas.getByRole('tabpanel'));
    const switches = panel.getAllByRole('switch');
    await expect(switches).toHaveLength(2);
    switches[1].focus();
    await userEvent.keyboard(' ');
    await waitFor(() => expect(panel.getAllByRole('switch')).toHaveLength(3));
    await expect(switches[1]).toBeChecked();
    await expect(panel.getAllByRole('combobox').length).toBeGreaterThan(0);
    switches[1].focus();
    await userEvent.keyboard(' ');
    await waitFor(() => expect(panel.getAllByRole('switch')).toHaveLength(2));
  },
};
export const Translations: Story = { args: { tab: 'translations' } };
export const Submissions: Story = { args: { tab: 'submissions' } };
export const SubmissionDetail: Story = { args: { tab: 'submissions', detail: true } };
