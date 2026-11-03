'use client';
import { PageLoader } from '@/features/site/PageLoader';

import { ReleaseEditorAccessProvider } from './ReleaseEditorAccessContext';
import { useEditorAccessLevel } from '@/features/editor/useEditorAccessLevel';

import { AuthoringExtension } from '@/features/authoring/AuthoringExtensionsContext';
import { Text as DsText } from '@/components/core/Typography';

import {
  LayoutStack as DsLayoutStack,
  LayoutInline as DsLayoutInline,
  LayoutGrid as DsLayoutGrid,
} from '@/components/core/Layout';

import { unwrapQueryResult } from '@/lib/api/query-result';
import { QueryErrorAlert } from '@/features/application-error/QueryErrorAlert';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';

import { DateInput, type DateValue, Select, TextInput } from '@/components/core/Input';
import { notifications } from '@/components/core/Notification';
import { EditorHeader, type StatusOption } from '@/features/editor/EditorHeader';

import { SectionCard } from '@/components/core/Section';
import { ShareLinkSection } from '@/features/share/ShareLinkSection';
import { DocumentEditorPanels } from '@/features/authoring/DocumentEditorPanels';
import { EditorSettingsSection } from '@/features/authoring/EditorSettingsSection';
import { UrlSection } from '@/features/metadata/UrlSection';
import { ActiveEditLocaleContentPreview } from '@/features/translation/ActiveEditLocaleContentPreview';
import { EditorActiveLocaleControl } from '@/features/translation/EditorActiveLocaleControl';
import { EntityTranslationsPanel } from '@/features/translation/EntityTranslationsPanel';
import { isLocaleDocumentEditable } from '@/features/translation/locale-document-mode';
import { useLocaleDocumentSession } from '@/features/translation/useLocaleDocumentSession';
import {
  deleteReleaseAction,
  getReleaseEditorRelationsAction,
  getReleaseAdminAction,
  publishReleaseAction,
  unpublishReleaseAction,
  updateReleaseFieldsAction,
  updateReleaseSlugAction,
} from '@/lib/actions/release';
import { getReleaseTrackSnapshotAction } from '@/lib/actions/track';
import type { ReleaseFields, ReleaseTrackItem } from '@/lib/collab/schemas/release-fields.schema';
import { updateBlockRoomLocaleMetadata } from '@/lib/collab/block-room-metadata';
import { EditorRuntimeProvider } from '@/lib/contexts/EditorRuntimeContext';
import { useRichTextBlockRoomController } from '@/features/editor/hooks/useBlockRoomTiptapController';
import { useBlockRoomConnection } from '@/lib/collab/useBlockRoomConnection';
import { useSlugManagement } from '@/lib/hooks/useSlugManagement';
import type {
  ReleaseArtistItem,
  ReleaseCategoryItem,
  ReleaseCreditItem,
  ReleaseFormatItem,
  ReleaseGenreItem,
  ReleaseLabelItem,
  ReleaseStyleItem,
  ReleaseType,
} from '@/lib/types/release/model';
import { parseReleaseStatus, releaseTypeSchema, type ReleaseStatus } from '@/lib/types/release/schema';
import { toNullableSlug, toSlugInputValue } from '@/lib/utils/slug';
import { ReleaseArtistsSection } from './ReleaseArtistsSection';
import { ReleaseArtworkUploader } from './ReleaseArtworkUploader';
import { ReleaseCreditsSection } from './ReleaseCreditsSection';
import { ReleaseDescriptionEditor } from './ReleaseDescriptionEditor';
import { ReleaseLabelsSection } from './ReleaseLabelsSection';
import { ReleaseTagsSection } from './ReleaseTagsSection';
import { ReleaseTracksSection } from './ReleaseTracksSection';
import { requireActionSuccess } from '@/lib/editor/require-action-success';
import { useDebouncedRoomMetadata } from '@/lib/editor/useDebouncedRoomMetadata';
import { useAuthoritativeConfiguration, type ConfigurationWrite } from '@/lib/editor/useAuthoritativeConfiguration';
import { useDebouncedPatch } from '@/lib/editor/useDebouncedPatch';
import { getPendingEditorPatch } from '@/lib/editor/editor-save-registry';
import { flushEditorSavesOrNotify } from '@/lib/editor/flush-editor-saves-or-notify';
import { useBlockRoomMetadataUpdates } from '@/lib/editor/useBlockRoomMetadataUpdates';
import { useEditorEntityChanges } from '@/lib/editor/editor-entity-changes';
import { persistCollaborativeDocumentNow } from '@/lib/collab/persist-now';

interface ReleaseEditorProps {
  releaseId: string;
  initialTitle: string;
  initialSlug: string | null;
  initialType: ReleaseType;
  initialReleaseDate: Date | null;
  initialArtworkUrl: string | null;
  initialStatus: string | null;
  initialSpotifyUrl: string | null;
  initialAppleMusicUrl: string | null;
  initialBandcampUrl: string | null;
  initialYoutubeMusicUrl: string | null;
  initialArtists: ReleaseArtistItem[];
  initialCredits: ReleaseCreditItem[];
  initialLabels: ReleaseLabelItem[];
  initialCategories: ReleaseCategoryItem[];
  initialGenres: ReleaseGenreItem[];
  initialStyles: ReleaseStyleItem[];
  initialFormats: ReleaseFormatItem[];
  initialTracks: ReleaseTrackItem[];
  baseUrl: string;
}

type ReleaseEditorConfiguration = ReleaseFields & { slug: string | null; status: ReleaseStatus };

type ReleaseRelationField =
  'artists' | 'labels' | 'categories' | 'genres' | 'styles' | 'formats' | 'credits' | 'tracks';

function useReleaseEditorViewModel({
  releaseId,
  initialTitle,
  initialSlug,
  initialType,
  initialReleaseDate,
  initialArtworkUrl,
  initialStatus,
  initialSpotifyUrl,
  initialAppleMusicUrl,
  initialBandcampUrl,
  initialYoutubeMusicUrl,
  initialArtists,
  initialCredits,
  initialLabels,
  initialCategories,
  initialGenres,
  initialStyles,
  initialFormats,
  initialTracks,
  baseUrl,
}: ReleaseEditorProps) {
  const router = useRouter();
  const t = useTranslations('releaseEditor');
  const tCommon = useTranslations('common');
  const tStates = useTranslations('common.states');
  const tActions = useTranslations('common.actions');
  const tStatuses = useTranslations('common.statuses');
  const tReleaseTypes = useTranslations('releasePage.types');
  const [slug, setSlug] = useState<string | null>(initialSlug);
  const [status, setStatus] = useState<ReleaseStatus>(() => parseReleaseStatus(initialStatus));

  const releaseTypeOptions = [
    { value: 'album', label: tReleaseTypes('album') },
    { value: 'ep', label: tReleaseTypes('ep') },
    { value: 'single', label: tReleaseTypes('single') },
    { value: 'compilation', label: tReleaseTypes('compilation') },
  ];

  const [fields, setFields] = useState<ReleaseFields>({
    type: initialType,
    releaseDate: initialReleaseDate ? initialReleaseDate.toISOString().split('T')[0] : null,
    artworkUrl: initialArtworkUrl,
    spotifyUrl: initialSpotifyUrl || '',
    appleMusicUrl: initialAppleMusicUrl || '',
    bandcampUrl: initialBandcampUrl || '',
    youtubeMusicUrl: initialYoutubeMusicUrl || '',
    credits: initialCredits,
    labels: initialLabels,
    categories: initialCategories,
    genres: initialGenres,
    styles: initialStyles,
    formats: initialFormats,
    tracks: initialTracks,
    artists: initialArtists,
  });
  const configuration = useAuthoritativeConfiguration({
    document: `release:${releaseId}`,
    initialConfiguration: { ...fields, slug, status },
    onAdopt: (patch) => {
      setFields((current) => ({ ...current, ...patch }));
      if (Object.hasOwn(patch, 'slug')) {
        setSlug(patch.slug ?? null);
      }
      if (patch.status !== undefined) {
        setStatus(patch.status);
      }
    },
  });
  const relationWrites = useRef(new Map<ReleaseRelationField, ConfigurationWrite<ReleaseEditorConfiguration>>());
  const relationSubmittedValues = useRef(new Map<ReleaseRelationField, ReleaseFields[ReleaseRelationField]>());
  const relationMutationCount = useRef(new Map<string, number>());
  const relationMutationFailed = useRef(new Set<string>());
  const relationRefreshSequence = useRef(0);
  const [relationRefreshError, setRelationRefreshError] = useState<unknown>(null);
  const [relationRefreshPending, setRelationRefreshPending] = useState(false);
  const refreshReleaseRelations = useCallback(async () => {
    const sequence = ++relationRefreshSequence.current;
    const read = configuration.beginRead();
    setRelationRefreshPending(true);
    const results = await Promise.allSettled([
      getReleaseEditorRelationsAction(releaseId),
      getReleaseTrackSnapshotAction(releaseId).then(unwrapQueryResult),
      getReleaseAdminAction(releaseId),
    ]);
    if (sequence !== relationRefreshSequence.current) {
      return;
    }
    setRelationRefreshPending(false);
    const failure = results.find((result) => result.status === 'rejected');
    setRelationRefreshError(failure?.status === 'rejected' ? failure.reason : null);
    const relations = results[0].status === 'fulfilled' ? results[0].value : null;
    const tracks = results[1].status === 'fulfilled' ? results[1].value : null;
    const release = results[2].status === 'fulfilled' ? results[2].value : null;
    configuration.adoptRead(read, {
      ...(relations ?? {}),
      ...(tracks ? { tracks } : {}),
      ...(release
        ? {
            slug: release.slug,
            status: release.status,
            type: release.type,
            releaseDate: release.releaseDate?.toISOString().split('T')[0] ?? null,
            artworkUrl: release.artworkUrl,
            spotifyUrl: release.spotifyUrl ?? '',
            appleMusicUrl: release.appleMusicUrl ?? '',
            bandcampUrl: release.bandcampUrl ?? '',
            youtubeMusicUrl: release.youtubeMusicUrl ?? '',
          }
        : {}),
    });
  }, [configuration, releaseId]);
  const beginRelationSave = useCallback(
    (field: ReleaseRelationField) => {
      const count = relationMutationCount.current.get(field) ?? 0;
      if (count === 0) {
        relationMutationFailed.current.delete(field);
        relationWrites.current.set(field, configuration.beginWrite([field]));
      }
      relationMutationCount.current.set(field, count + 1);
      relationSubmittedValues.current.set(field, configuration.getConfiguration()[field]);
      return relationWrites.current.get(field)?.origin;
    },
    [configuration],
  );
  const settleRelationSave = useCallback(
    (field: ReleaseRelationField, succeeded: boolean) => {
      if (!succeeded) {
        relationMutationFailed.current.add(field);
      }
      const count = Math.max(0, (relationMutationCount.current.get(field) ?? 1) - 1);
      if (count > 0) {
        relationMutationCount.current.set(field, count);
        return;
      }
      relationMutationCount.current.delete(field);
      const write = relationWrites.current.get(field);
      relationWrites.current.delete(field);
      const submitted = relationSubmittedValues.current.get(field);
      relationSubmittedValues.current.delete(field);
      if (relationMutationFailed.current.has(field)) {
        write?.fail();
      } else {
        write?.acknowledge({ [field]: submitted }, { authoritative: false });
      }
      // Relation sections finish failed operations without a retry queue. Release
      // only the submitted intent; an edit waiting to start another write stays protected.
      if (configuration.getConfiguration()[field] === submitted) {
        configuration.discard([field]);
      }
      void refreshReleaseRelations();
    },
    [configuration, refreshReleaseRelations],
  );
  const localeSession = useLocaleDocumentSession({
    entityType: 'release',
    entityId: releaseId,
    sourceTitle: initialTitle,
    sourceSummary: '',
  });
  const { activeEditLocale, roomLocale } = localeSession;
  const { isEditingScopedLocale, shouldUseLocaleDocument } = localeSession.mode;
  const blockRoom = useBlockRoomConnection('release', releaseId, roomLocale);
  const { provider, doc, bootstrap, protocol, isConnected, isSynced } = blockRoom;
  const blockRoomController = useRichTextBlockRoomController('release', doc, roomLocale);
  const currentProvider = provider;
  const canEditTranslationSource = useEditorAccessLevel(provider) === 'edit';
  const currentIsConnected = isConnected;
  const currentIsSynced = isSynced;
  useEditorEntityChanges(
    `release:${releaseId}`,
    () => {
      void refreshReleaseRelations();
    },
    currentProvider,
    undefined,
    configuration.captureOwnChange,
  );
  const [creditNotes, setCreditNotes] = useState<Record<string, string>>({});
  const localeMetadataDocument = `release:${releaseId}`;
  useEffect(() => {
    if (!roomLocale) {
      setCreditNotes({});
      return;
    }
    if (Object.hasOwn(getPendingEditorPatch(localeMetadataDocument), 'creditNotes')) {
      return;
    }
    const projection =
      bootstrap?.localeMetadata ??
      (bootstrap?.sourceMetadata?.locale === roomLocale ? bootstrap.sourceMetadata : undefined);
    setCreditNotes(Object.fromEntries((projection?.creditNotes ?? []).map(({ creditId, note }) => [creditId, note])));
  }, [bootstrap?.localeMetadata, bootstrap?.sourceMetadata, localeMetadataDocument, roomLocale]);
  const descriptionEditorKey = `release-${roomLocale ?? 'source'}`;
  const [residentTitle, setResidentTitle] = useState(initialTitle);
  useEffect(() => {
    if (Object.hasOwn(getPendingEditorPatch(localeMetadataDocument), 'title')) {
      return;
    }
    setResidentTitle(activeEditLocale.displayTitle);
  }, [activeEditLocale.displayTitle, localeMetadataDocument, roomLocale]);
  useBlockRoomMetadataUpdates(blockRoom, localeMetadataDocument, ({ operation, values }) => {
    if (operation !== 'locale') {
      return;
    }
    if (typeof values.title === 'string') {
      setResidentTitle(values.title);
    }
    if (
      Array.isArray(values.creditNotes) &&
      values.creditNotes.every(
        (entry) =>
          entry != null &&
          typeof entry === 'object' &&
          'creditId' in entry &&
          typeof entry.creditId === 'string' &&
          'note' in entry &&
          typeof entry.note === 'string',
      )
    ) {
      setCreditNotes(Object.fromEntries(values.creditNotes.map(({ creditId, note }) => [creditId, note])));
    }
  });
  const displayedTitle = roomLocale ? residentTitle : activeEditLocale.displayTitle;
  const hasLocaleRoomMutationAuthority = localeSession.hasRoomMutationAuthority({
    sourceLocale: bootstrap?.sourceLocale ?? null,
    locale: bootstrap?.locale ?? null,
    localeExists: bootstrap?.localeExists ?? false,
    documentRevision: bootstrap?.documentRevision ?? null,
    targetRevision: bootstrap?.targetRevision,
  });
  const currentLocaleCanEdit =
    canEditTranslationSource && activeEditLocale.canEditActiveLocale && hasLocaleRoomMutationAuthority;
  const canEditNeutral = currentLocaleCanEdit && activeEditLocale.isSourceLocale;
  const canEditLocalizedTitle = isLocaleDocumentEditable({
    activeLocale: activeEditLocale.activeLocale,
    shouldUseLocaleDocument,
    canEditActiveLocale: currentLocaleCanEdit,
    isSynced: currentIsSynced,

    isReady: Boolean(doc),
  });
  const editorSession =
    currentProvider && blockRoomController ? { provider: currentProvider, controller: blockRoomController } : null;
  const localizedDescriptionSession = editorSession;

  const updateReleaseFields = useMutation({
    mutationFn: (request: { input: Parameters<typeof updateReleaseFieldsAction>[1]; origin: string }) =>
      updateReleaseFieldsAction(releaseId, request.input, request.origin),
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({ message: result.error, tone: 'danger' });
      }
    },
    onError: (error) => {
      notifications.show({
        message: error instanceof Error ? error.message : tCommon('notifications.saveFailed'),
        tone: 'danger',
      });
    },
  });
  const debouncedLocaleMetadataUpdate = useDebouncedRoomMetadata({
    connection: blockRoom,
    document: localeMetadataDocument,
    delay: 500,
    write: (
      protocol,
      input: {
        locale: string;
        title?: string;
        creditNotes?: readonly { creditId: string; note: string }[];
        observed?: { creditNotes?: readonly { creditId: string; note: string }[] };
      },
    ) => updateBlockRoomLocaleMetadata(protocol, { type: 'release', ...input }),
  });
  const debouncedReleaseFieldsUpdate = useDebouncedPatch({
    write: async (input: Parameters<typeof updateReleaseFieldsAction>[1]) => {
      const patch: Partial<ReleaseFields> = {};
      if (input.type !== undefined) {
        patch.type = releaseTypeSchema.parse(input.type);
      }
      if (input.releaseDate !== undefined) {
        patch.releaseDate = input.releaseDate?.toISOString().split('T')[0] ?? null;
      }
      for (const key of ['spotifyUrl', 'appleMusicUrl', 'bandcampUrl', 'youtubeMusicUrl'] as const) {
        if (input[key] !== undefined) {
          patch[key] = input[key] ?? '';
        }
      }
      const write = configuration.beginWrite(patch);
      try {
        await requireActionSuccess(updateReleaseFields.mutateAsync({ input, origin: write.origin }));
        write.acknowledge(patch, { authoritative: false });
        await refreshReleaseRelations();
      } catch (error) {
        write.fail();
        throw error;
      }
    },
    delay: 500,
    scope: releaseId,
    document: localeMetadataDocument,
  });
  const setField = useCallback(
    <K extends keyof ReleaseFields>(key: K, value: ReleaseFields[K]) => {
      if (!canEditNeutral) {
        return;
      }
      if (key === 'artworkUrl') {
        // The artwork adapter invokes this callback after its mutation commits.
        const write = configuration.beginWrite({ artworkUrl: value as string | null });
        write.acknowledge({ artworkUrl: value as string | null }, { authoritative: false });
        void refreshReleaseRelations();
        return;
      }
      configuration.setDraft<keyof ReleaseFields>(key, value);
      switch (key) {
        case 'type':
          debouncedReleaseFieldsUpdate({ type: value as string });
          return;
        case 'releaseDate':
          debouncedReleaseFieldsUpdate({ releaseDate: value ? new Date(value as string) : null });
          return;
        case 'spotifyUrl':
          debouncedReleaseFieldsUpdate({ spotifyUrl: String(value) || null });
          return;
        case 'appleMusicUrl':
          debouncedReleaseFieldsUpdate({ appleMusicUrl: String(value) || null });
          return;
        case 'bandcampUrl':
          debouncedReleaseFieldsUpdate({ bandcampUrl: String(value) || null });
          return;
        case 'youtubeMusicUrl':
          debouncedReleaseFieldsUpdate({ youtubeMusicUrl: String(value) || null });
      }
    },
    [canEditNeutral, configuration, debouncedReleaseFieldsUpdate, refreshReleaseRelations],
  );
  const publishRelease = useMutation({
    mutationFn: async () => {
      const write = configuration.beginWrite(['status']);
      try {
        const result = await publishReleaseAction(releaseId, write.origin);
        if (result.error) {
          write.fail();
        } else {
          write.acknowledge({ status: 'published' }, { authoritative: false });
          await refreshReleaseRelations();
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
        return;
      }
      notifications.show({
        message: tCommon('messages.itemPublished', { item: tCommon('entities.release') }),
        tone: 'positive',
      });
    },
  });

  const unpublishRelease = useMutation({
    mutationFn: async () => {
      const write = configuration.beginWrite(['status']);
      try {
        const result = await unpublishReleaseAction(releaseId, write.origin);
        if (result.error) {
          write.fail();
        } else {
          write.acknowledge({ status: 'draft' }, { authoritative: false });
          await refreshReleaseRelations();
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
        return;
      }
      notifications.show({
        message: tCommon('messages.itemUnpublished', { item: tCommon('entities.release') }),
        tone: 'positive',
      });
    },
  });

  const deleteRelease = useMutation({
    mutationFn: () => deleteReleaseAction(releaseId),
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({ message: result.error, tone: 'danger' });
        return;
      }
      notifications.show({
        message: tCommon('messages.itemDeleted', { item: tCommon('entities.release') }),
        tone: 'positive',
      });
      router.push('/admin/releases');
    },
  });
  const updateSlug = useMutation({
    mutationFn: async (nextSlug: string | null) => {
      const write = configuration.beginWrite({ slug: nextSlug });
      try {
        const result = await updateReleaseSlugAction(releaseId, nextSlug, write.origin);
        if (result.error) {
          write.fail();
        } else {
          write.acknowledge({ slug: result.slug ?? null }, { authoritative: false });
          await refreshReleaseRelations();
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
  });
  const [pendingTransition, setPendingTransition] = useState<'back' | 'status' | 'delete' | null>(null);
  const runReleaseTransition = useCallback(
    async (transition: () => void | Promise<void>, command: 'back' | 'status' | 'delete' = 'back') => {
      setPendingTransition(command);
      try {
        if (!(await flushEditorSavesOrNotify(`release:${releaseId}`, tCommon('notifications.saveFailed')))) {
          return false;
        }
        if (currentProvider) {
          await persistCollaborativeDocumentNow(currentProvider);
        }
        await transition();
        return true;
      } catch {
        notifications.show({ message: tCommon('notifications.saveFailed'), tone: 'danger' });
        return false;
      } finally {
        setPendingTransition(null);
      }
    },
    [currentProvider, releaseId, tCommon],
  );
  const handleStatusChange = (status: ReleaseStatus) => {
    if (!canEditNeutral) {
      return;
    }
    if (status === 'published') {
      publishRelease.mutate();
    } else {
      unpublishRelease.mutate();
    }
  };

  const releaseStatusOptions: StatusOption<ReleaseStatus>[] = [
    {
      value: 'draft',
      label: tStatuses('draft'),
      actionLabel: tActions('unpublish'),
      tone: 'neutral',
    },
    {
      value: 'published',
      label: tStatuses('published'),
      actionLabel: tActions('publish'),
      tone: 'positive',
    },
  ];
  const slugMgmt = useSlugManagement({
    entityType: 'release',
    entityId: releaseId,
    slug: toSlugInputValue(slug),
    onSlugChange: (value) => {
      if (canEditNeutral) {
        configuration.setDraft('slug', toNullableSlug(value));
      }
    },
    onSave: (nextSlug) => {
      if (canEditNeutral) {
        return updateSlug.mutateAsync(toNullableSlug(nextSlug));
      }
    },
  });

  // Convert string date to Date object for DateInput
  const releaseDateValue = fields.releaseDate || null;

  // Helper to convert DateInput value to ISO string
  const handleReleaseDateChange = (val: DateValue) => {
    if (!val) {
      setField('releaseDate', null);
      return;
    }
    setField('releaseDate', val);
  };
  const handleScopedLocaleTitleChange = useCallback(
    (value: string) => {
      if (!activeEditLocale.canEditActiveLocale) {
        return;
      }
      if (!roomLocale) {
        return;
      }
      setResidentTitle(value);
      if (canEditNeutral) {
        slugMgmt.updateFromTitle(value);
      }
      debouncedLocaleMetadataUpdate({ locale: roomLocale, title: value });
    },
    [
      canEditNeutral,
      slugMgmt.updateFromTitle,
      activeEditLocale.canEditActiveLocale,
      debouncedLocaleMetadataUpdate,
      roomLocale,
    ],
  );

  const handleCreditNoteChange = useCallback(
    (creditId: string, note: string) => {
      if (!currentLocaleCanEdit || !currentIsSynced || !roomLocale) {
        return;
      }
      const normalizedNote = note.trim();
      setCreditNotes((current) => {
        const next = { ...current };
        // An empty target note is an explicit locale value, not a missing
        // field. Keep the identity in the patch so restored storage can
        // distinguish it from source fallback.
        next[creditId] = normalizedNote;
        debouncedLocaleMetadataUpdate({
          locale: roomLocale,
          creditNotes: Object.entries(next).map(([id, value]) => ({ creditId: id, note: value })),
          observed: {
            creditNotes: Object.entries(current).map(([id, value]) => ({ creditId: id, note: value })),
          },
        });
        return next;
      });
    },
    [currentIsSynced, currentLocaleCanEdit, debouncedLocaleMetadataUpdate, roomLocale],
  );

  return {
    currentProvider,
    releaseId,
    protocol,
    relationRefreshError,
    relationRefreshPending,
    refreshReleaseRelations,
    displayedTitle,
    canEditLocalizedTitle,
    handleScopedLocaleTitleChange,
    tCommon,
    status,
    releaseStatusOptions,
    currentIsConnected,
    currentIsSynced,
    runReleaseTransition,
    router: { back: router.back },
    canEditNeutral,
    handleStatusChange,
    deleteRelease: {
      mutate: deleteRelease.mutate,
      isPending: deleteRelease.isPending || pendingTransition === 'delete',
    },
    tStates,
    tActions,
    t,
    publishRelease: { isPending: publishRelease.isPending || pendingTransition === 'status' },
    unpublishRelease: { isPending: unpublishRelease.isPending || pendingTransition === 'status' },
    activeEditLocale,
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
    fields: {
      artworkUrl: fields.artworkUrl,
      type: fields.type,
      spotifyUrl: fields.spotifyUrl,
      appleMusicUrl: fields.appleMusicUrl,
      bandcampUrl: fields.bandcampUrl,
      youtubeMusicUrl: fields.youtubeMusicUrl,
      artists: fields.artists,
      labels: fields.labels,
      categories: fields.categories,
      genres: fields.genres,
      styles: fields.styles,
      formats: fields.formats,
      credits: fields.credits,
      tracks: fields.tracks,
    },
    setField,
    releaseTypeOptions,
    releaseDateValue,
    handleReleaseDateChange,
    isEditingScopedLocale,
    shouldUseLocaleDocument,
    localizedDescriptionSession,
    descriptionEditorKey,
    currentLocaleCanEdit,
    editorSession,
    beginRelationSave,
    settleRelationSave,
    creditNotes,
    blockRoomController,
    handleCreditNoteChange,
    canEditTranslationSource,
  };
}

export function ReleaseEditor(props: ReleaseEditorProps) {
  return <ReleaseEditorView model={useReleaseEditorViewModel(props)} />;
}

export type ReleaseEditorViewModel = ReturnType<typeof useReleaseEditorViewModel>;

/** Complete production editor composition; controllers supply data and commands. */
export function ReleaseEditorView({ model }: { model: ReleaseEditorViewModel }) {
  const {
    currentProvider,
    releaseId,
    protocol,
    relationRefreshError,
    relationRefreshPending,
    refreshReleaseRelations,
    displayedTitle,
    canEditLocalizedTitle,
    handleScopedLocaleTitleChange,
    tCommon,
    status,
    releaseStatusOptions,
    currentIsConnected,
    currentIsSynced,
    runReleaseTransition,
    router,
    canEditNeutral,
    handleStatusChange,
    deleteRelease,
    tActions,
    t,
    publishRelease,
    unpublishRelease,
    activeEditLocale,
    baseUrl,
    slug,
    slugMgmt,
    updateSlug,
    fields,
    setField,
    releaseTypeOptions,
    releaseDateValue,
    handleReleaseDateChange,
    isEditingScopedLocale,
    shouldUseLocaleDocument,
    localizedDescriptionSession,
    descriptionEditorKey,
    currentLocaleCanEdit,
    editorSession,
    beginRelationSave,
    settleRelationSave,
    creditNotes,
    blockRoomController,
    handleCreditNoteChange,
    canEditTranslationSource,
  } = model;
  return (
    <ReleaseEditorAccessProvider value={canEditNeutral}>
      <EditorRuntimeProvider
        provider={currentProvider}
        entityType="release"
        entityId={releaseId}
        blockRoomProtocol={protocol}
      >
        <DsLayoutStack>
          <QueryErrorAlert
            queries={[
              ...(activeEditLocale.errorQuery ? [activeEditLocale.errorQuery] : []),
              {
                isError: relationRefreshError !== null,
                error: relationRefreshError,
                isFetching: relationRefreshPending,
                refetch: refreshReleaseRelations,
              },
            ]}
          />
          <EditorHeader
            title={displayedTitle}
            onTitleChange={canEditLocalizedTitle ? handleScopedLocaleTitleChange : undefined}
            titleInputId={`release-${releaseId}-header-title`}
            titlePlaceholder={tCommon('states.untitledEntity', { entity: tCommon('entities.release') })}
            titleDisabled={!canEditLocalizedTitle}
            status={status}
            statusOptions={releaseStatusOptions}
            isConnected={currentIsConnected}
            isSynced={currentIsSynced}
            onBack={() => runReleaseTransition(() => router.back())}
            onStatusChange={
              canEditNeutral
                ? (nextStatus) => runReleaseTransition(() => handleStatusChange(nextStatus), 'status')
                : undefined
            }
            onDelete={canEditNeutral ? () => runReleaseTransition(() => deleteRelease.mutate(), 'delete') : undefined}
            deleteConfirmation={{
              title: tActions('delete'),
              message: (
                <DsText>
                  {tCommon.rich('messages.confirmDeleteNamedRich', {
                    name: displayedTitle || t('titleFallback'),
                    strong: (chunks) => <strong>{chunks}</strong>,
                  })}
                </DsText>
              ),
            }}
            isStatusChanging={publishRelease.isPending || unpublishRelease.isPending}
            isDeleting={deleteRelease.isPending}
            groupStatusWithCollab
            controls={<EditorActiveLocaleControl state={activeEditLocale} />}
          />

          <DocumentEditorPanels
            settings={
              <>
                <UrlSection
                  baseUrl={baseUrl}
                  entityType="release"
                  entityId={releaseId}
                  slug={toSlugInputValue(slug)}
                  isAvailable={slugMgmt.isAvailable}
                  idPrefix={`release-${releaseId}`}
                  error={slugMgmt.error}
                  saving={slugMgmt.isChecking || updateSlug.isPending}
                  disabled={!canEditNeutral}
                  onChange={slugMgmt.handleChange}
                  onBlur={slugMgmt.handleBlur}
                />

                {activeEditLocale.isSourceLocale ? (
                  <AuthoringExtension kind="relations">
                    <ReleaseArtistsSection
                      releaseId={releaseId}
                      idPrefix={`release-${releaseId}-artists`}
                      artists={fields.artists}
                      onArtistsChange={(artists) => setField('artists', artists)}
                      onMutationStart={() => beginRelationSave('artists')}
                      onMutationSettled={(succeeded) => settleRelationSave('artists', succeeded)}
                    />
                  </AuthoringExtension>
                ) : null}

                {/* Labels */}
                {activeEditLocale.isSourceLocale ? (
                  <AuthoringExtension kind="relations">
                    <ReleaseLabelsSection
                      releaseId={releaseId}
                      idPrefix={`release-${releaseId}-labels`}
                      labels={fields.labels}
                      onLabelsChange={(labels) => setField('labels', labels)}
                      onMutationStart={() => beginRelationSave('labels')}
                      onMutationSettled={(succeeded) => settleRelationSave('labels', succeeded)}
                    />
                  </AuthoringExtension>
                ) : null}

                {/* Genres, Styles, Formats */}
                {activeEditLocale.isSourceLocale ? (
                  <AuthoringExtension kind="relations">
                    <ReleaseTagsSection
                      releaseId={releaseId}
                      idPrefix={`release-${releaseId}-tags`}
                      categories={fields.categories}
                      genres={fields.genres}
                      styles={fields.styles}
                      formats={fields.formats}
                      onCategoriesChange={(categories) => setField('categories', categories)}
                      onGenresChange={(genres) => setField('genres', genres)}
                      onStylesChange={(styles) => setField('styles', styles)}
                      onFormatsChange={(formats) => setField('formats', formats)}
                      onCategoriesMutationStart={() => beginRelationSave('categories')}
                      onCategoriesMutationSettled={(succeeded) => settleRelationSave('categories', succeeded)}
                      onGenresMutationStart={() => beginRelationSave('genres')}
                      onGenresMutationSettled={(succeeded) => settleRelationSave('genres', succeeded)}
                      onStylesMutationStart={() => beginRelationSave('styles')}
                      onStylesMutationSettled={(succeeded) => settleRelationSave('styles', succeeded)}
                      onFormatsMutationStart={() => beginRelationSave('formats')}
                      onFormatsMutationSettled={(succeeded) => settleRelationSave('formats', succeeded)}
                    />
                  </AuthoringExtension>
                ) : null}

                {/* Credits */}
                <AuthoringExtension kind="relations">
                  <ReleaseCreditsSection
                    releaseId={releaseId}
                    idPrefix={`release-${releaseId}-credits`}
                    credits={fields.credits}
                    creditNotes={creditNotes}
                    canEdit={canEditNeutral}
                    canEditNotes={Boolean(
                      currentLocaleCanEdit && shouldUseLocaleDocument && blockRoomController && currentIsSynced,
                    )}
                    onCreditsChange={(credits) => setField('credits', credits)}
                    onCreditNoteChange={handleCreditNoteChange}
                    onMutationStart={() => beginRelationSave('credits')}
                    onMutationSettled={(succeeded) => settleRelationSave('credits', succeeded)}
                  />
                </AuthoringExtension>

                {/* Streaming Links */}
                {activeEditLocale.isSourceLocale ? (
                  <EditorSettingsSection title={t('sections.streamingLinks')}>
                    <DsLayoutGrid columns={{ base: 1, sm: 2, lg: 1 }}>
                      <TextInput
                        disabled={!canEditNeutral}
                        id={`release-${releaseId}-spotify-url`}
                        label="Spotify"
                        placeholder="https://open.spotify.com/..."
                        value={fields.spotifyUrl}
                        onChange={(e) => setField('spotifyUrl', e.currentTarget.value)}
                      />
                      <TextInput
                        disabled={!canEditNeutral}
                        id={`release-${releaseId}-apple-music-url`}
                        label="Apple Music"
                        placeholder="https://music.apple.com/..."
                        value={fields.appleMusicUrl}
                        onChange={(e) => setField('appleMusicUrl', e.currentTarget.value)}
                      />
                      <TextInput
                        disabled={!canEditNeutral}
                        id={`release-${releaseId}-bandcamp-url`}
                        label="Bandcamp"
                        placeholder="https://....bandcamp.com/..."
                        value={fields.bandcampUrl}
                        onChange={(e) => setField('bandcampUrl', e.currentTarget.value)}
                      />
                      <TextInput
                        disabled={!canEditNeutral}
                        id={`release-${releaseId}-youtube-music-url`}
                        label="YouTube Music"
                        placeholder="https://music.youtube.com/..."
                        value={fields.youtubeMusicUrl}
                        onChange={(e) => setField('youtubeMusicUrl', e.currentTarget.value)}
                      />
                    </DsLayoutGrid>
                  </EditorSettingsSection>
                ) : null}

                {activeEditLocale.isSourceLocale ? (
                  <AuthoringExtension kind="sharing">
                    <ShareLinkSection entityType="release" entityId={releaseId} disabled={!canEditNeutral} />
                  </AuthoringExtension>
                ) : null}

                <AuthoringExtension kind="translations">
                  <EntityTranslationsPanel
                    entityType="release"
                    entityId={releaseId}
                    canManage
                    canAdministerTranslations={canEditNeutral && activeEditLocale.isSourceLocaleReady}
                    canMutateTargets={canEditTranslationSource}
                  />
                </AuthoringExtension>
              </>
            }
          >
            <DsLayoutStack gap="md">
              {/* Basic Info */}
              <SectionCard
                padding={{ base: 'none', sm: 'md' }}
                role="group"
                aria-labelledby={`release-${releaseId}-basic-information-heading`}
              >
                <DsLayoutStack>
                  <DsText id={`release-${releaseId}-basic-information-heading`} size="sm" weight="strong">
                    {t('sections.basicInformation')}
                  </DsText>

                  <DsLayoutInline align="start">
                    {activeEditLocale.isSourceLocale ? (
                      <AuthoringExtension kind="uploads">
                        <ReleaseArtworkUploader
                          releaseId={releaseId}
                          artworkUrl={fields.artworkUrl}
                          inputId={`release-${releaseId}-artwork`}
                          onArtworkChange={(url) => setField('artworkUrl', url)}
                        />
                      </AuthoringExtension>
                    ) : null}
                    <DsLayoutStack flexible gap="sm">
                      <TextInput
                        id={`release-${releaseId}-title`}
                        label={tCommon('labels.title')}
                        value={displayedTitle}
                        onChange={(e) => handleScopedLocaleTitleChange(e.currentTarget.value)}
                        disabled={!canEditLocalizedTitle}
                        required
                      />
                      {activeEditLocale.isSourceLocale ? (
                        <DsLayoutGrid columns={2}>
                          <Select
                            disabled={!canEditNeutral}
                            id={`release-${releaseId}-type`}
                            label={tCommon('labels.type')}
                            data={releaseTypeOptions}
                            value={fields.type}
                            onChange={(val) => {
                              const parsed = releaseTypeSchema.safeParse(val);
                              if (parsed.success) {
                                setField('type', parsed.data);
                              }
                            }}
                            required
                          />
                          <DateInput
                            disabled={!canEditNeutral}
                            id={`release-${releaseId}-release-date`}
                            label={tCommon('labels.releaseDate')}
                            value={releaseDateValue}
                            onChange={handleReleaseDateChange}
                            clearable
                          />
                        </DsLayoutGrid>
                      ) : null}
                    </DsLayoutStack>
                  </DsLayoutInline>

                  <DsLayoutStack gap="xs">
                    <DsText size="sm" weight="medium">
                      {tCommon('labels.description')}
                    </DsText>
                    {isEditingScopedLocale && activeEditLocale.activeLocaleLabel ? (
                      shouldUseLocaleDocument ? (
                        localizedDescriptionSession ? (
                          <ReleaseDescriptionEditor
                            key={descriptionEditorKey}
                            id={`release-${releaseId}-description-${activeEditLocale.activeLocale ?? 'translation'}`}
                            releaseId={releaseId}
                            provider={localizedDescriptionSession.provider}
                            blockRoomController={localizedDescriptionSession.controller}
                            disabled={!currentLocaleCanEdit}
                            structureLocked
                          />
                        ) : (
                          <PageLoader placement="flow" />
                        )
                      ) : (
                        <ActiveEditLocaleContentPreview
                          localeLabel={activeEditLocale.activeLocaleLabel}
                          hasLiveRow={false}
                          contentPreview=""
                          loading={activeEditLocale.contentPreviewLoading}
                        >
                          {localizedDescriptionSession ? (
                            <ReleaseDescriptionEditor
                              key={`${descriptionEditorKey}-source-fallback`}
                              id={`release-${releaseId}-description-source-fallback`}
                              releaseId={releaseId}
                              provider={localizedDescriptionSession.provider}
                              blockRoomController={localizedDescriptionSession.controller}
                              disabled
                              structureLocked
                            />
                          ) : null}
                        </ActiveEditLocaleContentPreview>
                      )
                    ) : editorSession ? (
                      <ReleaseDescriptionEditor
                        key={descriptionEditorKey}
                        id={`release-${releaseId}-description`}
                        releaseId={releaseId}
                        provider={editorSession.provider}
                        blockRoomController={editorSession.controller}
                        disabled={!currentLocaleCanEdit}
                        structureLocked={false}
                      />
                    ) : (
                      <PageLoader placement="flow" />
                    )}
                  </DsLayoutStack>
                </DsLayoutStack>
              </SectionCard>

              {/* Tracks */}
              {activeEditLocale.isSourceLocale ? (
                <AuthoringExtension kind="relations">
                  <ReleaseTracksSection
                    releaseId={releaseId}
                    idPrefix={`release-${releaseId}-tracks`}
                    tracks={fields.tracks}
                    onTracksChange={(tracks) => setField('tracks', tracks)}
                    onMutationStart={() => beginRelationSave('tracks')}
                    onMutationSettled={(succeeded) => settleRelationSave('tracks', succeeded)}
                  />
                </AuthoringExtension>
              ) : null}
            </DsLayoutStack>
          </DocumentEditorPanels>
        </DsLayoutStack>
      </EditorRuntimeProvider>
    </ReleaseEditorAccessProvider>
  );
}
