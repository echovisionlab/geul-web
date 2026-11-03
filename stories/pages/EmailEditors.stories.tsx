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
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { operationsLabels } from './fixtures/operations-a11y';
import { localRichFormattingEmailDocument } from './fixtures/email-rich-formatting';
import { localEditLocale, localEmailRoom, localEditorQueryClient } from './fixtures/editor-pages';
type State =
  | 'ready'
  | 'pending'
  | 'failed'
  | 'disconnected'
  | 'action-failed'
  | 'layouts-pending'
  | 'layouts-error'
  | 'preview-pending'
  | 'preview-error'
  | 'test-pending'
  | 'metadata-saving'
  | 'metadata-error';
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
      content: async (layoutHtml, contentHtml, requestedLocale, signal) => {
        if (state === 'preview-pending') {
          return new Promise<never>(() => {});
        }
        if (state === 'preview-error') {
          throw new Error('Local layout preview unavailable');
        }
        return {
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
        };
      },
      saved: async (_layoutId, contentHtml, requestedLocale, signal) => {
        if (state === 'preview-pending') {
          return new Promise<never>(() => {});
        }
        if (state === 'preview-error') {
          throw new Error('Local layout preview unavailable');
        }
        return renderLocalEmailPreview(
          {
            layoutHtml: initialHtml,
            contentHtml: contentHtml ?? '',
            locale: requestedLocale ?? locale,
            subject: 'Listening room',
            variables: LOCAL_EMAIL_VARIABLES,
          },
          signal,
        );
      },
    }),
    [locale, state],
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
    localeErrorSurface: null,
    currentProvider: null,
    layoutId: 'local-layout',
    title,
    activeEditLocale: localEditLocale(locale, setLocale),
    handleTitleChange: setTitle,
    metadataSaveState: state === 'metadata-saving' ? 'saving' : state === 'metadata-error' ? 'error' : undefined,
    isConnected: state !== 'disconnected',
    isSynced: state !== 'disconnected',
    isEditorReady: true,
    connectingSurface: <PageLoader placement="flow" message={tCommon('states.connectingEditor')} />,
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
    [preparingTest, setPreparingTest] = useState(false),
    [testModalOpened, setTestModal] = useState(false),
    [testEmail, setTestEmail] = useState(''),
    [testLocale, setTestLocale] = useState('ko');
  const preview = useLocalEmailPreview(
    state === 'pending' || state === 'failed' || state === 'preview-pending' || state === 'preview-error' ? null : room,
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
    localeErrorSurface: null,
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
    layouts:
      state === 'layouts-pending' || state === 'layouts-error'
        ? []
        : [{ id: 'paper', name: 'Paper layout', key: 'paper' }],
    layoutId: state === 'layouts-pending' || state === 'layouts-error' ? null : layoutId,
    handleLayoutChange: setLayoutId,
    layoutsLoadError: state === 'layouts-error',
    layoutsLoading: state === 'layouts-pending',
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
    isPreviewLoading: state === 'preview-pending' || preview.isLoading,
    previewError: state === 'preview-error' || Boolean(preview.error),
    previewSubject: preview.subject,
    previewSrcDoc: preview.html,
    sendTest: { isPending: false },
    preparingTest,
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
      if (state === 'test-pending') {
        setPreparingTest(true);
        return;
      }
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
          'Production email layout/template views with local code or rich text edits, live preview, view modes and test dialogs. Canonical email snapshots and local layout/variables are rendered by the production Go renderer through a Storybook-only endpoint. Preview pending/error fixtures hold or fail the local boundary; test preparation stays pending after submission. Service-backed translation panels are omitted. Configure EMAIL_PREVIEW_FIXTURE_BINARY; no email is delivered.',
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
    const { iframe, document, quote } = await waitFor(
      () => {
        const iframe = canvasElement.querySelector<HTMLIFrameElement>('iframe');
        const document = iframe?.contentDocument;
        const quote = document?.querySelector('blockquote');
        if (!iframe || !document || !quote || !iframe.contentWindow) {
          throw new Error('Waiting for the rendered email iframe and quote');
        }
        return { iframe, document, quote };
      },
      { timeout: 20_000 },
    );
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
    await waitFor(async () => {
      await expect(iframe.clientHeight).toBeGreaterThanOrEqual(
        Math.max(document.documentElement.scrollHeight, document.body.scrollHeight),
      );
      await expect(iframe.getAttribute('scrolling')).toBe('no');
    });
    await userEvent.click(editor);
    await userEvent.keyboard(' Updated preview');
    await waitFor(
      async () => {
        const frame = canvasElement.querySelector<HTMLIFrameElement>('iframe');
        const body = frame?.contentDocument?.body;
        if (!frame || !body) {
          throw new Error('Waiting for the updated email iframe');
        }
        await expect(body).toHaveTextContent('Updated preview');
        await expect(frame.clientHeight).toBeGreaterThanOrEqual(
          Math.max(frame.contentDocument!.documentElement.scrollHeight, body.scrollHeight),
        );
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
export const TemplateLayoutsPending: Story = {
  args: { page: 'template', state: 'layouts-pending' },
  play: async ({ canvasElement, globals }) => {
    const canvas = within(canvasElement);
    const t = await operationsLabels(globals);
    const layout = await canvas.findByRole('combobox', { name: t.emailTemplates('detail.fields.layoutLabel') });
    await expect(layout).toBeDisabled();
    await expect(layout.closest('[aria-busy]')).toHaveAttribute('aria-busy', 'true');
    await expect(layout).toHaveAttribute('placeholder', t.common('states.loading'));
  },
};
export const TemplateLayoutsFailed: Story = {
  args: { page: 'template', state: 'layouts-error' },
  play: async ({ canvasElement, globals }) => {
    const canvas = within(canvasElement);
    const t = await operationsLabels(globals);
    const layout = await canvas.findByRole('combobox', { name: t.emailTemplates('detail.fields.layoutLabel') });
    await expect(layout).toBeDisabled();
    await expect(layout.closest('[aria-busy]')).toHaveAttribute('aria-busy', 'false');
    await expect(layout).toHaveAccessibleDescription(t.common('states.notAvailable'));
  },
};
export const TemplatePreviewPending: Story = {
  args: { page: 'template', state: 'preview-pending' },
  play: async ({ canvasElement, globals }) => {
    const canvas = within(canvasElement);
    const t = await operationsLabels(globals);
    const phase = await canvas.findByText(t.common('states.loadingPreview'));
    const loading = phase.closest('[role="status"]');
    await expect(loading).toHaveTextContent(t.common('states.loadingPreview'));
    await expect(loading).toHaveAttribute('data-placement', 'flow');
    await expect(canvas.queryByText(t.emailTemplates('detail.preview.empty'))).not.toBeInTheDocument();
    await expect(canvas.queryByTitle(t.common('labels.emailPreview'))).not.toBeInTheDocument();
  },
};
export const TemplatePreviewFailed: Story = {
  args: { page: 'template', state: 'preview-error' },
  play: async ({ canvasElement, globals }) => {
    const canvas = within(canvasElement);
    const t = await operationsLabels(globals);
    await expect(await canvas.findByText(t.common('states.notAvailable'))).toBeVisible();
    await expect(canvas.queryByRole('status', { name: t.common('states.loading') })).not.toBeInTheDocument();
    await expect(canvas.queryByText(t.emailTemplates('detail.preview.empty'))).not.toBeInTheDocument();
  },
};
export const TemplateTestPreparing: Story = {
  args: { page: 'template', state: 'test-pending' },
  play: async ({ canvasElement, globals }) => {
    const canvas = within(canvasElement);
    const t = await operationsLabels(globals);
    await userEvent.click(await canvas.findByRole('button', { name: t.common('actions.sendTest') }));
    const dialog = await within(canvasElement.ownerDocument.body).findByRole('dialog');
    await userEvent.type(within(dialog).getByRole('textbox', { name: t.common('labels.email') }), 'june@example.com');
    const send = within(dialog).getByRole('button', { name: t.common('actions.sendTest') });
    await userEvent.click(send);
    await expect(send).toHaveAttribute('aria-busy', 'true');
    await expect(send).toBeDisabled();
    await expect(dialog).toBeVisible();
  },
};
export const LayoutPreviewPending: Story = {
  args: { state: 'preview-pending' },
  play: async ({ canvasElement, globals }) => {
    const canvas = within(canvasElement);
    const t = await operationsLabels(globals);
    const preview = await canvas.findByRole('region', { name: t.common('labels.preview') });
    const loading = await within(preview).findByRole('status', { name: t.common('states.loading') });
    await expect(preview).toHaveAttribute('aria-busy', 'true');
    await expect(loading).toHaveTextContent(t.common('states.loadingPreview'));
    await expect(loading).toHaveAttribute('data-placement', 'flow');
  },
};
export const LayoutPreviewFailed: Story = {
  args: { state: 'preview-error' },
  play: async ({ canvasElement, globals }) => {
    const canvas = within(canvasElement);
    const t = await operationsLabels(globals);
    const preview = await canvas.findByRole('region', { name: t.common('labels.preview') });
    await expect(await within(preview).findByRole('alert')).toBeVisible();
    await expect(preview).toHaveAttribute('aria-busy', 'false');
    await expect(within(preview).queryByRole('status', { name: t.common('states.loading') })).not.toBeInTheDocument();
  },
};
export const LayoutMetadataSaving: Story = { args: { state: 'metadata-saving' } };
export const LayoutMetadataFailed: Story = { args: { state: 'metadata-error' } };
export const LayoutDisconnected: Story = { args: { state: 'disconnected' } };
export const Phone: Story = { globals: { viewport: { value: 'phone', isRotated: false } } };
