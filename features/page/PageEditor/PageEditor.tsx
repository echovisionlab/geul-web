'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { IconHistory } from '@tabler/icons-react';
import { useMutation } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { ScrollArea, Stack, Text } from '@mantine/core';
import { Checkbox } from '@/components/core/Input';
import { useDebouncedCallback, useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { EditorHeader } from '@/features/editor/EditorHeader';
import { useEditorPermissionRevocation } from '@/features/editor/useEditorPermissionRevocation';
import { useEditorReloadRequired } from '@/features/editor/useEditorReloadRequired';
import { MediaPreviewGrid } from '@/components/core/MediaPreviewGrid';
import { OgImagePreview } from '@/features/metadata/OgImagePreview';
import { SectionCard } from '@/components/core/Section';
import { ShareLinkSection } from '@/features/share/ShareLinkSection';
import { UrlSection } from '@/features/metadata/UrlSection';
import { VersionHistoryDrawer } from '@/features/version-history';
import { ContentLayoutField, type DocumentLayout } from '@/features/document-layout';
import { getEditorBodyLoadingId, getEditorBodyReadyId } from '@/features/editor/lib/media-test-ids';
import { MetadataPanel } from '@/features/metadata/MetadataPanel/MetadataPanel';
import { SummaryFieldCard } from '@/features/metadata/SummaryFieldCard/SummaryFieldCard';
import { EditorActiveLocaleControl } from '@/features/translation/EditorActiveLocaleControl';
import { EntityTranslationsPanel } from '@/features/translation/EntityTranslationsPanel';
import { isLocaleDocumentEditable } from '@/features/translation/locale-document-mode';
import { useLocaleDocumentSession } from '@/features/translation/useLocaleDocumentSession';
import { LocalizedCollaborativePageBodyEditor } from '@/features/page/PageEditor/LocalizedCollaborativePageBodyEditor';
import {
  deletePageAdminAction,
  publishPageAction,
  regeneratePageOgImageAction,
  unpublishPageAction,
  updatePageShowTitleAction,
  updatePageSlugAction,
} from '@/lib/actions/page';
import { BlockRoomMetadataError, updateBlockRoomLocaleMetadata } from '@/lib/collab/block-room-metadata';
import { PageDocumentMetadataError, updatePageDocumentMetadata } from '@/lib/collab/page-document-metadata';
import { createMapPlaceForBlockWithBrowserClient } from '@/lib/api/map-place-browser-client';
import { EditorRuntimeProvider } from '@/lib/contexts/EditorRuntimeContext';
import { MapPlaceActionProvider } from '@/lib/contexts/MapPlaceActionContext';
import { PageEditorProvider } from '@/features/page/PageEditor/PageEditorContext';
import { useOgImage } from '@/lib/hooks/useOgImage';
import { useOgGenerationLookupSignal } from '@/lib/hooks/useOgGenerationLookupSignal';
import { usePageEditorCollaboration } from './usePageEditorCollaboration';
import { useSlugManagement } from '@/lib/hooks/useSlugManagement';
import { normalizeOgRegenerationLocale } from '@/lib/utils/og-regeneration';
import { buildPageEditPath } from '@/lib/utils/page-route';
import { toNullableSlug, toSlugInputValue } from '@/lib/utils/slug';
import { PageFeaturedImageUploader } from './PageFeaturedImageUploader';
import { PageEditorInterruptionDialogs } from './PageEditorInterruptionDialogs';
import { SectionList } from './SectionList';
import { resolvePageResidentMetadata } from './collaboration-mode';

interface PageEditorProps {
  pageId: string;
  currentMemberId: string;
  canManageTranslations: boolean;
  initialTitle: string;
  initialSummary: string | null;
  initialSourceLocale?: string | null;
  initialRequestedLocale?: string | null;
  initialRequestedLocaleHasEntry?: boolean;
  initialRequestedLocaleTitle?: string | null;
  initialRequestedLocaleSummary?: string | null;
  initialSlug: string | null;
  initialStatus: string;
  initialShowTitle: boolean;
  initialDocumentLayout: DocumentLayout;
  initialFeaturedImageUrl: string | null;
  initialOgImageUrl: string | null;
  userName: string;
  baseUrl: string;
  canonicalOrigin: string;
  siteName: string;
}

export function PageEditor({
  pageId,
  currentMemberId,
  canManageTranslations,
  initialTitle,
  initialSummary,
  initialSourceLocale = null,
  initialRequestedLocale = null,
  initialRequestedLocaleHasEntry = false,
  initialRequestedLocaleTitle = null,
  initialRequestedLocaleSummary = null,
  initialSlug,
  initialStatus,
  initialShowTitle,
  initialDocumentLayout,
  initialFeaturedImageUrl,
  initialOgImageUrl,
  userName,
  baseUrl,
  canonicalOrigin,
  siteName,
}: PageEditorProps) {
  const t = useTranslations('pageEditor');
  const tLayout = useTranslations('contentLayout');
  const tCommon = useTranslations('common');
  const tCommonLabels = useTranslations('common.labels');
  const router = useRouter();
  const [versionHistoryOpened, { open: openVersionHistory, close: closeVersionHistory }] = useDisclosure(false);
  const [featuredImageUrl, setFeaturedImageUrl] = useState(initialFeaturedImageUrl);
  const [slug, setSlug] = useState(initialSlug);
  const [slugMutationErrorReason, setSlugMutationErrorReason] = useState<
    'alreadyExists' | 'invalidPath' | 'emptySegment' | 'dotSegment' | 'reservedRoute' | 'checkFailed' | undefined
  >();
  const [status, setStatus] = useState<'draft' | 'published'>(initialStatus === 'published' ? 'published' : 'draft');
  const [showTitle, setShowTitle] = useState(initialShowTitle);
  const [layout, setLayout] = useState(initialDocumentLayout);

  const localeSession = useLocaleDocumentSession({
    entityType: 'page',
    entityId: pageId,
    sourceTitle: initialTitle,
    sourceSummary: initialSummary ?? '',
    initialSourceLocale,
    initialRequestedLocale,
    initialRequestedLocaleHasEntry,
    initialRequestedLocaleTitle,
    initialRequestedLocaleSummary,
  });
  const { activeEditLocale, roomLocale } = localeSession;
  const ogRegenerationLocale = normalizeOgRegenerationLocale(activeEditLocale.activeLocale);
  const { shouldUseLocaleDocument } = localeSession.mode;
  const { provider, doc, bootstrap, protocol, isConnected, isSynced, reloadCanonical, acceptEpochAck } =
    usePageEditorCollaboration(pageId, roomLocale);
  const [residentTitle, setResidentTitle] = useState(initialTitle);
  const [residentSummary, setResidentSummary] = useState(initialSummary ?? '');
  useEffect(() => {
    const resident = resolvePageResidentMetadata({
      roomLocale,
      bootstrapLocale: bootstrap?.locale ?? null,
      localeMetadata: bootstrap?.localeMetadata,
      fallbackTitle: activeEditLocale.displayTitle,
      fallbackSummary: activeEditLocale.displaySummary,
    });
    setResidentTitle(resident.title);
    setResidentSummary(resident.summary);
  }, [activeEditLocale.displaySummary, activeEditLocale.displayTitle, bootstrap, roomLocale]);
  const permissionRevocation = useEditorPermissionRevocation(provider, 'page', pageId);
  const revision = useEditorReloadRequired(provider);
  const canMutate = !permissionRevocation.blocked && !revision.reloadRequired;
  const hasLocaleRoomMutationAuthority = localeSession.hasRoomMutationAuthority({
    sourceLocale: bootstrap?.sourceLocale ?? null,
    locale: bootstrap?.locale ?? null,
    localeExists: bootstrap?.localeExists ?? false,
    documentRevision: bootstrap?.documentRevision ?? null,
    targetRevision: bootstrap?.targetRevision,
  });
  const currentLocaleCanEdit =
    canManageTranslations && activeEditLocale.canEditActiveLocale && canMutate && hasLocaleRoomMutationAuthority;
  const canEditLocaleDocument = isLocaleDocumentEditable({
    activeLocale: roomLocale,
    shouldUseLocaleDocument,
    canEditActiveLocale: currentLocaleCanEdit,
    isSynced,
  });
  const canEditNeutral = canEditLocaleDocument && activeEditLocale.isSourceLocale;

  const publish = useMutation({
    mutationFn: () => publishPageAction(pageId),
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({ message: result.error, color: 'red' });
        return;
      }
      setStatus('published');
      notifications.show({ message: t('notifications.published'), color: 'green' });
    },
  });

  const unpublish = useMutation({
    mutationFn: () => unpublishPageAction(pageId),
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({ message: result.error, color: 'red' });
        return;
      }
      setStatus('draft');
      notifications.show({ message: t('notifications.unpublished'), color: 'yellow' });
    },
  });

  const deletePage = useMutation({
    mutationFn: () => deletePageAdminAction(pageId),
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({ message: result.error, color: 'red' });
        return;
      }
      notifications.show({ message: t('notifications.deleted'), color: 'red' });
      router.push('/admin/pages');
    },
  });

  const regenerateOgImage = useMutation({
    mutationFn: (request: { locale: string; targetKey: string }) => regeneratePageOgImageAction(pageId, request.locale),
    onSuccess: (result, request) => {
      if (result.error) {
        notifications.show({ message: result.error, color: 'red' });
        return;
      }
      ogImage.trackRequestedGeneration(result.generationId, request.targetKey);
      notifications.show({ message: tCommon('notifications.ogGenerationRequested'), color: 'blue' });
    },
    onError: (error) => {
      notifications.show({
        message: error instanceof Error ? error.message : tCommon('notifications.ogRegenerationFailed'),
        color: 'red',
      });
    },
  });

  const updateShowTitle = useMutation({
    mutationFn: (request: { value: boolean; previous: boolean }) => updatePageShowTitleAction(pageId, request.value),
    onSuccess: (result, request) => {
      if (result.error) {
        setShowTitle(request.previous);
        notifications.show({ message: result.error, color: 'red' });
      }
    },
  });

  const updateLayout = useMutation({
    scope: { id: `page-document-layout:${pageId}` },
    mutationFn: (request: { value: DocumentLayout; previous: DocumentLayout }) => {
      if (!canEditNeutral || !bootstrap || !protocol) {
        throw new Error('Page collaboration is not ready.');
      }
      return updatePageDocumentMetadata(protocol, request.value);
    },
    onSuccess: (ack, request) => {
      if (!acceptEpochAck(ack)) {
        setLayout(request.previous);
        router.refresh();
      }
    },
    onError: (error, request) => {
      setLayout(request.previous);
      if (error instanceof PageDocumentMetadataError && error.reloadRequired) {
        reloadCanonical();
        router.refresh();
      }
      notifications.show({
        message: error instanceof Error ? error.message : tCommon('notifications.updateFailed'),
        color: 'red',
      });
    },
  });

  const updateSlug = useMutation({
    mutationFn: (slug: string | null) => updatePageSlugAction(pageId, slug),
    onSuccess: (result) => {
      if (result.error) {
        const reason = result.reason ?? 'checkFailed';
        setSlugMutationErrorReason(reason);
        notifications.show({ message: t(`slugValidation.${reason}`), color: 'red' });
        return;
      }
      setSlugMutationErrorReason(undefined);
      router.replace(buildPageEditPath(pageId, window.location.search));
    },
    onError: (error) => {
      notifications.show({
        message: error instanceof Error ? error.message : t('notifications.slugUpdateFailed'),
        color: 'red',
      });
    },
  });

  const slugMgmt = useSlugManagement({
    entityType: 'page',
    entityId: pageId,
    slug: toSlugInputValue(slug),
    onSlugChange: (val) => {
      if (canEditNeutral) {
        setSlug(toNullableSlug(val));
      }
    },
    onSave: (newSlug) => {
      if (canEditNeutral) {
        return updateSlug.mutateAsync(toNullableSlug(newSlug));
      }
    },
  });
  const slugErrorReason = slugMgmt.errorReason ?? slugMutationErrorReason;
  const slugError = slugErrorReason ? t(`slugValidation.${slugErrorReason}`) : undefined;

  const debouncedLayoutUpdate = useDebouncedCallback((value: DocumentLayout, previous: DocumentLayout) => {
    updateLayout.mutate({ value, previous });
  }, 500);

  const handleStatusChange = useCallback(
    (nextStatus: 'draft' | 'published') => {
      if (!canEditNeutral) {
        return;
      }
      if (nextStatus === 'published') {
        publish.mutate();
      } else {
        unpublish.mutate();
      }
    },
    [canEditNeutral, publish, unpublish],
  );

  const updateLocaleMetadata = useMutation({
    mutationFn: (metadata: { title?: string; summary?: string | null }) => {
      if (!canEditLocaleDocument || !bootstrap || !protocol || !roomLocale) {
        throw new Error('Page Block room is not ready.');
      }
      return updateBlockRoomLocaleMetadata(protocol, {
        type: 'page',
        locale: roomLocale,
        ...metadata,
      });
    },
    onSuccess: acceptEpochAck,
    onError: (error) => {
      if (error instanceof BlockRoomMetadataError && error.reloadRequired) {
        reloadCanonical();
      }
      notifications.show({
        message: error instanceof Error ? error.message : tCommon('notifications.updateFailed'),
        color: 'red',
      });
    },
  });
  const debouncedTitleUpdate = useDebouncedCallback(
    (value: string) => updateLocaleMetadata.mutate({ title: value }),
    500,
  );
  const debouncedSummaryUpdate = useDebouncedCallback(
    (value: string) => updateLocaleMetadata.mutate({ summary: value }),
    500,
  );
  useEffect(
    () => () => {
      debouncedLayoutUpdate.cancel();
      debouncedTitleUpdate.cancel();
      debouncedSummaryUpdate.cancel();
    },
    [debouncedLayoutUpdate, debouncedSummaryUpdate, debouncedTitleUpdate, roomLocale],
  );

  const handleLocaleTitleChange = useCallback(
    (value: string) => {
      if (!canEditLocaleDocument) {
        return;
      }
      setResidentTitle(value);
      debouncedTitleUpdate(value);
    },
    [canEditLocaleDocument, debouncedTitleUpdate],
  );

  const handleShowTitleChange = useCallback(
    (checked: boolean) => {
      if (!canEditNeutral) {
        return;
      }
      const previous = showTitle;
      setShowTitle(checked);
      updateShowTitle.mutate({ value: checked, previous });
    },
    [canEditNeutral, showTitle, updateShowTitle],
  );

  const handleLayoutChange = useCallback(
    (value: DocumentLayout) => {
      if (!canEditNeutral) {
        return;
      }
      const previous = layout;
      setLayout(value);
      debouncedLayoutUpdate(value, previous);
    },
    [canEditNeutral, debouncedLayoutUpdate, layout],
  );

  const handleLocaleSummaryChange = useCallback(
    (value: string) => {
      if (!canEditLocaleDocument) {
        return;
      }
      setResidentSummary(value);
      debouncedSummaryUpdate(value);
    },
    [canEditLocaleDocument, debouncedSummaryUpdate],
  );

  const pageStatusOptions = [
    {
      value: 'draft' as const,
      label: tCommon('statuses.draft'),
      actionLabel: tCommon('actions.unpublish'),
      tone: 'neutral' as const,
    },
    {
      value: 'published' as const,
      label: tCommon('statuses.published'),
      actionLabel: tCommon('actions.publish'),
      tone: 'positive' as const,
    },
  ];

  const currentTextProvider = provider;
  const ogImage = useOgImage({
    entityType: 'page',
    entityId: pageId,
    initialOgImageUrl: activeEditLocale.isSourceLocale ? initialOgImageUrl : activeEditLocale.displayOgImageUrl,
    locale: activeEditLocale.hasLiveRow ? activeEditLocale.activeLocale : null,
    provider: currentTextProvider,
  });
  useOgGenerationLookupSignal(activeEditLocale.ogGenerationRun, activeEditLocale.activeLocale, ogImage.trackLatest);
  const currentIsConnected = isConnected;
  const currentIsSynced = isSynced;
  const displayedTitle = roomLocale && isSynced ? residentTitle : activeEditLocale.displayTitle;
  const displayedSummary = roomLocale && isSynced ? residentSummary : activeEditLocale.displaySummary;

  return (
    <EditorRuntimeProvider
      provider={currentTextProvider}
      entityType="page"
      entityId={pageId}
      blockRoomProtocol={protocol}
    >
      <Stack h="100%" gap="md">
        <EditorHeader
          title={displayedTitle}
          onTitleChange={canEditLocaleDocument ? handleLocaleTitleChange : undefined}
          titleInputId={`page-${pageId}-title`}
          titlePlaceholder={tCommon('states.untitledEntity', { entity: tCommon('entities.page') })}
          titleDisabled={!canEditLocaleDocument}
          status={status}
          statusOptions={pageStatusOptions}
          isConnected={currentIsConnected}
          isSynced={currentIsSynced}
          onBack={() => router.back()}
          onStatusChange={canEditNeutral ? handleStatusChange : undefined}
          onDelete={canEditNeutral ? () => deletePage.mutate() : undefined}
          deleteConfirmation={{
            title: tCommon('actions.delete'),
            message: (
              <Text>
                {tCommon.rich('messages.confirmDeleteNamedRich', {
                  name: displayedTitle || tCommon('states.untitled'),
                  strong: (chunks) => <strong>{chunks}</strong>,
                })}
              </Text>
            ),
          }}
          isStatusChanging={publish.isPending || unpublish.isPending}
          isDeleting={deletePage.isPending}
          backTooltip={tCommon('actions.back')}
          groupStatusWithCollab
          collabActions={[
            {
              label: tCommonLabels('versionHistory'),
              onClick: openVersionHistory,
              icon: <IconHistory size={16} />,
              disabled: !canEditNeutral,
            },
          ]}
          controls={<EditorActiveLocaleControl state={activeEditLocale} />}
        />

        {/* URL Section */}
        <UrlSection
          baseUrl={baseUrl}
          entityType="page"
          entityId={pageId}
          slug={toSlugInputValue(slug)}
          idPrefix={`page-${pageId}`}
          error={slugError}
          saving={slugMgmt.isChecking || updateSlug.isPending}
          disabled={!canEditNeutral}
          onChange={(value) => {
            setSlugMutationErrorReason(undefined);
            slugMgmt.handleChange(value);
          }}
          onBlur={slugMgmt.handleBlur}
        />

        {/* Share Links */}
        <ShareLinkSection
          entityType="page"
          entityId={pageId}
          description={t('shareLinksDescription')}
          disabled={!canEditNeutral}
        />

        <EntityTranslationsPanel
          entityType="page"
          entityId={pageId}
          canManage={canManageTranslations && canMutate}
          canAdministerTranslations={canManageTranslations && canMutate}
          canMutateTargets={canManageTranslations && canMutate}
        />

        {/* Options */}
        <Stack gap={4}>
          <Text size="xs" c="dimmed">
            {tCommonLabels('options')}
          </Text>
          <Checkbox
            id={`page-${pageId}-show-title`}
            label={t('showTitleOnPage')}
            checked={showTitle}
            onChange={(e) => handleShowTitleChange(e.currentTarget.checked)}
            disabled={!canEditNeutral}
            size="sm"
          />
          <ContentLayoutField
            value={layout}
            onChange={handleLayoutChange}
            disabled={!canEditNeutral}
            labels={{
              contentHeight: tLayout('contentHeight'),
              content: tLayout('content'),
              viewport: tLayout('viewport'),
              pageChrome: tLayout('chrome'),
              footer: tLayout('footer'),
              flow: tLayout('flow'),
              pinned: tLayout('pinned'),
            }}
          />
        </Stack>

        <SummaryFieldCard
          entityType="page"
          entityId={pageId}
          title={displayedTitle}
          summary={displayedSummary}
          summaryReadOnly={!canEditLocaleDocument}
          hideAiActions={!canEditLocaleDocument}
          aiTarget={canEditLocaleDocument && roomLocale ? { type: 'page', id: pageId, locale: roomLocale } : undefined}
          provider={canEditLocaleDocument ? provider : null}
          doc={canEditLocaleDocument ? doc : null}
          currentMemberId={currentMemberId}
          currentMemberDisplayName={userName}
          onSummaryChange={canEditLocaleDocument ? handleLocaleSummaryChange : undefined}
        />

        <MetadataPanel
          title={displayedTitle}
          summary={displayedSummary}
          routePath={`/${slug || pageId}`}
          canonicalOrigin={canonicalOrigin}
          siteName={siteName}
          defaultImageUrl={ogImage.src ?? featuredImageUrl ?? undefined}
          defaultSchemaType="WebPage"
        />

        {/* OG Image & Featured Image */}
        <MediaPreviewGrid>
          <OgImagePreview
            src={ogImage.src}
            canRegenerate={canEditLocaleDocument && activeEditLocale.hasLiveRow && ogRegenerationLocale !== null}
            isRegenerating={regenerateOgImage.isPending || ogImage.isRegenerating}
            generationStatus={ogImage.status}
            generationError={ogImage.error}
            onRegenerate={() => {
              if (ogRegenerationLocale) {
                regenerateOgImage.mutate({
                  locale: ogRegenerationLocale,
                  targetKey: ogImage.targetKey,
                });
              }
            }}
          />
          <PageFeaturedImageUploader
            pageId={pageId}
            imageUrl={featuredImageUrl}
            onImageUrlChange={setFeaturedImageUrl}
            idPrefix={`page-${pageId}-featured-image`}
            canEdit={canEditNeutral}
            onOgGenerationRequested={() => void ogImage.trackLatest()}
          />
        </MediaPreviewGrid>

        {/* Content */}
        <SectionCard style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <Stack flex={1} style={{ minHeight: 0 }}>
            <Text size="sm" fw={500}>
              {tCommon('labels.body')}
            </Text>
            {provider && doc && isSynced && roomLocale ? (
              <MapPlaceActionProvider createMapPlaceForBlock={createMapPlaceForBlockWithBrowserClient}>
                <PageEditorProvider
                  doc={doc}
                  provider={provider}
                  locale={roomLocale}
                  userName={userName}
                  pageId={pageId}
                  editable={canEditLocaleDocument}
                  allowStructuralEdits={canEditNeutral}
                >
                  <ScrollArea id={getEditorBodyReadyId('page', pageId)} flex={1} style={{ minHeight: 0 }}>
                    {activeEditLocale.isSourceLocale ? (
                      <SectionList />
                    ) : (
                      <LocalizedCollaborativePageBodyEditor
                        fallbackText={tCommon('states.none')}
                        editable={canEditLocaleDocument}
                      />
                    )}
                  </ScrollArea>
                </PageEditorProvider>
              </MapPlaceActionProvider>
            ) : (
              <Stack id={getEditorBodyLoadingId('page', pageId)} justify="center" mih={200}>
                <Text size="sm" c="dimmed">
                  {tCommon('labels.body')}
                </Text>
              </Stack>
            )}
          </Stack>
        </SectionCard>

        {/* Version History */}
        <VersionHistoryDrawer
          entityType="page"
          entityId={pageId}
          opened={versionHistoryOpened}
          onClose={closeVersionHistory}
          currentSourceLocale={activeEditLocale.sourceLocale}
          canRestore={canEditNeutral}
          onRestored={async () => {
            reloadCanonical();
            await ogImage.trackLatest();
          }}
        />

        <PageEditorInterruptionDialogs
          interruption={permissionRevocation.interruption}
          reloadRequired={revision.reloadRequired}
          permissionRevokedDestination={status === 'published' ? `/${slug || pageId}` : '/'}
          navigate={(destination) => router.replace(destination)}
        />
      </Stack>
    </EditorRuntimeProvider>
  );
}
