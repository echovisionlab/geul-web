import type { EmailCampaignTiptapEditorHandle } from '@/features/editor/tiptap/profiles/EmailTiptapEditor';
import { useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import type { Meta, StoryObj } from '@storybook/nextjs';
import { QueryClientProvider } from '@tanstack/react-query';
import { create } from '@bufbuild/protobuf';
import { ListEntityTranslationsResponseSchema } from '@echovisionlab/geul-proto/secure/translation_pb.ts';
import { IconCode, IconColumns2, IconEye } from '@tabler/icons-react';
import * as Y from 'yjs';
import { LayoutContainer } from '@/components/core/Layout';
import {
  EmailLayoutEditPageView,
  type EmailLayoutEditPageViewModel,
} from '@/features/admin/email-layout/EmailLayoutEditPage';
import {
  EmailTemplateEditPageView,
  type EmailTemplateEditPageViewModel,
} from '@/features/admin/email-template/EmailTemplateEditPage';
import type { EmailLayoutPreviewBindings } from '@/features/admin/email-layout/EmailLayoutPreview';
import { PageLoader } from '@/features/site/PageLoader';
import { Alert } from '@/components/core/Alert';
import { notifications } from '@/components/core/Notification';
import { buildEmailPreviewSrcDoc } from '@/lib/email/preview-document';
import { localEditLocale, localEmailRoom, localEditorQueryClient } from './fixtures/editor-pages';
type State = 'ready' | 'pending' | 'failed' | 'disconnected' | 'action-failed';
type Mode = 'split' | 'code' | 'preview';
const initialHtml = '<html><body><h1>{{subject}}</h1>{{content}}</body></html>';
function LayoutPreview({ state = 'ready' }: { state?: State }) {
  const [client] = useState(() => localEditorQueryClient('email_layout', 'local-layout'));
  const [doc, setDoc] = useState<Y.Doc | null>(null);
  useEffect(() => {
    const document = new Y.Doc();
    document.getText('html-content').insert(0, initialHtml);
    setDoc(document);
    return () => document.destroy();
  }, []);
  const router = useRouter();
  const tPage = useTranslations('adminList.emailLayouts.detail'),
    tCommon = useTranslations('common'),
    tCommonLabels = useTranslations('common.labels');
  const [title, setTitle] = useState('Paper layout'),
    [key, setKey] = useState('paper'),
    [locale, setLocale] = useState('ko'),
    [viewMode, setViewMode] = useState<Mode>('split'),
    [variablesExpanded, setVariablesExpanded] = useState(true),
    [htmlContent, setHtmlContent] = useState(initialHtml);
  const previewBindings: EmailLayoutPreviewBindings = {
    content: async (content, sample) => ({
      html: content.replace('{{subject}}', 'Listening room').replace('{{content}}', sample ?? ''),
      errors: [],
      valid: true,
    }),
    saved: async () => ({ html: '<h1>Listening room</h1><p>October edition</p>' }),
  };
  if (state === 'pending' || !doc) {
    return <PageLoader />;
  }
  if (state === 'failed') {
    return (
      <Alert role="alert" tone="danger">
        Local email layout unavailable
      </Alert>
    );
  }
  const model: Extract<EmailLayoutEditPageViewModel, { kind: 'ready' }> = {
    kind: 'ready',
    currentProvider: null,
    layoutId: 'local-layout',
    title,
    activeEditLocale: localEditLocale(locale, setLocale),
    handleTitleChange: setTitle,
    isConnected: state !== 'disconnected',
    isSynced: state !== 'disconnected',
    router,
    tPage,
    tCommon,
    key,
    handleKeyChange: setKey,
    handleActiveLocaleChange: (value) => value && setLocale(value),
    viewMode,
    setViewMode,
    viewModeOptions: [
      { value: 'split', tooltip: tPage('viewModes.split'), icon: <IconColumns2 /> },
      { value: 'code', tooltip: tPage('viewModes.code'), icon: <IconCode /> },
      { value: 'preview', tooltip: tCommonLabels('preview'), icon: <IconEye /> },
    ],
    variablesExpanded,
    setVariablesExpanded,
    tCommonLabels,
    layoutVariables: [
      { name: 'content', description: tPage('variables.items.content') },
      { name: 'subject', description: tPage('variables.items.subject') },
      { name: 'email_font_stylesheet_url', description: tPage('variables.items.emailFontStylesheetUrl') },
    ],
    showEditor: viewMode !== 'preview',
    currentDoc: doc,
    roomLocale: locale,
    canEditTranslationSource: state !== 'disconnected',
    canEditCurrentLocale: state !== 'disconnected',
    layout: { htmlContent: initialHtml },
    setHtmlContent,
    layoutRoom: { targetUnits: [], setTargetValue: () => {}, useSourceFallback: () => {} },
    showPreview: viewMode !== 'code',
    htmlContent,
    targetPreviewKey: locale,
    activePreviewLocale: locale,
    translationEntriesQuery: { data: create(ListEntityTranslationsResponseSchema, { sourceLocale: 'ko' }) },
  };
  return (
    <QueryClientProvider client={client}>
      <LayoutContainer size="wide" inset="md">
        <EmailLayoutEditPageView model={model} previewBindings={previewBindings} />
      </LayoutContainer>
    </QueryClientProvider>
  );
}
function TemplatePreview({ state = 'ready' }: { state?: State }) {
  const editorRef = useRef<EmailCampaignTiptapEditorHandle | null>(null);
  const [previewHtml, setPreviewHtml] = useState('');
  const refreshPreview = () => setPreviewHtml(editorRef.current?.getHTML() ?? '');
  const [client] = useState(() => localEditorQueryClient('email_template', 'local-template'));
  const [room, setRoom] = useState<ReturnType<typeof localEmailRoom> | null>(null);
  useEffect(() => {
    const current = localEmailRoom('email_template');
    setRoom(current);
    return () => {
      current.awareness.destroy();
      current.document.destroy();
    };
  }, []);
  const router = useRouter(),
    currentLocale = useLocale();
  const tCommonNotifications = useTranslations('common.notifications'),
    tEmailTemplates = useTranslations('adminList.emailTemplates'),
    tCommonActions = useTranslations('common.actions'),
    tCommonLabels = useTranslations('common.labels'),
    tCommonStates = useTranslations('common.states'),
    tCommonPlaceholders = useTranslations('common.placeholders'),
    tModes = useTranslations('adminList.emailLayouts.detail.viewModes');
  const [locale, setLocale] = useState('ko'),
    [currentSubject, setSubject] = useState('Night Signals · October'),
    [viewMode, setViewMode] = useState<Mode>('split'),
    [layoutId, setLayoutId] = useState<string | null>('paper'),
    [variablesExpanded, setVariablesExpanded] = useState(true),
    [testModalOpened, setTestModal] = useState(false),
    [testEmail, setTestEmail] = useState(''),
    [testLocale, setTestLocale] = useState('ko');
  if (state === 'pending' || !room) {
    return <PageLoader />;
  }
  if (state === 'failed') {
    return (
      <Alert role="alert" tone="danger">
        Local email template unavailable
      </Alert>
    );
  }
  const model: Extract<EmailTemplateEditPageViewModel, { kind: 'ready' }> = {
    kind: 'ready',
    currentProvider: null,
    templateId: 'local-template',
    protocol: null,
    displayTitle: 'Listening room invitation',
    isConnected: state !== 'disconnected',
    isSynced: state !== 'disconnected',
    tCommonNotifications,
    router,
    tEmailTemplates,
    tCommonActions,
    openTestModal: () => setTestModal(true),
    displayDescription: 'Invitation for the October edition',
    template: {
      key: 'room_invitation',
      isSystem: false,
      variables: [
        { name: 'recipient_name', description: 'Recipient name' },
        { name: 'confirm_url', description: 'Confirmation URL' },
      ],
    },
    tCommonLabels,
    currentSubject,
    handleSubjectChange: setSubject,
    canEditTranslationSource: state !== 'disconnected',
    canEditLocalizedSubject: state !== 'disconnected',
    layouts: [{ id: 'paper', name: 'Paper layout', key: 'paper' }],
    layoutId,
    handleLayoutChange: setLayoutId,
    layoutsLoadError: false,
    tCommonStates,
    updateLayout: { isPending: false },
    activeEditLocale: localEditLocale(locale, setLocale),
    handleActiveLocaleChange: (value) => value && setLocale(value),
    viewMode,
    setViewMode,
    viewModeOptions: [
      { value: 'split', tooltip: tModes('split'), icon: <IconColumns2 /> },
      { value: 'code', tooltip: tModes('code'), icon: <IconCode /> },
      { value: 'preview', tooltip: tCommonLabels('preview'), icon: <IconEye /> },
    ],
    variablesExpanded,
    setVariablesExpanded,
    getVariableDescription: () => null,
    showEditor: viewMode !== 'preview',
    editorSession: { provider: room.provider, controller: room.controller },
    variableNames: ['recipient_name', 'confirm_url'],
    handleEditorReady: (editor) => {
      editorRef.current = editor;
      refreshPreview();
    },
    handleEditorContentChange: refreshPreview,
    showPreview: viewMode !== 'code',
    isPreviewLoading: false,
    previewSubject: currentSubject,
    previewSrcDoc: buildEmailPreviewSrcDoc(previewHtml, currentLocale),
    sendTest: { isPending: false },
    testModalOpened,
    closeTestModal: () => setTestModal(false),
    tCommonPlaceholders,
    testEmail,
    setTestEmail,
    testLocale,
    supportedLocaleOptions: [
      { value: 'ko', label: '한국어' },
      { value: 'en', label: 'English' },
    ],
    setTestLocale,
    handleSendTest: () => {
      if (state === 'action-failed') {
        notifications.show({ tone: 'danger', message: 'Local test command failed' });
      } else {
        setTestModal(false);
      }
    },
  };
  return (
    <QueryClientProvider client={client}>
      <LayoutContainer size="wide" inset="md">
        <EmailTemplateEditPageView model={model} />
      </LayoutContainer>
    </QueryClientProvider>
  );
}
function Preview({ page = 'layout', state = 'ready' }: { page?: 'layout' | 'template'; state?: State }) {
  return page === 'layout' ? <LayoutPreview state={state} /> : <TemplatePreview state={state} />;
}
const meta = {
  title: 'Pages/Admin/Email Editors',
  component: Preview,
  args: { page: 'layout', state: 'ready' },
  render: (args) => <Preview key={`${args.page}-${args.state}`} {...args} />,
  parameters: {
    layout: 'fullscreen',
    nextjs: { appDirectory: true },
    docs: {
      description: {
        component:
          'Production email layout/template views with local code or rich text edits, live preview, view modes and test dialogs. Service-backed translation panels are omitted. No email is delivered.',
      },
    },
  },
} satisfies Meta<typeof Preview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Layout: Story = {};
export const Template: Story = { args: { page: 'template' } };
export const LayoutPending: Story = { args: { state: 'pending' } };
export const TemplatePending: Story = { args: { page: 'template', state: 'pending' } };
export const LayoutFailed: Story = { args: { state: 'failed' } };
export const TemplateFailed: Story = { args: { page: 'template', state: 'failed' } };
export const TemplateActionFailed: Story = { args: { page: 'template', state: 'action-failed' } };
export const LayoutDisconnected: Story = { args: { state: 'disconnected' } };
export const Phone: Story = { globals: { viewport: { value: 'phone', isRotated: false } } };
