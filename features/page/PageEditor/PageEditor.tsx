'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { IconHistory } from '@tabler/icons-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { ScrollArea, Stack, Text } from '@mantine/core';
import { Checkbox } from '@/components/core/Input';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { EditorHeader } from '@/features/editor/EditorHeader';
import { useEditorPermissionRevocation } from '@/features/editor/useEditorPermissionRevocation';
import { MediaPreviewGrid } from '@/components/core/MediaPreviewGrid';
import { OgImagePreview } from '@/features/metadata/OgImagePreview';
import { Button } from '@/components/core/Button';
import { SectionCard, SectionHeader } from '@/components/core/Section';
import { ShareLinkSection } from '@/features/share/ShareLinkSection';
import { UrlSection } from '@/features/metadata/UrlSection';
import { VersionHistoryDrawer } from '@/features/version-history';
import type { DocumentLayout } from '@/features/document-layout';
import { ContentLayoutField } from '@/features/document-layout/ContentLayoutField';
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
  getPageAccessTagOptionsAction,
  publishPageAction,
  regeneratePageOgImageAction,
  unpublishPageAction,
  updatePageSlugAction,
} from '@/lib/actions/page';
import { updateBlockRoomLocaleMetadata } from '@/lib/collab/block-room-metadata';
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
import { usePageResidentMetadata } from './usePageResidentMetadata';
import type { PageAccessPolicyValue } from '@/lib/types/page-access';
import { PageAccessSettings } from './PageAccessSettings';
import { usePageNeutralConfiguration } from './usePageNeutralConfiguration';
import { useDebouncedRoomMetadata } from '@/lib/editor/useDebouncedRoomMetadata';
import { useDebouncedPatch } from '@/lib/editor/useDebouncedPatch';
import { createBlockRoomDocumentName } from '@/lib/collab/block-room-bootstrap';
import { useEditorNavigation } from '@/features/editor/useEditorNavigation';
import { applyPageLayoutMetadataUpdate } from './page-layout-metadata';
import { useBlockRoomMetadataUpdates } from '@/lib/editor/useBlockRoomMetadataUpdates';
import { requireBlockRoomDurabilityProtocol } from '@/lib/collab/block-room-durability';
import { flushEditorSaves } from '@/lib/editor/editor-save-registry';

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
  initialAccessPolicy: PageAccessPolicyValue;
  initialDocumentLayout: DocumentLayout;
  initialFeaturedImageUrl: string | null;
  initialOgImageUrl: string | null;
  userName: string;
  baseUrl: string;
  canonicalOrigin: string;
  siteName: string;
}

interface PageLayoutPatch {
  value: DocumentLayout;
  previous: DocumentLayout;
}

export async function runPageLifecycleActionAfterSave(
  pageId: string,
  action: () => Promise<unknown>,
  onSaveFailure: () => void,
): Promise<boolean> {
  let saved = false;
  try {
    saved = await flushEditorSaves(`page:${pageId}`);
  } catch {
    saved = false;
  }
  if (!saved) {
    onSaveFailure();
    return false;
  }
  await action();
  return true;
}

export function runPageStatusChangeAfterSave(
  pageId: string,
  nextStatus: 'draft' | 'published',
  actions: { publish: () => Promise<unknown>; unpublish: () => Promise<unknown> },
  onSaveFailure: () => void,
): Promise<boolean> {
  return runPageLifecycleActionAfterSave(
    pageId,
    nextStatus === 'published' ? actions.publish : actions.unpublish,
    onSaveFailure,
  );
}

function mergePageLayoutPatches(pending: PageLayoutPatch, next: PageLayoutPatch): PageLayoutPatch {
  return { value: next.value, previous: pending.previous };
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
  initialAccessPolicy,
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
  const navigateWithSave = useEditorNavigation(`page:${pageId}`);
  const [versionHistoryOpened, { open: openVersionHistory, close: closeVersionHistory }] = useDisclosure(false);
  const [featuredImageUrl, setFeaturedImageUrl] = useState(initialFeaturedImageUrl);
  const [slugMutationErrorReason, setSlugMutationErrorReason] = useState<
    'alreadyExists' | 'invalidPath' | 'emptySegment' | 'dotSegment' | 'reservedRoute' | 'checkFailed' | undefined
  >();
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
  const layoutDocumentName = useMemo(() => {
    if (!roomLocale) {
      return null;
    }
    try {
      return createBlockRoomDocumentName('page', pageId, roomLocale);
    } catch {
      return null;
    }
  }, [pageId, roomLocale]);
  const ogRegenerationLocale = normalizeOgRegenerationLocale(activeEditLocale.activeLocale);
  const { shouldUseLocaleDocument } = localeSession.mode;
  const { provider, doc, bootstrap, protocol, isConnected, isSynced, reloadCanonical, acceptEpochAck } =
    usePageEditorCollaboration(pageId, roomLocale);
  const durabilityProtocol = useMemo(
    () => (protocol ? requireBlockRoomDurabilityProtocol(protocol) : null),
    [protocol],
  );
  const initialNeutralConfiguration = useMemo(
    () => ({
      slug: initialSlug,
      showTitle: initialShowTitle,
      accessPolicy: initialAccessPolicy,
      status: initialStatus === 'published' ? ('published' as const) : ('draft' as const),
    }),
    [initialAccessPolicy, initialShowTitle, initialSlug, initialStatus],
  );
  const pageNeutral = usePageNeutralConfiguration({
    pageId,
    initialConfiguration: initialNeutralConfiguration,
    provider,
    onShowTitleSaveError: (message) => notifications.show({ message, color: 'red' }),
  });
  const { configuration: neutralConfiguration, setDraft, isDraft, beginFieldWrite, queueShowTitle } = pageNeutral;
  const { slug, showTitle, status, accessPolicy } = neutralConfiguration;
  const lifecycleCommandInFlight = useRef(false);
  const {
    title: residentTitle,
    summary: residentSummary,
    setTitle: setResidentTitle,
    setSummary: setResidentSummary,
    adoptPeerUpdate,
  } = usePageResidentMetadata({
    roomIdentity: provider,
    sessionLocale: activeEditLocale.activeLocale,
    roomLocale,
    bootstrap,
    fallbackTitle: activeEditLocale.displayTitle,
    fallbackSummary: activeEditLocale.displaySummary,
  });
  useBlockRoomMetadataUpdates({ protocol }, `page:${pageId}`, ({ operation, values }) => {
    if (operation === 'locale') {
      adoptPeerUpdate({ operation, values });
      return;
    }
    if (operation === 'page_layout') {
      setLayout((current) => applyPageLayoutMetadataUpdate(current, values));
    }
  });
  const permissionRevocation = useEditorPermissionRevocation(provider, 'page', pageId);
  const canMutate = !permissionRevocation.blocked;
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
  const accessTags = useQuery({
    queryKey: ['page-access-tags'],
    enabled: canEditNeutral,
    queryFn: async () => {
      const result = await getPageAccessTagOptionsAction();
      if (!result.ok) {
        throw new Error(result.error);
      }
      return result.tagOptions;
    },
    retry: false,
  });
  const handleAccessSave = useCallback(
    async (value: PageAccessPolicyValue) => {
      if (!canEditNeutral) {
        return { ok: false as const, error: tCommon('notifications.saveFailed') };
      }
      return pageNeutral.saveAccess(value);
    },
    [canEditNeutral, pageNeutral.saveAccess, tCommon],
  );

  const publish = useMutation({
    mutationFn: async () => {
      const write = beginFieldWrite('status');
      try {
        const result = await publishPageAction(pageId);
        if (result.ok) {
          write.acknowledge(result.status);
        } else {
          write.fail();
        }
        return result;
      } catch (error) {
        write.fail();
        throw error;
      }
    },
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({ message: result.error, color: 'red' });
        return;
      }
      notifications.show({ message: t('notifications.published'), color: 'green' });
    },
  });

  const unpublish = useMutation({
    mutationFn: async () => {
      const write = beginFieldWrite('status');
      try {
        const result = await unpublishPageAction(pageId);
        if (result.ok) {
          write.acknowledge(result.status);
        } else {
          write.fail();
        }
        return result;
      } catch (error) {
        write.fail();
        throw error;
      }
    },
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({ message: result.error, color: 'red' });
        return;
      }
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

  const updateLayout = useMutation({
    scope: { id: `page-document-layout:${pageId}` },
    mutationFn: async (request: PageLayoutPatch) => {
      if (!canEditNeutral || !bootstrap || !protocol) {
        throw new Error('Page collaboration is not ready.');
      }
      const ack = await updatePageDocumentMetadata(protocol, request.value, request.previous);
      if (!acceptEpochAck(ack)) {
        throw new PageDocumentMetadataError(tCommon('notifications.saveFailed'), true);
      }
      return ack;
    },
    onError: (error) => {
      if (error instanceof PageDocumentMetadataError && error.reloadRequired) {
        reloadCanonical();
      }
      notifications.show({
        message: error instanceof Error ? error.message : tCommon('notifications.updateFailed'),
        color: 'red',
      });
    },
  });

  const updateSlug = useMutation({
    mutationFn: async (nextSlug: string | null) => {
      const write = beginFieldWrite('slug');
      try {
        const result = await updatePageSlugAction(pageId, nextSlug);
        if (result.ok) {
          write.acknowledge(result.slug);
        } else {
          write.fail(false);
        }
        return result;
      } catch (error) {
        write.fail(false);
        throw error;
      }
    },
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
        setDraft('slug', toNullableSlug(val));
      }
    },
    onSave: (newSlug) => {
      if (canEditNeutral && isDraft('slug')) {
        return updateSlug.mutateAsync(toNullableSlug(newSlug));
      }
    },
  });
  const slugErrorReason = slugMgmt.errorReason ?? slugMutationErrorReason;
  const slugError = slugErrorReason ? t(`slugValidation.${slugErrorReason}`) : undefined;

  const debouncedLayoutUpdate = useDebouncedPatch({
    document: `page:${pageId}`,
    scope: layoutDocumentName ?? pageId,
    recoveryScope: layoutDocumentName,
    recoveryKey: 'page-layout',
    delay: 500,
    merge: mergePageLayoutPatches,
    retry: true,
    write: (request: PageLayoutPatch) => updateLayout.mutateAsync(request).then(() => undefined),
  });

  const handleStatusChange = useCallback(
    async (nextStatus: 'draft' | 'published') => {
      if (!canEditNeutral || lifecycleCommandInFlight.current) {
        return;
      }
      lifecycleCommandInFlight.current = true;
      try {
        await runPageStatusChangeAfterSave(
          pageId,
          nextStatus,
          { publish: () => publish.mutateAsync(), unpublish: () => unpublish.mutateAsync() },
          () => notifications.show({ message: tCommon('notifications.saveFailed'), color: 'red' }),
        );
      } catch {
        // The mutation owns action errors; the save barrier reports its own failures above.
      } finally {
        lifecycleCommandInFlight.current = false;
      }
    },
    [canEditNeutral, pageId, publish, tCommon, unpublish],
  );

  const debouncedMetadataUpdate = useDebouncedRoomMetadata({
    connection: { protocol, bootstrap, acceptEpochAck, reloadCanonical },
    document: `page:${pageId}`,
    delay: 500,
    write: (protocol, metadata: { title?: string; summary?: string | null }) =>
      updateBlockRoomLocaleMetadata(protocol, { type: 'page', locale: roomLocale!, ...metadata }),
  });
  const handleLocaleTitleChange = useCallback(
    (value: string) => {
      if (!canEditLocaleDocument) {
        return;
      }
      setResidentTitle(value);
      if (canEditNeutral) {
        slugMgmt.updateFromTitle(value);
      }
      debouncedMetadataUpdate({ title: value });
    },
    [canEditNeutral, slugMgmt.updateFromTitle, canEditLocaleDocument, debouncedMetadataUpdate],
  );

  const handleShowTitleChange = useCallback(
    (checked: boolean) => {
      if (!canEditNeutral) {
        return;
      }
      setDraft('showTitle', checked);
      queueShowTitle(checked);
    },
    [canEditNeutral, queueShowTitle, setDraft],
  );

  const handleLayoutChange = useCallback(
    (value: DocumentLayout) => {
      if (!canEditNeutral) {
        return;
      }
      const previous = layout;
      setLayout(value);
      debouncedLayoutUpdate({ value, previous });
    },
    [canEditNeutral, debouncedLayoutUpdate, layout],
  );

  const handleLocaleSummaryChange = useCallback(
    (value: string) => {
      if (!canEditLocaleDocument) {
        return;
      }
      setResidentSummary(value);
      debouncedMetadataUpdate({ summary: value });
    },
    [canEditLocaleDocument, debouncedMetadataUpdate],
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
          onBack={() => {
            void navigateWithSave(() => router.back());
          }}
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
          isAvailable={slugMgmt.isAvailable}
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

        <SectionCard>
          <Stack gap="md">
            <SectionHeader title={t('access.title')} />
            {accessTags.isError ? (
              <Stack gap="xs">
                <Text size="sm" c="red" role="alert">
                  {t('access.tagsLoadError')}
                </Text>
                <Button
                  tone="neutral"
                  emphasis="low"
                  onClick={() => void accessTags.refetch()}
                  disabled={!canEditNeutral}
                >
                  {t('access.tagsRetry')}
                </Button>
              </Stack>
            ) : null}
            <PageAccessSettings
              key={pageId}
              value={accessPolicy}
              tagOptions={accessTags.data ?? []}
              loadingTags={accessTags.isLoading || accessTags.isError}
              disabled={!canEditNeutral}
              onSave={handleAccessSave}
            />
          </Stack>
        </SectionCard>

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
            {provider && doc && durabilityProtocol && isSynced && roomLocale ? (
              <MapPlaceActionProvider createMapPlaceForBlock={createMapPlaceForBlockWithBrowserClient}>
                <PageEditorProvider
                  doc={doc}
                  provider={provider}
                  protocol={durabilityProtocol}
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
          permissionRevokedDestination={status === 'published' ? `/${slug || pageId}` : '/'}
          navigate={(destination) => router.replace(destination)}
        />
      </Stack>
    </EditorRuntimeProvider>
  );
}
