import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { Meta, StoryObj } from '@storybook/nextjs';
import { LegalPolicyEditorView, type LegalPolicyEditorViewModel } from '@/features/policy/LegalPolicyEditor';
import type { PolicyEditorInstance } from '@/features/policy/PolicyEditor/PolicyEditor';
import { policyTiptapDocumentToHtml } from '@/features/editor/tiptap/profiles/PolicyTiptapEditor';
import { DOCUMENT_TITLE_HEADING_LEVEL } from '@/features/document-layout/ui/document-heading-level';
import { useDateTimeFormatter } from '@/features/date-time/DateTime';
import { TERMS_EDITOR_STRATEGY } from '@/features/policy/TermsEditor';
import { PRIVACY_EDITOR_STRATEGY } from '@/features/policy/PrivacyEditor';
import { PageLoader } from '@/features/site/PageLoader';
import { DocumentEditorFrame, editorPageParameters, editorStateArgTypes } from './fixtures/DocumentEditorFrame';
import { useDocumentEditor, pending, type EditorPreviewState } from './fixtures/use-document-editor';
export function LegalEditorPreview({
  entity = 'terms',
  state = 'ready',
  preview = false,
}: {
  entity?: 'terms' | 'privacy';
  state?: EditorPreviewState;
  preview?: boolean;
}) {
  const local = useDocumentEditor(entity === 'terms' ? 'terms-history' : 'privacy-history', state);
  const t = useTranslations(entity === 'terms' ? 'termsEditor' : 'privacyEditor'),
    tLegalEditorCommon = useTranslations('legalEditorCommon'),
    tActions = useTranslations('common.actions'),
    tCommonEntities = useTranslations('common.entities'),
    tLabels = useTranslations('common.labels'),
    tCommonMessages = useTranslations('common.messages'),
    tCommonPlaceholders = useTranslations('common.placeholders'),
    tCommonStates = useTranslations('common.states'),
    tStatuses = useTranslations('common.statuses');
  const dateTime = useDateTimeFormatter();
  const strategy = entity === 'terms' ? TERMS_EDITOR_STRATEGY : PRIVACY_EDITOR_STRATEGY;
  const editorRef = useRef<PolicyEditorInstance | null>(null);
  const [viewMode, setViewMode] = useState(preview ? 'preview' : 'edit'),
    [activePreviewHtml, setPreviewHtml] = useState(
      '<p>스토리북에서 정책 본문과 메타데이터를 확인하고 편집할 수 있습니다.</p>',
    );
  const [status, setStatus] = useState<string>(strategy.status.draft),
    [policyEditorError, setPolicyEditorError] = useState<string | null>(null),
    [effectiveFrom, setEffectiveFrom] = useState<Date | null>(null);
  const [scheduleModalOpened, setScheduleModalOpened] = useState(false),
    [cancelModalOpened, setCancelModalOpened] = useState(false),
    [activateModalOpened, setActivateModalOpened] = useState(false),
    [deleteModalOpened, setDeleteModalOpened] = useState(false);
  useEffect(() => {
    for (const locale of ['ko', 'en']) {
      local.client.setQueryData(['legalOgImage', entity, locale], { data: { url: null } });
    }
  }, [local.client, entity]);
  if (!local.room || !local.session) {
    return <PageLoader />;
  }
  const model: LegalPolicyEditorViewModel = {
    currentProvider: local.room.provider,
    strategy,
    policyId: `local-${entity}-history`,
    blockRoom: { protocol: null },
    displayedTitle: local.title,
    canEditDisplayedTitle: local.canEdit,
    handleDisplayedTitleChange: local.setTitle,
    policyData: { status, version: 1, effectiveFrom },
    tStatuses,
    currentIsConnected: local.connected,
    currentIsSynced: local.connected,
    router: local.router,
    tActions,
    canDelete: local.canEdit,
    openDeleteModal: () => setDeleteModalOpened(true),
    activeEditLocale: local.activeEditLocale,
    canSchedule: local.canEdit && strategy.status.isDraft(status),
    openScheduleModal: () => setScheduleModalOpened(true),
    canCancelSchedule: local.canEdit && strategy.status.isScheduled(status),
    openCancelModal: () => setCancelModalOpened(true),
    canActivateNow: local.canEdit && !strategy.status.isActive(status),
    openActivateModal: () => setActivateModalOpened(true),
    isEditable: local.canEdit,
    regenerateHtmlMutation: {
      isPending: false,
      mutate: () => {
        if (editorRef.current) {
          setPreviewHtml(
            policyTiptapDocumentToHtml(editorRef.current.state.doc, {
              headingParentLevel: DOCUMENT_TITLE_HEADING_LEVEL,
            }),
          );
        }
      },
    },
    handleExport: () => window.print(),
    tLegalEditorCommon,
    dateTime,
    t,
    policyEditorError,
    ogBackgroundUrl: null,
    sourceTitleGeneration: null,
    isEditingTranslation: local.locale !== 'ko',
    viewMode,
    handleViewModeChange: (value) => {
      if (editorRef.current) {
        setPreviewHtml(
          policyTiptapDocumentToHtml(editorRef.current.state.doc, { headingParentLevel: DOCUMENT_TITLE_HEADING_LEVEL }),
        );
      }
      setViewMode(value);
    },
    tLabels,
    editorSession: local.session,
    canEditCurrentLocale: local.canEdit,
    handleEditorReady: (editor) => {
      editorRef.current = editor;
    },
    setPolicyEditorError,
    tCommonStates,
    tCommonEntities,
    activePreviewHtml,
    canonicalPreviewBlocks: null,
    siteSettings: null,
    contactEmail: 'studio@example.com',
    scheduleModalOpened,
    closeScheduleModal: () => setScheduleModalOpened(false),
    tCommonMessages,
    tModalActions: tActions,
    tCommonPlaceholders,
    effectiveFrom,
    setEffectiveFrom,
    handleSchedule: () => {
      if (effectiveFrom) {
        setStatus(strategy.status.scheduled);
        setScheduleModalOpened(false);
      }
    },
    scheduleMutation: pending,
    cancelModalOpened,
    closeCancelModal: () => setCancelModalOpened(false),
    cancelScheduleMutation: {
      isPending: false,
      mutate: () => {
        setStatus(strategy.status.draft);
        setCancelModalOpened(false);
      },
    },
    activateModalOpened,
    closeActivateModal: () => setActivateModalOpened(false),
    activateNowMutation: {
      isPending: false,
      mutate: () => {
        setStatus(strategy.status.active);
        setActivateModalOpened(false);
      },
    },
    deleteModalOpened,
    closeDeleteModal: () => setDeleteModalOpened(false),
    deleteMutation: local.deleteMutation,
  };
  return (
    <DocumentEditorFrame client={local.client} completed={local.deleted}>
      <LegalPolicyEditorView model={model} />
    </DocumentEditorFrame>
  );
}
const meta = {
  argTypes: editorStateArgTypes,
  title: 'Pages/Editors/Legal',
  component: LegalEditorPreview,
  excludeStories: ['LegalEditorPreview'],
  args: { entity: 'terms', state: 'ready', preview: false },
  parameters: editorPageParameters,
} satisfies Meta<typeof LegalEditorPreview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Terms: Story = {};
export const Privacy: Story = { args: { entity: 'privacy' } };
export const PreviewContent: Story = { args: { preview: true } };
export const Disconnected: Story = { args: { state: 'disconnected' } };
export const ReadOnly: Story = { args: { state: 'readonly' } };
export const Phone: Story = { globals: { viewport: { value: 'phone', isRotated: false } } };
