'use client';

import { useEditorAccessLevel } from '@/features/editor/useEditorAccessLevel';

import { AuthoringExtension } from '@/features/authoring/AuthoringExtensionsContext';

import { DocumentEditorPanels } from '@/features/authoring/DocumentEditorPanels';
import { EditorSettingsSection } from '@/features/authoring/EditorSettingsSection';

import { Text as DsText } from '@/components/core/Typography';
import { LayoutStack as DsLayoutStack, LayoutInset as DsLayoutInset } from '@/components/core/Layout';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { TranscodeEntityType } from '@echovisionlab/geul-proto/secure/events_pb.ts';
import { IconHistory } from '@tabler/icons-react';
import { useMutation } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';

import { notifications } from '@/components/core/Notification';
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
import { updateBlockRoomLocaleMetadata } from '@/lib/collab/block-room-metadata';
import { useSlugManagement } from '@/lib/hooks/useSlugManagement';
import { toNullableSlug, toSlugInputValue } from '@/lib/utils/slug';
import { publishEditorEntityChange, useEditorEntityChanges } from '@/lib/editor/editor-entity-changes';
import { getPendingEditorPatch } from '@/lib/editor/editor-save-registry';
import { flushEditorSavesOrNotify } from '@/lib/editor/flush-editor-saves-or-notify';
import { useBlockRoomMetadataUpdates } from '@/lib/editor/useBlockRoomMetadataUpdates';
import { WorkClientsSection } from './WorkClientsSection';
import type { WorkClientDetails } from './useWorkClientDetails';
import { WorkCreditsSection } from './WorkCreditsSection';
import { WorkFeaturedImageUploader } from './WorkFeaturedImageUploader';
import { WorkMetaForm } from './WorkMetaForm';
import { useWorkLifecycle } from './useWorkLifecycle';
import { requireActionSuccess } from '@/lib/editor/require-action-success';
import { useDebouncedRoomMetadata } from '@/lib/editor/useDebouncedRoomMetadata';
import { useDebouncedPatch } from '@/lib/editor/useDebouncedPatch';
import { useAuthoritativeConfiguration } from '@/lib/editor/useAuthoritativeConfiguration';

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
  initialClientDetails?: WorkClientDetails[]; // Client details for display
  userName: string;
  isAdmin: boolean;
  canEdit: boolean;
  baseUrl: string;
  canonicalOrigin: string;
  siteName: string;
  onBack?: () => void;
}

type WorkFieldsUpdate = Parameters<typeof updateWorkFieldsAction>[1];
const EMPTY_WORK_METADATA: Record<string, unknown> = {};
const EMPTY_WORK_CLIENTS: string[] = [];

function mergeWorkFieldsUpdate(pending: WorkFieldsUpdate, next: WorkFieldsUpdate): WorkFieldsUpdate {
  const merged = { ...pending, ...next };
  if (pending.observedMetadata !== undefined) {
    merged.observedMetadata = pending.observedMetadata;
  }
  if (pending.observedClients !== undefined) {
    merged.observedClients = pending.observedClients;
  }
  return merged;
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
    metadata: props.initialMetadata ?? EMPTY_WORK_METADATA,
    featured: props.initialFeatured,
    creditsVersion: 0,
    creditOrder: [],
    clients: props.initialClients ?? EMPTY_WORK_CLIENTS,
  };

  return (
    <WorkMetaProvider
      key={props.workId}
      workId={props.workId}
      initialMeta={initialMeta}
      initialFeaturedImageUrl={props.initialFeaturedImageUrl}
      initialMapPlaceId={props.initialMapPlaceId}
      canEdit={props.canEdit}
    >
      <MapPlaceActionProvider createMapPlaceForBlock={createMapPlaceForBlockWithBrowserClient}>
        <WorkEditorContent {...props} />
      </MapPlaceActionProvider>
    </WorkMetaProvider>
  );
}

function useWorkEditorViewModel({
  workId,
  currentMemberId,
  initialTitle,
  initialSummary: _initialSummary,
  initialMetadata,
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
  const navigateBack = useCallback(() => {
    if (onBack) {
      onBack();
    } else {
      router.back();
    }
  }, [onBack, router]);
  const flushPendingSaves = useCallback(
    () => flushEditorSavesOrNotify(`work:${workId}`, tCommon('notifications.saveFailed')),
    [tCommon, workId],
  );
  const handleBack = useCallback(async () => {
    if (await flushPendingSaves()) {
      navigateBack();
    }
  }, [flushPendingSaves, navigateBack]);
  const lifecycle = useWorkLifecycle({ workId, initialStatus, canEdit, isAdmin, onDeleted: navigateBack });
  const { status } = lifecycle;
  const mapConfiguration = useAuthoritativeConfiguration({
    document: `work:${workId}`,
    initialConfiguration: { mapPlaceId: initialMapPlaceId },
  });

  const [createPlaceOpened, setCreatePlaceOpened] = useState(false);
  const [createPlaceInitialName, setCreatePlaceInitialName] = useState('');
  const [versionHistoryOpened, setVersionHistoryOpened] = useState(false);

  const {
    configuration,
    refreshConfiguration,
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
  const mapPlaceId = configuration
    ? configuration.getConfiguration().mapPlaceId
    : mapConfiguration.getConfiguration().mapPlaceId;
  const setMapPlaceId = (mapPlaceId: string | null) => (configuration ?? mapConfiguration).edit({ mapPlaceId });
  const currentProvider = provider;
  const accessLevel = useEditorAccessLevel(provider);
  const canEditWork = lifecycle.canEdit && accessLevel === 'edit';
  useEditorEntityChanges(
    `work:${workId}`,
    () => {
      void refreshConfiguration?.();
      router.refresh();
    },
    currentProvider,
    undefined,
    configuration?.captureOwnChange,
  );
  const handleStatusChange = useCallback(
    async (nextStatus: Parameters<typeof lifecycle.changeStatus>[0]) => {
      if (await flushPendingSaves()) {
        lifecycle.changeStatus(nextStatus);
      }
    },
    [flushPendingSaves, lifecycle.changeStatus],
  );
  const handleDelete = useCallback(async () => {
    if (await flushPendingSaves()) {
      lifecycle.deleteWork.mutate();
    }
  }, [flushPendingSaves, lifecycle.deleteWork.mutate]);
  const observedMetadataRef = useRef(metadata);
  useEffect(() => {
    if (!configuration && !Object.hasOwn(getPendingEditorPatch(`work:${workId}`), 'metadata')) {
      observedMetadataRef.current = structuredClone(initialMetadata);
    }
  }, [configuration, initialMetadata, workId]);
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
        notifications.show({ message: result.error, tone: 'danger' });
        return;
      }
      notifications.show({ message: tCommon('notifications.ogGenerationRequested'), tone: 'neutral' });
      ogImage.trackRequestedGeneration(result.generationId, request.targetKey);
    },
  });

  const updateSlug = useMutation({
    mutationFn: async (slug: string | null) => {
      const write = configuration?.beginWrite({ slug });
      try {
        const result = await updateWorkSlugAction(workId, slug, write?.origin);
        if (result.error) {
          write?.fail();
        } else {
          write?.acknowledge({ slug: result.slug ?? slug }, { authoritative: false });
          void refreshConfiguration?.();
        }
        return result;
      } catch (error) {
        write?.fail();
        throw error;
      }
    },
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({ message: result.error, tone: 'danger' });
      }
    },
  });

  const updateWork = useMutation({
    mutationFn: async (data: { mapPlaceId?: string | null }) => {
      const write = (configuration ?? mapConfiguration).beginWrite(data);
      try {
        const result = await updateWorkAction(workId, data, write.origin);
        if (result.error) {
          write.fail();
        } else {
          write.acknowledge(data, { authoritative: false });
          void refreshConfiguration?.();
          publishEditorEntityChange(`work:${workId}`, write?.origin);
        }
        return result;
      } catch (error) {
        write.fail();
        throw error;
      }
    },
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({ message: result.error, tone: 'danger' });
      }
    },
    onError: (error) => {
      notifications.show({
        message: error instanceof Error ? error.message : t('notifications.updateFailed'),
        tone: 'danger',
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
          tone: 'danger',
        });
        return;
      }

      const nextMapPlaceId = result.data.id;
      setMapPlaceId(nextMapPlaceId);
      updateWork.mutate({ mapPlaceId: nextMapPlaceId });
      setCreatePlaceOpened(false);
      notifications.show({
        message: tCommon('notifications.placeCreatedAndLinked'),
        tone: 'positive',
      });
    },
    onError: (error) => {
      notifications.show({
        message: error instanceof Error ? error.message : tCommon('notifications.createPlaceFailed'),
        tone: 'danger',
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
    const pending = getPendingEditorPatch(`work:${workId}`);
    if (!Object.hasOwn(pending, 'sourceTitle')) {
      setResidentTitle(activeEditLocale.displayTitle);
    }
    if (!Object.hasOwn(pending, 'summary')) {
      setResidentSummary(activeEditLocale.displaySummary);
    }
  }, [activeEditLocale.displaySummary, activeEditLocale.displayTitle, roomLocale, workId]);

  const debouncedResidentMetadataUpdate = useDebouncedRoomMetadata({
    connection: { protocol, bootstrap, acceptEpochAck, reloadCanonical },
    document: `work:${workId}`,
    delay: 500,
    write: (protocol, update: { locale: string; sourceTitle?: string; summary?: string | null }) =>
      updateBlockRoomLocaleMetadata(protocol, { type: 'work', ...update }),
  });
  useBlockRoomMetadataUpdates({ protocol }, `work:${workId}`, ({ operation, values }) => {
    if (operation !== 'locale') {
      return;
    }
    if (typeof values.sourceTitle === 'string') {
      setResidentTitle(values.sourceTitle);
      if (activeEditLocale.isSourceLocale) {
        setTitle(values.sourceTitle);
      }
    }
    if (values.summary === null || typeof values.summary === 'string') {
      const nextSummary = values.summary ?? '';
      setResidentSummary(nextSummary);
      if (activeEditLocale.isSourceLocale) {
        setSummary(nextSummary);
      }
    }
  });
  const debouncedWorkFieldsUpdate = useDebouncedPatch({
    write: async (update: WorkFieldsUpdate) => {
      const { observedMetadata: _observedMetadata, observedClients: _observedClients, ...patch } = update;
      void _observedMetadata;
      void _observedClients;
      const write = configuration?.beginWrite(patch as Partial<WorkMeta>);
      let result;
      try {
        result = await updateWorkFieldsAction(workId, update, write?.origin);
        await requireActionSuccess(Promise.resolve(result));
        write?.acknowledge(
          { ...patch, ...(result.metadata ? { metadata: result.metadata } : {}) } as Partial<WorkMeta>,
          { authoritative: Object.keys(patch).every((field) => field === 'metadata') && result.metadata !== undefined },
        );
      } catch (error) {
        write?.fail();
        notifications.show({
          message: error instanceof Error ? error.message : t('notifications.updateFailed'),
          tone: 'danger',
        });
        throw error;
      }
      if (update.metadata !== undefined) {
        observedMetadataRef.current = structuredClone(result.metadata ?? update.metadata);
      }
      publishEditorEntityChange(`work:${workId}`, write?.origin);
      void refreshConfiguration?.();
    },
    delay: 500,
    scope: workId,
    document: `work:${workId}`,
    merge: mergeWorkFieldsUpdate,
    recoveryKey: 'work-fields',
    retry: true,
  });
  const handleScopedLocaleTitleChange = useCallback(
    (value: string) => {
      if (!roomLocale || !currentLocaleCanEdit) {
        return;
      }
      setResidentTitle(value);
      if (canEditNeutral) {
        slugMgmt.updateFromTitle(value);
      }
      debouncedResidentMetadataUpdate({ locale: roomLocale, sourceTitle: value });
      if (activeEditLocale.isSourceLocale) {
        setTitle(value);
      }
    },
    [
      canEditNeutral,
      slugMgmt.updateFromTitle,
      activeEditLocale.isSourceLocale,
      currentLocaleCanEdit,
      debouncedResidentMetadataUpdate,
      roomLocale,
      setTitle,
    ],
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
        durableUpdate.observedMetadata = structuredClone(
          configuration?.getCanonical().metadata ?? observedMetadataRef.current,
        );
      }
      if (updates.featured !== undefined) {
        setFeatured(updates.featured);
        durableUpdate.featured = updates.featured;
      }
      debouncedWorkFieldsUpdate(durableUpdate);
    },
    [canEditNeutral, configuration, debouncedWorkFieldsUpdate, setFeatured, setMetadata, setPeriod, setType],
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
  return {
    currentProvider,
    workId,
    protocol,
    displayedTitle,
    currentLocaleCanEdit,
    currentIsSynced,
    handleScopedLocaleTitleChange,
    tCommon,
    roomLocale,
    status,
    lifecycle: {
      isChanging: lifecycle.isChanging,
      controls: { statusOptions: lifecycle.controls.statusOptions, canDelete: lifecycle.controls.canDelete },
      deleteWork: { isPending: lifecycle.deleteWork.isPending },
    },
    currentIsConnected,
    handleBack,
    canEditNeutral,
    handleStatusChange,
    handleDelete,
    tCommonLabels,
    setVersionHistoryOpened,
    activeEditLocale,
    ogImage: {
      src: ogImage.src,
      isRegenerating: ogImage.isRegenerating,
      status: ogImage.status,
      error: ogImage.error,
      targetKey: ogImage.targetKey,
      trackLatest: ogImage.trackLatest,
    },
    canEditWork,
    regenerateOgImage: { isPending: regenerateOgImage.isPending, mutate: regenerateOgImage.mutate },
    baseUrl,
    slug,
    slugMgmt: {
      isAvailable: slugMgmt.isAvailable,
      error: slugMgmt.error,
      isChecking: slugMgmt.isChecking,
      handleChange: slugMgmt.handleChange,
      handleBlur: slugMgmt.handleBlur,
    },
    updateSlug: { isPending: updateSlug.isPending },
    t,
    isAdmin,
    mapPlaceId,
    handleMapPlaceChange,
    handleCreatePlaceStart,
    type,
    year,
    month,
    untilYear,
    untilMonth,
    isPresent,
    metadata,
    featured,
    handleMetaChange,
    displayedSummary,
    canEditTranslationSource,
    currentDoc,
    currentMemberId,
    userName,
    handleSummaryChange,
    canonicalOrigin,
    siteName,
    featuredImageUrl,
    initialClientDetails,
    blockRoomController,
    versionHistoryOpened,
    reloadCanonical,
    createPlaceOpened,
    setCreatePlaceOpened,
    handleCreatePlaceSubmit,
    createPlace: { isPending: createPlace.isPending },
    createPlaceInitialName,
  };
}

function WorkEditorContent(props: WorkEditorProps) {
  return <WorkEditorView model={useWorkEditorViewModel(props)} />;
}

export type WorkEditorViewModel = ReturnType<typeof useWorkEditorViewModel>;

/** Complete production editor composition; controllers supply data and commands. */
export function WorkEditorView({ model }: { model: WorkEditorViewModel }) {
  const {
    currentProvider,
    workId,
    protocol,
    displayedTitle,
    currentLocaleCanEdit,
    currentIsSynced,
    handleScopedLocaleTitleChange,
    tCommon,
    roomLocale,
    status,
    lifecycle,
    currentIsConnected,
    handleBack,
    canEditNeutral,
    handleStatusChange,
    handleDelete,
    tCommonLabels,
    setVersionHistoryOpened,
    activeEditLocale,
    ogImage,
    canEditWork,
    regenerateOgImage,
    baseUrl,
    slug,
    slugMgmt,
    updateSlug,
    t,
    isAdmin,
    mapPlaceId,
    handleMapPlaceChange,
    handleCreatePlaceStart,
    type,
    year,
    month,
    untilYear,
    untilMonth,
    isPresent,
    metadata,
    featured,
    handleMetaChange,
    displayedSummary,
    canEditTranslationSource,
    currentDoc,
    currentMemberId,
    userName,
    handleSummaryChange,
    canonicalOrigin,
    siteName,
    featuredImageUrl,
    initialClientDetails,
    blockRoomController,
    versionHistoryOpened,
    reloadCanonical,
    createPlaceOpened,
    setCreatePlaceOpened,
    handleCreatePlaceSubmit,
    createPlace,
    createPlaceInitialName,
  } = model;
  return (
    <EditorRuntimeProvider provider={currentProvider} entityType="work" entityId={workId} blockRoomProtocol={protocol}>
      <DsLayoutStack fill="block" gap={{ base: 'xs', sm: 'md' }}>
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
          onStatusChange={canEditNeutral ? handleStatusChange : undefined}
          onDelete={canEditNeutral && lifecycle.controls.canDelete ? handleDelete : undefined}
          deleteConfirmation={
            canEditNeutral && lifecycle.controls.canDelete
              ? {
                  title: tCommon('actions.delete'),
                  message: (
                    <DsText>
                      {tCommon.rich('messages.confirmDeleteNamedRich', {
                        name: displayedTitle || tCommon('states.untitled'),
                        strong: (chunks) => <strong>{chunks}</strong>,
                      })}
                    </DsText>
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
              icon: <IconHistory />,
            },
          ]}
          controls={<EditorActiveLocaleControl state={activeEditLocale} />}
        />

        <DocumentEditorPanels
          settings={
            <>
              {/* URL Section */}
              <UrlSection
                baseUrl={baseUrl}
                entityType="work"
                entityId={workId}
                slug={toSlugInputValue(slug)}
                isAvailable={slugMgmt.isAvailable}
                idPrefix={`work-${workId}`}
                error={slugMgmt.error}
                saving={slugMgmt.isChecking || updateSlug.isPending}
                onChange={slugMgmt.handleChange}
                onBlur={slugMgmt.handleBlur}
                disabled={!canEditNeutral}
              />

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

              <EditorSettingsSection title={tCommonLabels('classification')}>
                <LocationSelector
                  value={mapPlaceId}
                  idPrefix={`work-${workId}-location`}
                  canEdit={canEditNeutral}
                  onChange={handleMapPlaceChange}
                  onCreateNew={handleCreatePlaceStart}
                />
              </EditorSettingsSection>

              {/* Credits */}
              <AuthoringExtension kind="relations">
                <WorkCreditsSection workId={workId} canEdit={canEditNeutral} />
              </AuthoringExtension>

              {/* Clients */}
              <AuthoringExtension kind="relations">
                <WorkClientsSection
                  workId={workId}
                  canEdit={canEditNeutral}
                  initialClientDetails={initialClientDetails}
                />
              </AuthoringExtension>
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

              {/* OG Image & Featured Image */}
              <EditorSettingsSection title={tCommonLabels('images')}>
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
                  <AuthoringExtension kind="uploads">
                    <WorkFeaturedImageUploader
                      workId={workId}
                      idPrefix={`work-${workId}-featured-image`}
                      canEdit={canEditNeutral}
                      onOgGenerationRequested={() => void ogImage.trackLatest()}
                    />
                  </AuthoringExtension>
                </MediaPreviewGrid>
              </EditorSettingsSection>

              <MetadataPanel
                title={displayedTitle}
                summary={displayedSummary}
                routePath={`/works/${slug || workId}`}
                canonicalOrigin={canonicalOrigin}
                siteName={siteName}
                defaultImageUrl={featuredImageUrl}
                defaultSchemaType="CreativeWork"
              />

              {/* Share Links */}
              <AuthoringExtension kind="sharing">
                <ShareLinkSection
                  entityType="work"
                  entityId={workId}
                  description={t('shareLinksDescription')}
                  disabled={!canEditNeutral}
                />
              </AuthoringExtension>

              <AuthoringExtension kind="translations">
                <EntityTranslationsPanel
                  entityType="work"
                  entityId={workId}
                  canManage
                  canAdministerTranslations={isAdmin && canEditWork}
                  canMutateTargets={canEditWork}
                />
              </AuthoringExtension>
            </>
          }
        >
          {/* Content Editor */}
          <div style={{ ...{ minHeight: 300, display: 'flex', flexDirection: 'column' }, flex: 1 }}>
            <SectionCard layout="stack" grow padding={{ base: 'none', sm: 'md' }}>
              <div style={{ position: 'relative' }}>
                <DsLayoutInset flexible space="none">
                  {currentProvider && blockRoomController ? (
                    <div style={{ height: '100%' }} id={getEditorBodyReadyId('work', workId)}>
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
                    </div>
                  ) : (
                    <div id={getEditorBodyLoadingId('work', workId)}>
                      <PageLoader size="sm" minHeight={300} />
                    </div>
                  )}
                </DsLayoutInset>
              </div>
            </SectionCard>
          </div>
        </DocumentEditorPanels>

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
      </DsLayoutStack>
    </EditorRuntimeProvider>
  );
}
