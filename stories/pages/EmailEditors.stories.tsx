import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
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
import { renderLocalEmailPreview } from './fixtures/email-preview';
import { LOCAL_EMAIL_VARIABLES, useLocalEmailPreview } from './fixtures/use-email-preview';
import { expect, userEvent, waitFor } from 'storybook/test';
import { localRichFormattingEmailDocument } from './fixtures/email-rich-formatting';
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
  const previewBindings = useMemo<EmailLayoutPreviewBindings>(
    () => ({
      content: async (layoutHtml, contentHtml, requestedLocale, signal) => ({
        ...(await renderLocalEmailPreview(
          {
            layoutHtml,
            contentHtml: contentHtml ?? '',
            locale: requestedLocale ?? locale,
            subject: 'Listening room',
            variables: LOCAL_EMAIL_VARIABLES,
          },
          signal,
        )),
        errors: [],
        valid: true,
      }),
      saved: async (_layoutId, contentHtml, requestedLocale, signal) =>
        renderLocalEmailPreview(
          {
            layoutHtml: initialHtml,
            contentHtml: contentHtml ?? '',
            locale: requestedLocale ?? locale,
            subject: 'Listening room',
            variables: LOCAL_EMAIL_VARIABLES,
          },
          signal,
        ),
    }),
    [locale],
  );
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
function TemplatePreview({
  state = 'ready',
  lineBreaks = false,
  richFormatting = false,
}: {
  state?: State;
  lineBreaks?: boolean;
  richFormatting?: boolean;
}) {
  const [client] = useState(() => localEditorQueryClient('email_template', 'local-template'));
  const [room, setRoom] = useState<ReturnType<typeof localEmailRoom> | null>(null);
  useEffect(() => {
    const current = localEmailRoom('email_template', lineBreaks, richFormatting);
    setRoom(current);
    return () => {
      current.awareness.destroy();
      current.document.destroy();
    };
  }, [lineBreaks, richFormatting]);
  const router = useRouter();
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
  const preview = useLocalEmailPreview(
    state === 'pending' || state === 'failed' ? null : room,
    currentSubject,
    layoutId ? initialHtml : null,
  );
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
    handleEditorReady: preview.refresh,
    handleEditorContentChange: preview.refresh,
    showPreview: viewMode !== 'code',
    isPreviewLoading: preview.isLoading,
    previewSubject: preview.subject,
    previewSrcDoc: preview.html,
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
        {preview.error ? (
          <Alert role="alert" tone="danger">
            {preview.error}
          </Alert>
        ) : null}
        <EmailTemplateEditPageView model={model} />
      </LayoutContainer>
    </QueryClientProvider>
  );
}
function Preview({
  page = 'layout',
  state = 'ready',
  lineBreaks = false,
  richFormatting = false,
}: {
  page?: 'layout' | 'template';
  state?: State;
  lineBreaks?: boolean;
  richFormatting?: boolean;
}) {
  return page === 'layout' ? (
    <LayoutPreview state={state} />
  ) : (
    <TemplatePreview state={state} lineBreaks={lineBreaks} richFormatting={richFormatting} />
  );
}
const meta = {
  title: 'Pages/Admin/Email Editors',
  component: Preview,
  args: { page: 'layout', state: 'ready' },
  render: (args) => <Preview key={`${args.page}-${args.state}-${args.lineBreaks}-${args.richFormatting}`} {...args} />,
  parameters: {
    layout: 'fullscreen',
    nextjs: { appDirectory: true },
    docs: {
      description: {
        component:
          'Production email layout/template views with local code or rich text edits, live preview, view modes and test dialogs. Canonical email snapshots and local layout/variables are rendered by the production Go renderer through a Storybook-only endpoint. Service-backed translation panels are omitted. Configure EMAIL_PREVIEW_FIXTURE_BINARY; no email is delivered.',
      },
    },
  },
} satisfies Meta<typeof Preview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Layout: Story = {};
export const Template: Story = { args: { page: 'template' } };
export const TemplateLineBreaks: Story = { args: { page: 'template', lineBreaks: true } };
export const TemplateRichFormatting: Story = {
  args: { page: 'template', richFormatting: true },
  tags: ['email-rendering'],
  play: async ({ canvasElement }) => {
    const editor = await waitFor(
      () => {
        const editable = canvasElement.querySelector('[contenteditable="true"]');
        expect(editable).not.toBeNull();
        return editable!;
      },
      { timeout: 15_000 },
    );
    await expect(editor).toHaveTextContent('quote');
    const iframe = await waitFor(
      () => {
        const frame = canvasElement.querySelector('iframe');
        expect(frame?.contentDocument?.querySelector('blockquote')).not.toBeNull();
        return frame!;
      },
      { timeout: 20_000 },
    );
    const document = iframe.contentDocument!;
    const quote = document.querySelector('blockquote')!;
    const quoteStyle = iframe.contentWindow!.getComputedStyle(quote);
    await expect(quote).toHaveTextContent('quote');
    await expect(Number.parseFloat(quoteStyle.borderLeftWidth)).toBeGreaterThan(0);
    await expect(quoteStyle.borderLeftStyle).not.toBe('none');
    await expect(document.querySelector('h2')).toHaveTextContent('Email heading');
    await expect(document.querySelectorAll('ul li')).toHaveLength(2);
    await expect(document.querySelector('p br')).not.toBeNull();
    const rendered = await renderLocalEmailPreview({
      document: localRichFormattingEmailDocument(),
      locale: 'ko',
      subject: 'Night Signals · October',
      layoutHtml: initialHtml,
      variables: LOCAL_EMAIL_VARIABLES,
    });
    await expect(iframe.srcdoc).toBe(rendered.html);
    await userEvent.click(editor);
    await userEvent.keyboard(' Updated preview');
    await waitFor(
      () => {
        expect(iframe.contentDocument?.body).toHaveTextContent('Updated preview');
      },
      { timeout: 20_000 },
    );
  },
};
export const LayoutPending: Story = { args: { state: 'pending' } };
export const TemplatePending: Story = { args: { page: 'template', state: 'pending' } };
export const LayoutFailed: Story = { args: { state: 'failed' } };
export const TemplateFailed: Story = { args: { page: 'template', state: 'failed' } };
export const TemplateActionFailed: Story = { args: { page: 'template', state: 'action-failed' } };
export const LayoutDisconnected: Story = { args: { state: 'disconnected' } };
export const Phone: Story = { globals: { viewport: { value: 'phone', isRotated: false } } };
