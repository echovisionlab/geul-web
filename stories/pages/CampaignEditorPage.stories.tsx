import type { EmailCampaignTiptapEditorHandle } from '@/features/editor/tiptap/profiles/EmailTiptapEditor';
import { useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { goBackPreview } from '../shared/preview-navigation';
import type { Meta, StoryObj } from '@storybook/nextjs';
import { QueryClientProvider } from '@tanstack/react-query';
import { IconColumns2, IconEdit, IconEye } from '@tabler/icons-react';
import { LayoutContainer } from '@/components/core/Layout';
import { CampaignEditPageView, type CampaignEditPageViewModel } from '@/features/campaign/CampaignEditPage';
import { PageLoader } from '@/features/site/PageLoader';
import { Alert } from '@/components/core/Alert';
import { notifications } from '@/components/core/Notification';
import { DEFAULT_CAMPAIGN_FIELDS } from '@/lib/collab/schemas/campaign-fields.schema';
import type { CampaignViewMode } from '@/features/campaign/useCampaignPreview';
import type { DateTimeValue } from '@/components/core/Input/DateTimeInput';
import { normalizeLocale } from '@/lib/i18n/locale';
import { buildEmailPreviewSrcDoc } from '@/lib/email/preview-document';
import { localEmailRoom, localEditorQueryClient, localEditLocale, readyQuery } from './fixtures/editor-pages';
function Preview({ state = 'ready' }: { state?: 'ready' | 'pending' | 'failed' | 'disconnected' | 'action-failed' }) {
  const editorRef = useRef<EmailCampaignTiptapEditorHandle | null>(null);
  const [previewHtml, setPreviewHtml] = useState('');
  const refreshPreview = () => setPreviewHtml(editorRef.current?.getHTML() ?? '');
  const [client] = useState(() => localEditorQueryClient('campaign', 'local-campaign'));
  const [room, setRoom] = useState<ReturnType<typeof localEmailRoom> | null>(null);
  useEffect(() => {
    const local = localEmailRoom('campaign');
    setRoom(local);
    return () => {
      local.awareness.destroy();
      local.document.destroy();
    };
  }, []);
  const router = useRouter(),
    currentLocale = useLocale();
  const t = useTranslations('campaignEditor'),
    tAnalytics = useTranslations('campaignAnalytics'),
    tActions = useTranslations('common.actions'),
    tLabels = useTranslations('common.labels'),
    tStates = useTranslations('common.states'),
    tStatuses = useTranslations('common.statuses'),
    tCommonPlaceholders = useTranslations('common.placeholders'),
    tModes = useTranslations('adminList.emailLayouts.detail.viewModes');
  const [status, setStatus] = useState<'draft' | 'scheduled' | 'sent'>('draft');
  const [name, setName] = useState('Listening room invitation'),
    [currentSubject, setSubject] = useState('Night Signals · October'),
    [locale, setLocale] = useState('ko'),
    [fields, setFields] = useState(DEFAULT_CAMPAIGN_FIELDS),
    [viewMode, changeViewMode] = useState<CampaignViewMode>('split');
  const [testModalOpened, setTestModal] = useState(false),
    [sendModalOpened, setSendModal] = useState(false),
    [scheduleModalOpened, setScheduleModal] = useState(false),
    [testEmail, setTestEmail] = useState(''),
    [testLocale, setTestLocale] = useState<string>('ko'),
    [scheduleDate, setScheduleDate] = useState<DateTimeValue>({ date: null, time: '' });
  const feedback = (close: () => void) => {
    if (state === 'action-failed') {
      notifications.show({ tone: 'danger', message: 'Local command failed' });
    } else {
      close();
      notifications.show({ tone: 'positive', message: tActions('save') });
    }
  };
  if (state === 'pending' || !room) {
    return <PageLoader />;
  }
  if (state === 'failed') {
    return (
      <Alert tone="danger" role="alert">
        Local campaign unavailable
      </Alert>
    );
  }
  const canMutate = state !== 'disconnected';
  const model: Extract<CampaignEditPageViewModel, { kind: 'ready' }> = {
    kind: 'ready',
    currentProvider: null,
    campaignId: 'local-campaign',
    protocol: null,
    campaignQuery: readyQuery,
    campaignName: { name, changeName: setName, pending: false },
    canMutate,
    campaign: { status },
    statusOptions: [{ value: status, label: tStatuses(status), actionLabel: tStatuses(status), tone: 'neutral' }],
    isConnected: canMutate,
    isSynced: canMutate,
    handleBack: goBackPreview,
    t,
    tAnalytics,
    router,
    tActions,
    openTestModal: () => setTestModal(true),
    canSchedule: canMutate && status === 'draft',
    hasPendingCampaignConfiguration: false,
    currentSubject,
    deliveryTargetComplete: true,
    openScheduleModal: () => setScheduleModal(true),
    canSendNow: canMutate && status === 'draft',
    openSendModal: () => setSendModal(true),
    isScheduled: status === 'scheduled',
    cancelSchedule: { isPending: false },
    handleCancelSchedule: () => feedback(() => setStatus('draft')),
    tLabels,
    handleSubjectChange: setSubject,
    isEditable: canMutate,
    canEditLocalizedSubject: canMutate,
    activeEditLocale: localEditLocale(locale, setLocale),
    handleActiveLocaleChange: (value) => value && setLocale(value),
    fields,
    segments: [],
    segmentsLoading: false,
    segmentsLoadError: false,
    handleTargetChange: async (selection) => setFields((current) => ({ ...current, ...selection })),
    layouts: [{ id: 'paper', name: 'Paper layout', key: 'paper' }],
    handleLayoutChange: async (layoutId) => setFields((current) => ({ ...current, layoutId })),
    layoutsLoadError: false,
    tStates,
    handleRecipientScopeChange: async (recipientScope) => setFields((current) => ({ ...current, recipientScope })),
    preview: {
      viewMode,
      changeViewMode: (value) => {
        if (value === 'split' || value === 'edit' || value === 'preview') {
          changeViewMode(value);
        }
      },
      showEditor: viewMode !== 'preview',
      showPreview: viewMode !== 'edit',
      editorReady: (editor) => {
        editorRef.current = editor;
        refreshPreview();
      },
      editorContentChanged: refreshPreview,
      query: readyQuery,
      previewSrcDoc: buildEmailPreviewSrcDoc(previewHtml, currentLocale),
    },
    viewModeOptions: [
      { value: 'split', tooltip: tModes('split'), icon: <IconColumns2 /> },
      { value: 'edit', tooltip: tModes('code'), icon: <IconEdit /> },
      { value: 'preview', tooltip: tLabels('preview'), icon: <IconEye /> },
    ],
    editorSession: { provider: room.provider, controller: room.controller },
    testModalOpened,
    testEmail,
    testLocale,
    supportedLocaleOptions: [
      { value: 'ko', label: '한국어' },
      { value: 'en', label: 'English' },
    ],
    activePreviewLocale: normalizeLocale(locale) ?? 'ko',
    sendTest: { isPending: false },
    tCommonPlaceholders,
    closeTestModal: () => setTestModal(false),
    setTestEmail,
    setTestLocale,
    handleSendTest: () => feedback(() => setTestModal(false)),
    sendModalOpened,
    sendCampaign: { isPending: false },
    selectedSegmentName: 'All users',
    closeSendModal: () => setSendModal(false),
    handleSendAll: () =>
      feedback(() => {
        setStatus('sent');
        setSendModal(false);
      }),
    scheduleModalOpened,
    currentLocale,
    scheduleDate,
    scheduleCampaign: { isPending: false },
    closeScheduleModal: () => setScheduleModal(false),
    setScheduleDate,
    handleSchedule: () =>
      feedback(() => {
        setStatus('scheduled');
        setScheduleModal(false);
      }),
    accessInterruption: {
      viewOnly: false,
      blocked: false,
      interruption: null,
      revoked: false,
      sessionExpired: false,
      revoke: () => {},
    },
  };
  return (
    <QueryClientProvider client={client}>
      <LayoutContainer size="wide" inset="md">
        <CampaignEditPageView model={model} />
      </LayoutContainer>
    </QueryClientProvider>
  );
}
const meta = {
  title: 'Pages/Editors/Campaign',
  component: Preview,
  args: { state: 'ready' },
  render: (args) => <Preview key={args.state} {...args} />,
  parameters: {
    layout: 'fullscreen',
    nextjs: { appDirectory: true },
    docs: {
      description: {
        component:
          'Production campaign editor with a local rich text room, live preview, audience/layout controls and test/send/schedule dialogs. Send and schedule change local lifecycle state; no email is delivered. Service-backed translation panels are omitted.',
      },
    },
  },
} satisfies Meta<typeof Preview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Ready: Story = {};
export const Pending: Story = { args: { state: 'pending' } };
export const Failed: Story = { args: { state: 'failed' } };
export const Disconnected: Story = { args: { state: 'disconnected' } };
export const ActionFailed: Story = { args: { state: 'action-failed' } };
export const Phone: Story = { globals: { viewport: { value: 'phone', isRotated: false } } };
