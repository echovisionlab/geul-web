'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { TranscodeEntityType } from '@echovisionlab/geul-proto/secure/events_pb.ts';
import { IconHistory } from '@tabler/icons-react';
import { useMutation } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Box, Stack, Text } from '@mantine/core';
import { useDebouncedCallback } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { EditorHeader } from '@/features/editor/EditorHeader';
import { MediaPreviewGrid } from '@/components/core/MediaPreviewGrid';
import { OgImagePreview } from '@/features/metadata/OgImagePreview';
import { PageLoader } from '@/features/site/PageLoader';
import { SectionCard } from '@/components/core/Section';
import { ShareLinkSection } from '@/features/share/ShareLinkSection';
import { UrlSection } from '@/features/metadata/UrlSection';
import { VersionHistoryDrawer } from '@/features/version-history';
import { getEditorBodyLoadingId, getEditorBodyReadyId } from '@/features/editor/lib/media-test-ids';
import { MetadataPanel } from '@/features/metadata/MetadataPanel/MetadataPanel';
import { SummaryFieldCard } from '@/features/metadata/SummaryFieldCard/SummaryFieldCard';
import { CreatePlaceModal, type CreatePlaceFormState } from '@/features/place/CreatePlaceModal';
import { LocationSelector } from '@/features/post/PostEditor/LocationSelector';
import { EditorActiveLocaleControl } from '@/features/translation/EditorActiveLocaleControl';
import { EntityTranslationsPanel } from '@/features/translation/EntityTranslationsPanel';
import { LocalizedRichTextFragmentEditor } from '@/features/translation/LocalizedRichTextFragmentEditor';
import { useRichTextBlockRoomController } from '@/features/editor/hooks/useBlockRoomTiptapController';
import {
  regenerateWorkOgImageAction,
  updateWorkAction,
  updateWorkFieldsAction,
  updateWorkSlugAction,
} from '@/lib/actions/work';
import {
  createMapPlaceForBlockWithBrowserClient,
  createMapPlaceWithBrowserClient,
} from '@/lib/api/map-place-browser-client';
import { EditorRuntimeProvider } from '@/lib/contexts/EditorRuntimeContext';
import { MapPlaceActionProvider } from '@/lib/contexts/MapPlaceActionContext';
import { useWorkMeta, WorkMetaProvider, type WorkMeta, type WorkType } from '@/lib/contexts/WorkMetaContext';
import { useOgImage } from '@/lib/hooks/useOgImage';
import { useOgGenerationLookupSignal } from '@/lib/hooks/useOgGenerationLookupSignal';
import { BlockRoomMetadataError, updateBlockRoomLocaleMetadata } from '@/lib/collab/block-room-metadata';
import { useSlugManagement } from '@/lib/hooks/useSlugManagement';
import { toNullableSlug, toSlugInputValue } from '@/lib/utils/slug';
import { WorkClientsSection } from './WorkClientsSection';
import { WorkCreditsSection } from './WorkCreditsSection';
import { WorkFeaturedImageUploader } from './WorkFeaturedImageUploader';
import { WorkMetaForm } from './WorkMetaForm';
import { useWorkLifecycle } from './useWorkLifecycle';

interface ClientDetails {
  id: string;
  name: string;
  logoUrl: string | null;
  logoLightUrl?: string | null;
  logoDarkUrl?: string | null;
  website: string | null;
}

interface WorkEditorProps {
  workId: string;
  currentMemberId: string;
  initialTitle: string;
  initialSlug: string | null;
  initialType: WorkType;
  initialYear: number;
  initialMonth: number;
  initialUntilYear: number | null;
  initialUntilMonth: number | null;
  initialIsPresent: boolean;
  initialSummary: string | null;
  initialMetadata: Record<string, unknown>;
  initialFeatured: boolean;
  initialStatus: string;
  initialMapPlaceId: string | null;
  initialFeaturedImageUrl: string | null;
  initialOgImageUrl: string | null;
  initialClients?: string[]; // Client IDs for Y.js sync
  initialClientDetails?: ClientDetails[]; // Client details for display
  userName: string;
  isAdmin: boolean;
  canEdit: boolean;
  baseUrl: string;
  canonicalOrigin: string;
  siteName: string;
  onBack?: () => void;
}

export function WorkEditor(props: WorkEditorProps) {
  const initialMeta: WorkMeta = {
    title: props.initialTitle,
    slug: props.initialSlug,
    type: props.initialType,
    year: props.initialYear,
    month: props.initialMonth,
    untilYear: props.initialUntilYear,
    untilMonth: props.initialUntilMonth,
    isPresent: props.initialIsPresent,
    summary: props.initialSummary || '',
    metadata: props.initialMetadata,
    featured: props.initialFeatured,
    creditsVersion: 0,
    creditOrder: [],
    clients: props.initialClients ?? [],
  };

  return (
    <WorkMetaProvider
      key={props.workId}
      workId={props.workId}
      initialMeta={initialMeta}
      initialFeaturedImageUrl={props.initialFeaturedImageUrl}
    >
      <MapPlaceActionProvider createMapPlaceForBlock={createMapPlaceForBlockWithBrowserClient}>
        <WorkEditorContent {...props} />
      </MapPlaceActionProvider>
    </WorkMetaProvider>
  );
}

function WorkEditorContent({
  workId,
  currentMemberId,
  initialTitle,
  initialSummary: _initialSummary,
  initialStatus,
  initialMapPlaceId,
  initialOgImageUrl,
  initialClientDetails,
  userName,
  isAdmin,
  canEdit,
  baseUrl,
  canonicalOrigin,
  siteName,
  onBack,
}: WorkEditorProps) {
  const t = useTranslations('workEditor');
  const tCommon = useTranslations('common');
  const tCommonLabels = useTranslations('common.labels');
  const router = useRouter();
  const handleBack = onBack ?? (() => router.back());
  const lifecycle = useWorkLifecycle({ workId, initialStatus, canEdit, isAdmin, onDeleted: handleBack });
  const { status } = lifecycle;
  const canEditWork = lifecycle.canEdit;
  const [mapPlaceId, setMapPlaceId] = useState<string | null>(initialMapPlaceId);
  const [createPlaceOpened, setCreatePlaceOpened] = useState(false);
  const [createPlaceInitialName, setCreatePlaceInitialName] = useState('');
  const [versionHistoryOpened, setVersionHistoryOpened] = useState(false);

  const {
    slug,
    type,
    year,
    month,
    untilYear,
    untilMonth,
    isPresent,
    metadata,
    featured,
    setTitle,
    setSlug,
    setType,
    setPeriod,
    setSummary,
    setMetadata,
    setFeatured,
    featuredImageUrl,
    provider,
    doc,
    isConnected,
    isSynced,
    bootstrap,
    protocol,
    acceptEpochAck,
    reloadCanonical,
    roomLocale,
    localeSession,
  } = useWorkMeta();
  const { activeEditLocale } = localeSession;
  const canEditTranslationSource = canEditWork;
  const hasLocaleRoomMutationAuthority = localeSession.hasRoomMutationAuthority({
    sourceLocale: bootstrap?.sourceLocale ?? null,
    locale: bootstrap?.locale ?? null,
    localeExists: bootstrap?.localeExists ?? false,
    documentRevision: bootstrap?.documentRevision ?? null,
    targetRevision: bootstrap?.targetRevision,
  });
  const currentLocaleCanEdit = canEditWork && activeEditLocale.canEditActiveLocale && hasLocaleRoomMutationAuthority;
  const canEditNeutral = currentLocaleCanEdit && activeEditLocale.isSourceLocale;
  const currentProvider = provider;
  const currentDoc = doc;
  const currentIsConnected = isConnected;
  const currentIsSynced = isSynced;
  const blockRoomController = useRichTextBlockRoomController('work', currentDoc, roomLocale);

  const periodRef = useRef({
    year,
    month,
    untilYear,
    untilMonth,
    isPresent,
  });
  periodRef.current = {
    year,
    month,
    untilYear,
    untilMonth,
    isPresent,
  };

  const ogImage = useOgImage({
    entityType: 'work',
    entityId: workId,
    initialOgImageUrl: activeEditLocale.isSourceLocale ? initialOgImageUrl : activeEditLocale.displayOgImageUrl,
    locale: activeEditLocale.hasLiveRow ? activeEditLocale.activeLocale : null,
    provider: currentProvider,
  });
  useOgGenerationLookupSignal(activeEditLocale.ogGenerationRun, activeEditLocale.activeLocale, ogImage.trackLatest);

  const regenerateOgImage = useMutation({
    mutationFn: (request: { locale: string; targetKey: string }) => regenerateWorkOgImageAction(workId, request.locale),
    onSuccess: (result, request) => {
      if (result.error) {
        notifications.show({ message: result.error, color: 'red' });
      }
      notifications.show({ message: tCommon('notifications.ogGenerationRequested'), color: 'blue' });
      ogImage.trackRequestedGeneration(result.generationId, request.targetKey);
    },
  });

  const updateSlug = useMutation({
    mutationFn: (slug: string | null) => updateWorkSlugAction(workId, slug),
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({ message: result.error, color: 'red' });
      }
    },
  });

  const updateWork = useMutation({
    mutationFn: (data: { mapPlaceId?: string | null }) => updateWorkAction(workId, data),
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({ message: result.error, color: 'red' });
      }
    },
    onError: (error) => {
      notifications.show({
        message: error instanceof Error ? error.message : t('notifications.updateFailed'),
        color: 'red',
      });
    },
  });

  const updateWorkFields = useMutation({
    mutationFn: (data: Parameters<typeof updateWorkFieldsAction>[1]) => updateWorkFieldsAction(workId, data),
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({ message: result.error, color: 'red' });
      }
    },
    onError: (error) => {
      notifications.show({
        message: error instanceof Error ? error.message : t('notifications.updateFailed'),
        color: 'red',
      });
    },
  });

  const createPlace = useMutation({
    mutationFn: (data: CreatePlaceFormState) =>
      createMapPlaceWithBrowserClient({
        name: data.name,
        address: data.address,
        lat: data.lat,
        lng: data.lng,
        google_place_id: data.googlePlaceId,
        address_components: data.addressComponents ?? undefined,
      }),
    onSuccess: (result) => {
      if (result.error || !result.data?.id) {
        notifications.show({
          message: result.error || tCommon('notifications.createPlaceFailed'),
          color: 'red',
        });
        return;
      }

      const nextMapPlaceId = result.data.id;
      setMapPlaceId(nextMapPlaceId);
      updateWork.mutate({ mapPlaceId: nextMapPlaceId });
      setCreatePlaceOpened(false);
      notifications.show({
        message: tCommon('notifications.placeCreatedAndLinked'),
        color: 'green',
      });
    },
    onError: (error) => {
      notifications.show({
        message: error instanceof Error ? error.message : tCommon('notifications.createPlaceFailed'),
        color: 'red',
      });
    },
  });

  // Slug management
  const slugMgmt = useSlugManagement({
    entityType: 'work',
    entityId: workId,
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

  const [residentTitle, setResidentTitle] = useState(initialTitle);
  const [residentSummary, setResidentSummary] = useState(_initialSummary ?? '');
  useEffect(() => {
    setResidentTitle(activeEditLocale.displayTitle);
    setResidentSummary(activeEditLocale.displaySummary);
  }, [activeEditLocale.displaySummary, activeEditLocale.displayTitle, roomLocale]);

  const updateResidentMetadata = useMutation({
    mutationFn: (update: { locale: string; sourceTitle?: string; summary?: string | null }) => {
      if (!bootstrap || !protocol) {
        throw new Error('Work Block room is not ready.');
      }
      return updateBlockRoomLocaleMetadata(protocol, {
        type: 'work',
        ...update,
      });
    },
    onSuccess: (ack) => {
      acceptEpochAck(ack);
    },
    onError: (error) => {
      if (error instanceof BlockRoomMetadataError && error.reloadRequired) {
        reloadCanonical();
      }
      notifications.show({
        message: error instanceof Error ? error.message : t('notifications.updateFailed'),
        color: 'red',
      });
    },
  });
  const debouncedResidentMetadataUpdate = useDebouncedCallback(
    (update: { locale: string; sourceTitle?: string; summary?: string | null }) => {
      updateResidentMetadata.mutate(update);
    },
    500,
  );
  const debouncedWorkFieldsUpdate = useDebouncedCallback((update: Parameters<typeof updateWorkFieldsAction>[1]) => {
    updateWorkFields.mutate(update);
  }, 500);
  const handleScopedLocaleTitleChange = useCallback(
    (value: string) => {
      if (!roomLocale || !currentLocaleCanEdit) {
        return;
      }
      setResidentTitle(value);
      debouncedResidentMetadataUpdate({ locale: roomLocale, sourceTitle: value });
      if (activeEditLocale.isSourceLocale) {
        setTitle(value);
      }
    },
    [activeEditLocale.isSourceLocale, currentLocaleCanEdit, debouncedResidentMetadataUpdate, roomLocale, setTitle],
  );

  const handleMetaChange = useCallback(
    (
      updates: Partial<{
        type: WorkType;
        year: number;
        month: number;
        untilYear: number | null;
        untilMonth: number | null;
        isPresent: boolean;
        metadata: Record<string, unknown>;
        featured: boolean;
      }>,
    ) => {
      if (!canEditNeutral) {
        return;
      }
      const durableUpdate: Parameters<typeof updateWorkFieldsAction>[1] = {};
      if (updates.type !== undefined) {
        setType(updates.type);
        durableUpdate.type = updates.type;
      }
      if (
        updates.year !== undefined ||
        updates.month !== undefined ||
        updates.untilYear !== undefined ||
        updates.untilMonth !== undefined ||
        updates.isPresent !== undefined
      ) {
        const currentPeriod = periodRef.current;
        const nextIsPresent = updates.isPresent ?? currentPeriod.isPresent;
        const nextPeriod = {
          year: updates.year ?? currentPeriod.year,
          month: updates.month ?? currentPeriod.month,
          untilYear: nextIsPresent ? null : (updates.untilYear ?? currentPeriod.untilYear),
          untilMonth: nextIsPresent ? null : (updates.untilMonth ?? currentPeriod.untilMonth),
          isPresent: nextIsPresent,
        };
        periodRef.current = nextPeriod;
        setPeriod(nextPeriod);
        Object.assign(durableUpdate, nextPeriod);
      }
      if (updates.metadata !== undefined) {
        setMetadata(updates.metadata);
        durableUpdate.metadata = updates.metadata;
      }
      if (updates.featured !== undefined) {
        setFeatured(updates.featured);
        durableUpdate.featured = updates.featured;
      }
      debouncedWorkFieldsUpdate(durableUpdate);
    },
    [canEditNeutral, debouncedWorkFieldsUpdate, setFeatured, setMetadata, setPeriod, setType],
  );

  const handleSummaryChange = useCallback(
    (value: string) => {
      if (!roomLocale || !currentLocaleCanEdit || !currentIsSynced) {
        return;
      }
      setSummary(value);
      setResidentSummary(value);
      debouncedResidentMetadataUpdate({ locale: roomLocale, summary: value || null });
    },
    [currentIsSynced, currentLocaleCanEdit, debouncedResidentMetadataUpdate, roomLocale, setSummary],
  );

  const handleMapPlaceChange = useCallback(
    (nextMapPlaceId: string | null) => {
      if (!canEditNeutral) {
        return;
      }
      setMapPlaceId(nextMapPlaceId);
      updateWork.mutate({ mapPlaceId: nextMapPlaceId });
    },
    [canEditNeutral, updateWork],
  );

  const handleCreatePlaceStart = useCallback(
    (searchTerm: string) => {
      if (!canEditNeutral) {
        return;
      }
      setCreatePlaceInitialName(searchTerm);
      setCreatePlaceOpened(true);
    },
    [canEditNeutral],
  );

  const handleCreatePlaceSubmit = useCallback(
    (data: CreatePlaceFormState) => {
      if (canEditNeutral) {
        createPlace.mutate(data);
      }
    },
    [canEditNeutral, createPlace],
  );

  const displayedTitle = roomLocale ? residentTitle : activeEditLocale.displayTitle;
  const displayedSummary = roomLocale ? residentSummary : activeEditLocale.displaySummary;
  return (
    <EditorRuntimeProvider provider={currentProvider} entityType="work" entityId={workId} blockRoomProtocol={protocol}>
      <Stack h="100%" gap="md">
        <EditorHeader
          title={displayedTitle}
          onTitleChange={currentLocaleCanEdit && currentIsSynced ? handleScopedLocaleTitleChange : undefined}
          titleInputId={`work-${workId}-title`}
          titlePlaceholder={tCommon('states.untitledEntity', { entity: tCommon('entities.work') })}
          titleDisabled={!roomLocale || !currentLocaleCanEdit || !currentIsSynced}
          status={status}
          statusOptions={lifecycle.controls.statusOptions}
          isConnected={currentIsConnected}
          isSynced={currentIsSynced}
          onBack={handleBack}
          onStatusChange={canEditNeutral ? lifecycle.changeStatus : undefined}
          onDelete={canEditNeutral && lifecycle.controls.canDelete ? () => lifecycle.deleteWork.mutate() : undefined}
          deleteConfirmation={
            canEditNeutral && lifecycle.controls.canDelete
              ? {
                  title: tCommon('actions.delete'),
                  message: (
                    <Text>
                      {tCommon.rich('messages.confirmDeleteNamedRich', {
                        name: displayedTitle || tCommon('states.untitled'),
                        strong: (chunks) => <strong>{chunks}</strong>,
                      })}
                    </Text>
                  ),
                }
              : undefined
          }
          isStatusChanging={lifecycle.isChanging}
          isDeleting={lifecycle.deleteWork.isPending}
          backTooltip={tCommon('actions.back')}
          groupStatusWithCollab
          collabActions={[
            {
              label: tCommonLabels('versionHistory'),
              onClick: () => setVersionHistoryOpened(true),
              icon: <IconHistory size={16} />,
            },
          ]}
          controls={<EditorActiveLocaleControl state={activeEditLocale} />}
        />

        {/* OG Image & Featured Image */}
        <MediaPreviewGrid>
          <OgImagePreview
            src={ogImage.src}
            canRegenerate={canEditWork && activeEditLocale.hasLiveRow && Boolean(activeEditLocale.activeLocale)}
            isRegenerating={regenerateOgImage.isPending || ogImage.isRegenerating}
            generationStatus={ogImage.status}
            generationError={ogImage.error}
            onRegenerate={() => {
              if (activeEditLocale.activeLocale) {
                regenerateOgImage.mutate({
                  locale: activeEditLocale.activeLocale,
                  targetKey: ogImage.targetKey,
                });
              }
            }}
          />
          <WorkFeaturedImageUploader
            workId={workId}
            idPrefix={`work-${workId}-featured-image`}
            canEdit={canEditNeutral}
            onOgGenerationRequested={() => void ogImage.trackLatest()}
          />
        </MediaPreviewGrid>

        {/* URL Section */}
        <UrlSection
          baseUrl={baseUrl}
          entityType="work"
          entityId={workId}
          slug={toSlugInputValue(slug)}
          idPrefix={`work-${workId}`}
          error={slugMgmt.error}
          saving={slugMgmt.isChecking || updateSlug.isPending}
          onChange={slugMgmt.handleChange}
          onBlur={slugMgmt.handleBlur}
          disabled={!canEditNeutral}
        />

        {/* Share Links */}
        <ShareLinkSection
          entityType="work"
          entityId={workId}
          description={t('shareLinksDescription')}
          disabled={!canEditNeutral}
        />

        <EntityTranslationsPanel
          entityType="work"
          entityId={workId}
          canManage={canEditWork}
          canAdministerTranslations={isAdmin && canEditWork}
          canMutateTargets={canEditWork}
        />

        <Stack gap={4}>
          <LocationSelector
            value={mapPlaceId}
            idPrefix={`work-${workId}-location`}
            canEdit={canEditNeutral}
            onChange={handleMapPlaceChange}
            onCreateNew={handleCreatePlaceStart}
          />
        </Stack>

        {/* Meta Form */}
        <WorkMetaForm
          workId={workId}
          type={type}
          year={year}
          month={month}
          untilYear={untilYear}
          untilMonth={untilMonth}
          isPresent={isPresent}
          metadata={metadata}
          featured={featured}
          disabled={!canEditNeutral}
          onChange={handleMetaChange}
        />

        <SummaryFieldCard
          entityType="work"
          entityId={workId}
          title={displayedTitle}
          summary={displayedSummary}
          summaryReadOnly={!canEditTranslationSource || !roomLocale || !currentLocaleCanEdit || !currentIsSynced}
          hideAiActions={!currentLocaleCanEdit || !currentIsSynced || !roomLocale}
          aiTarget={
            currentLocaleCanEdit && currentIsSynced && roomLocale
              ? { type: 'work', id: workId, locale: roomLocale }
              : undefined
          }
          provider={currentLocaleCanEdit ? currentProvider : null}
          doc={currentLocaleCanEdit ? currentDoc : null}
          currentMemberId={currentMemberId}
          currentMemberDisplayName={userName}
          onSummaryChange={currentLocaleCanEdit ? handleSummaryChange : undefined}
        />

        <MetadataPanel
          title={displayedTitle}
          summary={displayedSummary}
          routePath={`/works/${slug || workId}`}
          canonicalOrigin={canonicalOrigin}
          siteName={siteName}
          defaultImageUrl={featuredImageUrl}
          defaultSchemaType="CreativeWork"
        />

        {/* Credits */}
        <WorkCreditsSection workId={workId} canEdit={canEditNeutral} />

        {/* Clients */}
        <WorkClientsSection workId={workId} canEdit={canEditNeutral} initialClientDetails={initialClientDetails} />

        {/* Content Editor */}
        <SectionCard withBorder p="md" flex={1} style={{ minHeight: 300, display: 'flex', flexDirection: 'column' }}>
          <Text size="sm" fw={500} mb="xs">
            {tCommon('labels.body')}
          </Text>
          <Box flex={1} pos="relative">
            {currentProvider && blockRoomController && currentIsSynced ? (
              <Box id={getEditorBodyReadyId('work', workId)} h="100%">
                <LocalizedRichTextFragmentEditor
                  key={`work-${workId}-${roomLocale ?? 'source'}`}
                  provider={currentProvider}
                  blockRoomController={blockRoomController}
                  userName={userName}
                  editable={currentLocaleCanEdit}
                  entityId={workId}
                  entityType={TranscodeEntityType.WORK}
                  allowNeutralBlockEdits={activeEditLocale.isSourceLocale}
                  allowStructuralEdits={activeEditLocale.isSourceLocale}
                  aiTarget={
                    currentLocaleCanEdit && activeEditLocale.activeLocale
                      ? { type: 'work', id: workId, locale: activeEditLocale.activeLocale }
                      : undefined
                  }
                />
              </Box>
            ) : (
              <Box id={getEditorBodyLoadingId('work', workId)}>
                <PageLoader size="sm" minHeight={300} />
              </Box>
            )}
          </Box>
        </SectionCard>

        {/* Version History */}
        <VersionHistoryDrawer
          entityType="work"
          entityId={workId}
          opened={versionHistoryOpened}
          onClose={() => setVersionHistoryOpened(false)}
          currentSourceLocale={activeEditLocale.sourceLocale}
          canRestore={canEditNeutral}
          onRestored={async () => {
            reloadCanonical();
            await ogImage.trackLatest();
          }}
        />

        <CreatePlaceModal
          opened={createPlaceOpened}
          onClose={() => setCreatePlaceOpened(false)}
          onSubmit={handleCreatePlaceSubmit}
          isPending={createPlace.isPending}
          initialName={createPlaceInitialName}
        />
      </Stack>
    </EditorRuntimeProvider>
  );
}
