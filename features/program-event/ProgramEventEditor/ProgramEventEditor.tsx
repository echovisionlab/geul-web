'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { TranscodeEntityType } from '@echovisionlab/geul-proto/secure/events_pb.ts';
import { useMutation } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Box, Combobox, Group, InputBase, Loader, SimpleGrid, Stack, Text, useCombobox } from '@mantine/core';
import { DateTimePicker } from '@mantine/dates';
import '@mantine/dates/styles.css';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { EditorHeader } from '@/features/editor/EditorHeader';
import { MultiSelect, Select, TextInput, Checkbox, NumberInput } from '@/components/core/Input';
import { MediaPreviewGrid } from '@/components/core/MediaPreviewGrid';
import { PageLoader } from '@/features/site/PageLoader';
import { SectionCard, SectionHeader } from '@/components/core/Section';
import { UrlSection } from '@/features/metadata/UrlSection';
import { getEditorBodyLoadingId, getEditorBodyReadyId } from '@/features/editor/lib/media-test-ids';
import { MetadataPanel } from '@/features/metadata/MetadataPanel/MetadataPanel';
import { SummaryFieldCard } from '@/features/metadata/SummaryFieldCard/SummaryFieldCard';
import { CreatePlaceModal, type CreatePlaceFormState } from '@/features/place/CreatePlaceModal';
import { LocationSelector } from '@/features/post/PostEditor/LocationSelector';
import { EditorActiveLocaleControl } from '@/features/translation/EditorActiveLocaleControl';
import { EntityTranslationsPanel } from '@/features/translation/EntityTranslationsPanel';
import { LocalizedRichTextFragmentEditor } from '@/features/translation/LocalizedRichTextFragmentEditor';
import { useLocaleDocumentSession } from '@/features/translation/useLocaleDocumentSession';
import {
  createProgramEventTypeAction,
  type ProgramEventCreditItem,
  type ProgramEventNeutralConfiguration,
  type ProgramEventRelationInput,
} from '@/lib/actions/program-event';
import {
  createMapPlaceForBlockWithBrowserClient,
  createMapPlaceWithBrowserClient,
} from '@/lib/api/map-place-browser-client';
import type { ProgramEventPosterMedia } from '@/lib/collab/program-event-meta';
import { updateBlockRoomLocaleMetadata } from '@/lib/collab/block-room-metadata';
import { EditorRuntimeProvider } from '@/lib/contexts/EditorRuntimeContext';
import { MapPlaceActionProvider } from '@/lib/contexts/MapPlaceActionContext';
import { useRichTextBlockRoomEditor } from '@/features/editor/hooks/useRichTextBlockRoomEditor';
import { generateSlug, sanitizeSlugInput, toSlugInputValue } from '@/lib/utils/slug';
import { COMMON_TIMEZONES } from '@/lib/utils/timezone';
import { instantToZonedDateTimeInput, zonedDateTimeInputToInstant } from '@/lib/utils/zoned-date-time';
import { ProgramEventCreditsSection } from './ProgramEventCreditsSection';
import { ProgramEventPosterUploader } from './ProgramEventPosterUploader';
import {
  type ProgramEventStatusValue,
  type ProgramEventUpdate,
  useProgramEventLifecycle,
} from './useProgramEventLifecycle';
import type { ProgramEventEditorAction } from './program-event-actions';
import type { ProgramEventLocationModeValue } from '@/lib/types/program-event/location-mode';
import { requireActionSuccess } from '@/lib/editor/require-action-success';
import { flushEditorSaves } from '@/lib/editor/editor-save-registry';
import { useDebouncedRoomMetadata } from '@/lib/editor/useDebouncedRoomMetadata';
import { useDebouncedPatch } from '@/lib/editor/useDebouncedPatch';
import { useBlockRoomMetadataUpdates } from '@/lib/editor/useBlockRoomMetadataUpdates';
import { mergeMetadataPatches } from '@/lib/editor/merge-metadata-patches';
import {
  mergeProgramEventTypeOption,
  resolveProgramEventObservedRelations,
  useProgramEventNeutralConfiguration,
} from './useProgramEventNeutralConfiguration';

interface Option {
  id: string;
  name: string;
}

interface SeriesOption {
  id: string;
  title: string;
}

interface ProgramEventEditorProps {
  eventId: string;
  currentMemberId: string;
  userName: string;
  initialTitle: string;
  initialSlug: string | null;
  initialSummary: string | null;
  initialStatus: ProgramEventStatusValue;
  initialSourceLocale: string;
  initialTypeId: string;
  initialSeriesId: string | null;
  initialSeriesOrder: number | null;
  initialStartsAt: Date | null;
  initialEndsAt: Date | null;
  initialTimezone: string;
  initialAllDay: boolean;
  initialLocationMode: ProgramEventLocationModeValue;
  initialMapPlaceId: string | null;
  initialPosterUrl: string | null;
  initialPosterMedia: ProgramEventPosterMedia[];
  initialTicketUrl: string | null;
  initialStreamUrl: string | null;
  initialExternalUrl: string | null;
  initialArtists: ProgramEventRelationInput[];
  initialLabels: ProgramEventRelationInput[];
  initialClients: ProgramEventRelationInput[];
  initialCredits: ProgramEventCreditItem[];
  allowedActions: readonly ProgramEventEditorAction[];
  typeOptions: Option[];
  seriesOptions: SeriesOption[];
  canManageTaxonomy: boolean;
  artistOptions: Option[];
  labelOptions: Option[];
  clientOptions: Option[];
  baseUrl: string;
  canonicalOrigin: string;
  siteName: string;
}

export function ProgramEventEditor({
  eventId,
  currentMemberId: _currentMemberId,
  userName,
  initialTitle,
  initialSlug,
  initialSummary,
  initialStatus,
  initialSourceLocale,
  initialTypeId,
  initialSeriesId,
  initialSeriesOrder,
  initialStartsAt,
  initialEndsAt,
  initialTimezone,
  initialAllDay,
  initialLocationMode,
  initialMapPlaceId,
  initialPosterUrl,
  initialPosterMedia,
  initialTicketUrl,
  initialStreamUrl,
  initialExternalUrl,
  initialArtists,
  initialLabels,
  initialClients,
  initialCredits,
  allowedActions,
  typeOptions,
  seriesOptions,
  canManageTaxonomy,
  artistOptions,
  labelOptions,
  clientOptions,
  baseUrl,
  canonicalOrigin,
  siteName,
}: ProgramEventEditorProps) {
  const router = useRouter();
  const tCommon = useTranslations('common');
  const tCommonEntities = useTranslations('common.entities');
  const tCommonLabels = useTranslations('common.labels');
  const tProgramEventAdmin = useTranslations('programEventAdmin');
  const [sourceTitle, setSourceTitle] = useState(initialTitle);
  const [sourceSummary, setSourceSummary] = useState(initialSummary ?? '');
  const [slug, setSlug] = useState(initialSlug ?? '');
  const [typeId, setTypeId] = useState(initialTypeId);
  const [availableTypes, setAvailableTypes] = useState(typeOptions);
  const [typeSearch, setTypeSearch] = useState('');
  const [seriesId, setSeriesId] = useState(initialSeriesId);
  const [seriesOrder, setSeriesOrder] = useState<number | null>(initialSeriesOrder);
  const [startsAt, setStartsAt] = useState<Date | null>(initialStartsAt);
  const [endsAt, setEndsAt] = useState<Date | null>(initialEndsAt);
  const [timezone, setTimezone] = useState(initialTimezone);
  const [allDay, setAllDay] = useState(initialAllDay);
  const [locationMode, setLocationMode] = useState<ProgramEventLocationModeValue>(initialLocationMode);
  const [mapPlaceId, setMapPlaceId] = useState<string | null>(initialMapPlaceId);
  const [ticketUrl, setTicketUrl] = useState(initialTicketUrl ?? '');
  const [streamUrl, setStreamUrl] = useState(initialStreamUrl ?? '');
  const [externalUrl, setExternalUrl] = useState(initialExternalUrl ?? '');
  const [artistIds, setArtistIds] = useState(initialArtists.map(({ id }) => id));
  const [labelIds, setLabelIds] = useState(initialLabels.map(({ id }) => id));
  const [clientIds, setClientIds] = useState(initialClients.map(({ id }) => id));
  const relationBaselineRef = useRef({ artists: initialArtists, labels: initialLabels, clients: initialClients });
  const initialNeutralConfiguration = useMemo<ProgramEventNeutralConfiguration>(
    () => ({
      slug: initialSlug,
      typeId: initialTypeId,
      typeName: typeOptions.find((option) => option.id === initialTypeId)?.name ?? null,
      seriesId: initialSeriesId,
      seriesOrder: initialSeriesOrder,
      startsAt: initialStartsAt,
      endsAt: initialEndsAt,
      timezone: initialTimezone,
      allDay: initialAllDay,
      locationMode: initialLocationMode,
      mapPlaceId: initialMapPlaceId,
      ticketUrl: initialTicketUrl,
      streamUrl: initialStreamUrl,
      externalUrl: initialExternalUrl,
      artists: initialArtists,
      labels: initialLabels,
      clients: initialClients,
    }),
    [
      initialAllDay,
      initialArtists,
      initialClients,
      initialEndsAt,
      initialExternalUrl,
      initialLabels,
      initialLocationMode,
      initialMapPlaceId,
      initialSeriesId,
      initialSeriesOrder,
      initialSlug,
      initialStartsAt,
      initialStreamUrl,
      initialTicketUrl,
      initialTimezone,
      initialTypeId,
      typeOptions,
    ],
  );
  const pendingAuxiliaryWritesRef = useRef(new Set<Promise<void>>());
  const [posterMedia, setPosterMedia] = useState(initialPosterMedia);
  const [createPlaceInitialName, setCreatePlaceInitialName] = useState('');
  const [createPlaceOpened, { open: openCreatePlace, close: closeCreatePlace }] = useDisclosure(false);
  const typeCombobox = useCombobox({
    onDropdownClose: () => typeCombobox.resetSelectedOption(),
  });

  const localeSession = useLocaleDocumentSession({
    entityType: 'program_event',
    entityId: eventId,
    sourceTitle,
    sourceSummary,
    initialSourceLocale,
  });
  const { activeEditLocale, roomLocale } = localeSession;
  const { shouldUseLocaleDocument } = localeSession.mode;
  const canEditEvent = allowedActions.includes('edit');
  const blockRoom = useRichTextBlockRoomEditor('program-event', eventId, roomLocale);
  const hasLocaleRoomMutationAuthority = localeSession.hasRoomMutationAuthority({
    sourceLocale: blockRoom.bootstrap?.sourceLocale ?? null,
    locale: blockRoom.bootstrap?.locale ?? null,
    localeExists: blockRoom.bootstrap?.localeExists ?? false,
    documentRevision: blockRoom.bootstrap?.documentRevision ?? null,
    targetRevision: blockRoom.bootstrap?.targetRevision,
  });
  const canEditCurrentLocale =
    canEditEvent && activeEditLocale.canEditActiveLocale && shouldUseLocaleDocument && hasLocaleRoomMutationAuthority;
  const canEditNeutral = canEditCurrentLocale && activeEditLocale.isSourceLocale;
  const neutralAllowedActions = useMemo(() => (canEditNeutral ? allowedActions : []), [allowedActions, canEditNeutral]);
  const lifecycle = useProgramEventLifecycle({
    eventId,
    initialStatus,
    allowedActions: neutralAllowedActions,
  });
  const { status, saveEditableEvent } = lifecycle;
  const adoptNeutralConfiguration = useCallback((configuration: Partial<ProgramEventNeutralConfiguration>) => {
    if (configuration.slug !== undefined) {
      setSlug(configuration.slug ?? '');
    }
    if (configuration.typeId !== undefined) {
      setTypeId(configuration.typeId);
    }
    if (configuration.typeId !== undefined && configuration.typeName) {
      const { typeId, typeName } = configuration;
      setAvailableTypes((current) => mergeProgramEventTypeOption(current, typeId, typeName));
    }
    if (configuration.seriesId !== undefined) {
      setSeriesId(configuration.seriesId);
    }
    if (configuration.seriesOrder !== undefined) {
      setSeriesOrder(configuration.seriesOrder);
    }
    if (configuration.startsAt !== undefined) {
      setStartsAt(configuration.startsAt);
    }
    if (configuration.endsAt !== undefined) {
      setEndsAt(configuration.endsAt);
    }
    if (configuration.timezone !== undefined) {
      setTimezone(configuration.timezone);
    }
    if (configuration.allDay !== undefined) {
      setAllDay(configuration.allDay);
    }
    if (configuration.locationMode !== undefined) {
      setLocationMode(configuration.locationMode);
    }
    if (configuration.mapPlaceId !== undefined) {
      setMapPlaceId(configuration.mapPlaceId);
    }
    if (configuration.ticketUrl !== undefined) {
      setTicketUrl(configuration.ticketUrl ?? '');
    }
    if (configuration.streamUrl !== undefined) {
      setStreamUrl(configuration.streamUrl ?? '');
    }
    if (configuration.externalUrl !== undefined) {
      setExternalUrl(configuration.externalUrl ?? '');
    }
    if (configuration.artists !== undefined) {
      relationBaselineRef.current = { ...relationBaselineRef.current, artists: configuration.artists };
      setArtistIds(configuration.artists.map(({ id }) => id));
    }
    if (configuration.labels !== undefined) {
      relationBaselineRef.current = { ...relationBaselineRef.current, labels: configuration.labels };
      setLabelIds(configuration.labels.map(({ id }) => id));
    }
    if (configuration.clients !== undefined) {
      relationBaselineRef.current = { ...relationBaselineRef.current, clients: configuration.clients };
      setClientIds(configuration.clients.map(({ id }) => id));
    }
  }, []);
  const neutralConfiguration = useProgramEventNeutralConfiguration({
    eventId,
    initialConfiguration: initialNeutralConfiguration,
    provider: blockRoom.provider,
    onAdopt: adoptNeutralConfiguration,
  });
  const timezoneSelectData = useMemo(() => {
    const options = COMMON_TIMEZONES.map((option) => ({
      value: option.value,
      label: option.label,
    }));
    if (timezone && !options.some((option) => option.value === timezone)) {
      return [{ value: timezone, label: timezone }, ...options];
    }
    return options;
  }, [timezone]);
  const startsAtInput = useMemo(
    () => (startsAt ? instantToZonedDateTimeInput(startsAt, timezone) : null),
    [startsAt, timezone],
  );
  const endsAtInput = useMemo(
    () => (endsAt ? instantToZonedDateTimeInput(endsAt, timezone) : null),
    [endsAt, timezone],
  );
  const canEditTitle = canEditCurrentLocale && blockRoom.isSynced;
  const [residentTitle, setResidentTitle] = useState(initialTitle);
  const [residentSummary, setResidentSummary] = useState(initialSummary ?? '');
  const debouncedResidentMetadataUpdate = useDebouncedRoomMetadata({
    connection: blockRoom,
    document: `program_event:${eventId}`,
    delay: 500,
    write: (protocol, update: { locale: string; title?: string; summary?: string | null }) =>
      updateBlockRoomLocaleMetadata(protocol, { type: 'program-event', ...update }),
  });
  useEffect(() => {
    const pending = debouncedResidentMetadataUpdate.getPendingPatch();
    const pendingForRoom = pending?.locale === roomLocale ? pending : null;
    setResidentTitle(
      pendingForRoom && Object.hasOwn(pendingForRoom, 'title')
        ? (pendingForRoom.title ?? '')
        : activeEditLocale.displayTitle,
    );
    setResidentSummary(
      pendingForRoom && Object.hasOwn(pendingForRoom, 'summary')
        ? (pendingForRoom.summary ?? '')
        : activeEditLocale.displaySummary,
    );
  }, [
    activeEditLocale.displaySummary,
    activeEditLocale.displayTitle,
    debouncedResidentMetadataUpdate,
    eventId,
    roomLocale,
  ]);
  const displayedTitle = roomLocale ? residentTitle : activeEditLocale.displayTitle;
  const displayedSummary = roomLocale ? residentSummary : activeEditLocale.displaySummary;

  const createType = useMutation({
    mutationFn: (name: string) =>
      createProgramEventTypeAction({
        name,
        slug: generateSlug(name),
        sortOrder: availableTypes.length,
      }),
    onSuccess: (result, name) => {
      if (result.error || !result.data) {
        notifications.show({
          message: result.error ?? tCommon('notifications.saveFailed'),
          color: 'red',
        });
        return;
      }
      const nextType = {
        id: result.data.id,
        name: result.data.name || name,
      };
      setAvailableTypes((current) =>
        current.some((item) => item.id === nextType.id) ? current : [...current, nextType],
      );
      if (!lifecycle.isEditable()) {
        return;
      }
      setTypeId(nextType.id);
      queueNeutralPatch({ typeId: nextType.id });
      setTypeSearch('');
      typeCombobox.closeDropdown();
      notifications.show({ message: tCommon('notifications.saveSuccess'), color: 'green' });
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
      setMapPlaceId(result.data.id);
      queueNeutralPatch({ mapPlaceId: result.data.id });
      closeCreatePlace();
    },
  });

  const debouncedMetaUpdate = useDebouncedPatch({
    write: async (data: ProgramEventUpdate) => {
      const currentBaseline = relationBaselineRef.current;
      const observed = resolveProgramEventObservedRelations(data, currentBaseline);
      const write = neutralConfiguration.beginWrite(data);
      try {
        await requireActionSuccess(
          saveEditableEvent({ ...data, ...(Object.keys(observed).length ? { observed } : {}) }),
        );
      } catch (error) {
        write.fail();
        throw error;
      }

      const nextBaseline = { ...currentBaseline };
      for (const collection of ['artists', 'labels', 'clients'] as const) {
        const desired = data[collection];
        if (desired === undefined) {
          continue;
        }
        const collectionBaseline = data.observed?.[collection] ?? currentBaseline[collection];
        const previousById = new Map(collectionBaseline.map((relation) => [relation.id, relation]));
        let nextSortOrder = Math.max(-1, ...collectionBaseline.map(({ sortOrder }) => sortOrder ?? -1)) + 1;
        nextBaseline[collection] = desired
          .map((relation) => {
            const previous = previousById.get(relation.id);
            return {
              id: relation.id,
              ...(relation.role === undefined
                ? previous?.role === undefined
                  ? {}
                  : { role: previous.role }
                : { role: relation.role }),
              sortOrder: relation.sortOrder ?? nextSortOrder++,
            };
          })
          .sort((left, right) => (left.sortOrder ?? 0) - (right.sortOrder ?? 0));
      }
      relationBaselineRef.current = nextBaseline;
      write.acknowledge(data);
    },
    delay: 500,
    scope: eventId,
    document: `program_event:${eventId}`,
    merge: mergeMetadataPatches,
    recoveryKey: 'event-relations',
    retry: true,
  });
  const queueNeutralPatch = useCallback(
    (patch: ProgramEventUpdate) => {
      if (patch.slug !== undefined) {
        neutralConfiguration.setDraft('slug', patch.slug || null);
      }
      if (patch.typeId !== undefined) {
        neutralConfiguration.setDraft('typeId', patch.typeId);
      }
      if (patch.seriesId !== undefined) {
        neutralConfiguration.setDraft('seriesId', patch.seriesId);
      }
      if (patch.seriesOrder !== undefined) {
        neutralConfiguration.setDraft('seriesOrder', patch.seriesOrder);
      }
      if (patch.startsAt !== undefined) {
        neutralConfiguration.setDraft('startsAt', patch.startsAt);
      }
      if (patch.endsAt !== undefined) {
        neutralConfiguration.setDraft('endsAt', patch.endsAt);
      }
      if (patch.timezone !== undefined) {
        neutralConfiguration.setDraft('timezone', patch.timezone);
      }
      if (patch.allDay !== undefined) {
        neutralConfiguration.setDraft('allDay', patch.allDay);
      }
      if (patch.locationMode !== undefined) {
        neutralConfiguration.setDraft('locationMode', patch.locationMode);
      }
      if (patch.mapPlaceId !== undefined) {
        neutralConfiguration.setDraft('mapPlaceId', patch.mapPlaceId);
      }
      if (patch.ticketUrl !== undefined) {
        neutralConfiguration.setDraft('ticketUrl', patch.ticketUrl || null);
      }
      if (patch.streamUrl !== undefined) {
        neutralConfiguration.setDraft('streamUrl', patch.streamUrl || null);
      }
      if (patch.externalUrl !== undefined) {
        neutralConfiguration.setDraft('externalUrl', patch.externalUrl || null);
      }
      if (patch.artists !== undefined) {
        neutralConfiguration.setDraft('artists', patch.artists);
      }
      if (patch.labels !== undefined) {
        neutralConfiguration.setDraft('labels', patch.labels);
      }
      if (patch.clients !== undefined) {
        neutralConfiguration.setDraft('clients', patch.clients);
      }
      debouncedMetaUpdate(patch);
    },
    [debouncedMetaUpdate, neutralConfiguration.setDraft],
  );

  const trackAuxiliaryWrite = useCallback(
    (promise: Promise<unknown>) => {
      const tracked = promise
        .then(() => undefined)
        .catch((error: unknown) => {
          notifications.show({
            message: error instanceof Error ? error.message : tCommon('notifications.saveFailed'),
            color: 'red',
          });
        })
        .finally(() => pendingAuxiliaryWritesRef.current.delete(tracked));
      pendingAuxiliaryWritesRef.current.add(tracked);
    },
    [tCommon],
  );
  const flushPendingSaves = useCallback(async () => {
    while (pendingAuxiliaryWritesRef.current.size > 0) {
      await Promise.all([...pendingAuxiliaryWritesRef.current]);
    }
    const saved = await flushEditorSaves(`program_event:${eventId}`);
    if (!saved) {
      notifications.show({ message: tCommon('notifications.saveFailed'), color: 'red' });
    }
    return saved;
  }, [eventId, tCommon]);
  const handleBack = useCallback(async () => {
    if (await flushPendingSaves()) {
      router.back();
    }
  }, [flushPendingSaves, router]);
  const handleStatusChange = useCallback(
    async (nextStatus: ProgramEventStatusValue) => {
      if (await flushPendingSaves()) {
        lifecycle.changeStatus(nextStatus);
      }
    },
    [flushPendingSaves, lifecycle.changeStatus],
  );
  const handleDelete = useCallback(async () => {
    if (await flushPendingSaves()) {
      lifecycle.deleteEvent.mutate();
    }
  }, [flushPendingSaves, lifecycle.deleteEvent.mutate]);

  const handleTitleChange = useCallback(
    (value: string) => {
      if (!roomLocale || !canEditTitle) {
        return;
      }
      setResidentTitle(value);
      debouncedResidentMetadataUpdate({ locale: roomLocale, title: value });
      if (activeEditLocale.isSourceLocale) {
        setSourceTitle(value);
      }
    },
    [activeEditLocale.isSourceLocale, canEditTitle, debouncedResidentMetadataUpdate, roomLocale],
  );

  const handleSummaryChange = useCallback(
    (value: string) => {
      if (!roomLocale || !canEditEvent || !activeEditLocale.canEditActiveLocale) {
        return;
      }
      setResidentSummary(value);
      debouncedResidentMetadataUpdate({ locale: roomLocale, summary: value || null });
      if (activeEditLocale.isSourceLocale) {
        setSourceSummary(value);
      }
    },
    [
      activeEditLocale.canEditActiveLocale,
      activeEditLocale.isSourceLocale,
      canEditEvent,
      debouncedResidentMetadataUpdate,
      roomLocale,
    ],
  );

  useBlockRoomMetadataUpdates(blockRoom, `program_event:${eventId}`, ({ operation, values }) => {
    if (operation !== 'locale') {
      return;
    }
    if (typeof values.title === 'string') {
      setResidentTitle(values.title);
      if (activeEditLocale.isSourceLocale) {
        setSourceTitle(values.title);
      }
    }
    if (values.summary === null || typeof values.summary === 'string') {
      const nextSummary = values.summary ?? '';
      setResidentSummary(nextSummary);
      if (activeEditLocale.isSourceLocale) {
        setSourceSummary(nextSummary);
      }
    }
  });

  const seriesSelectData = seriesOptions.map((option) => ({
    value: option.id,
    label: option.title,
  }));
  const artistSelectData = artistOptions.map((option) => ({
    value: option.id,
    label: option.name,
  }));
  const labelSelectData = labelOptions.map((option) => ({ value: option.id, label: option.name }));
  const clientSelectData = clientOptions.map((option) => ({
    value: option.id,
    label: option.name,
  }));
  const canEditTranslationSource = canEditEvent;
  const editorReady = Boolean(
    roomLocale && blockRoom.provider && blockRoom.doc && blockRoom.controller && blockRoom.isSynced,
  );
  const primaryPosterUrl = posterMedia.find((item) => item.isPrimary)?.url ?? posterMedia[0]?.url ?? initialPosterUrl;
  const routePath = `/events/${slug || eventId}`;
  const showLocationSelector = locationMode === 'map_place' || locationMode === 'hybrid';
  const selectedType = availableTypes.find((option) => option.id === typeId) ?? null;
  const filteredTypes = availableTypes.filter((option) =>
    option.name.toLowerCase().includes(typeSearch.trim().toLowerCase()),
  );
  const hasExactTypeMatch = availableTypes.some(
    (option) => option.name.toLowerCase() === typeSearch.trim().toLowerCase(),
  );
  const canCreateType = canManageTaxonomy && typeSearch.trim().length > 0 && !hasExactTypeMatch && canEditNeutral;
  const handleTypeSelect = (value: string) => {
    if (!canEditNeutral) {
      return;
    }
    if (value === '$create') {
      trackAuxiliaryWrite(createType.mutateAsync(typeSearch.trim()));
      return;
    }
    setTypeId(value);
    queueNeutralPatch({ typeId: value });
    setTypeSearch('');
    typeCombobox.closeDropdown();
  };

  const editor = (
    <MapPlaceActionProvider createMapPlaceForBlock={createMapPlaceForBlockWithBrowserClient}>
      <Stack h="100%" gap="md">
        <EditorHeader
          title={displayedTitle}
          onTitleChange={canEditTitle ? handleTitleChange : undefined}
          titleInputId={`program-event-${eventId}-title`}
          titlePlaceholder={tCommon('states.untitledEntity', { entity: tCommon('entities.programEvent') })}
          titleDisabled={!canEditTitle}
          status={status}
          statusOptions={lifecycle.statusOptions}
          isConnected={blockRoom.isConnected}
          isSynced={blockRoom.isSynced}
          onBack={handleBack}
          onStatusChange={lifecycle.statusOptions.length > 1 ? handleStatusChange : undefined}
          onDelete={lifecycle.canDelete ? handleDelete : undefined}
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
          isStatusChanging={lifecycle.isStatusChanging}
          isDeleting={lifecycle.deleteEvent.isPending}
          backTooltip={tCommon('actions.back')}
          groupStatusWithCollab
          controls={<EditorActiveLocaleControl state={activeEditLocale} />}
        />

        <MediaPreviewGrid>
          <ProgramEventPosterUploader
            eventId={eventId}
            media={posterMedia}
            idPrefix={`program-event-${eventId}-poster`}
            canEdit={canEditNeutral}
            onMediaChange={setPosterMedia}
          />
          <MetadataPanel
            title={displayedTitle}
            summary={displayedSummary}
            routePath={routePath}
            canonicalOrigin={canonicalOrigin}
            siteName={siteName}
            defaultImageUrl={primaryPosterUrl}
            defaultSchemaType="Event"
          />
        </MediaPreviewGrid>

        <UrlSection
          baseUrl={baseUrl}
          entityType="program_event"
          entityId={eventId}
          slug={toSlugInputValue(slug)}
          idPrefix={`program-event-${eventId}`}
          disabled={!canEditNeutral}
          onChange={(value) => {
            if (canEditNeutral) {
              const nextSlug = sanitizeSlugInput(value);
              setSlug(nextSlug);
              queueNeutralPatch({ slug: nextSlug });
            }
          }}
        />

        <SummaryFieldCard
          entityType="program_event"
          entityId={eventId}
          title={displayedTitle}
          summary={displayedSummary}
          summaryReadOnly={
            !shouldUseLocaleDocument || !canEditCurrentLocale || !blockRoom.isSynced || !canEditTranslationSource
          }
          hideAiActions
          onSummaryChange={shouldUseLocaleDocument ? handleSummaryChange : undefined}
        />

        <EntityTranslationsPanel entityType="program_event" entityId={eventId} canManage={canEditEvent} />

        <SectionCard>
          <Stack gap="md">
            <SectionHeader title={tProgramEventAdmin('editor.details')} />
            <SimpleGrid cols={{ base: 1, md: 2 }}>
              <Combobox
                store={typeCombobox}
                onOptionSubmit={handleTypeSelect}
                withinPortal={false}
                disabled={!canEditNeutral}
              >
                <Combobox.DropdownTarget>
                  <InputBase
                    component="button"
                    type="button"
                    pointer
                    label={tCommonLabels('type')}
                    onClick={() => {
                      if (canEditNeutral) {
                        typeCombobox.toggleDropdown();
                      }
                    }}
                    rightSection={createType.isPending ? <Loader size={16} /> : null}
                    disabled={!canEditNeutral}
                  >
                    {selectedType ? (
                      <Text size="sm">{selectedType.name}</Text>
                    ) : (
                      <Text size="sm" c="dimmed">
                        {tCommon('actions.searchItems', {
                          items: tCommonEntities('programEventTypes').toLowerCase(),
                        })}
                      </Text>
                    )}
                  </InputBase>
                </Combobox.DropdownTarget>
                <Combobox.Dropdown>
                  <Combobox.Search
                    value={typeSearch}
                    onChange={(event) => setTypeSearch(event.currentTarget.value)}
                    placeholder={tCommon('actions.searchItems', {
                      items: tCommonEntities('programEventTypes').toLowerCase(),
                    })}
                  />
                  <Combobox.Options>
                    {filteredTypes.map((option) => (
                      <Combobox.Option key={option.id} value={option.id} active={option.id === typeId}>
                        <Text size="sm">{option.name}</Text>
                      </Combobox.Option>
                    ))}
                    {canCreateType && (
                      <Combobox.Option value="$create">
                        {tCommon('actions.createNamed', { name: typeSearch.trim() })}
                      </Combobox.Option>
                    )}
                    {filteredTypes.length === 0 && !canCreateType && (
                      <Combobox.Empty>{tCommon('states.none')}</Combobox.Empty>
                    )}
                  </Combobox.Options>
                </Combobox.Dropdown>
              </Combobox>
              <Select
                label={tProgramEventAdmin('editor.series')}
                data={seriesSelectData}
                value={seriesId}
                onChange={(value) => {
                  setSeriesId(value);
                  queueNeutralPatch({ seriesId: value ?? null });
                }}
                searchable
                clearable
                disabled={!canEditNeutral}
              />
              <NumberInput
                label={tProgramEventAdmin('editor.seriesOrder')}
                value={seriesOrder ?? ''}
                min={0}
                onChange={(value) => {
                  const next = typeof value === 'number' ? value : null;
                  setSeriesOrder(next);
                  queueNeutralPatch({ seriesOrder: next });
                }}
                disabled={!canEditNeutral}
              />
              <Select
                label={tProgramEventAdmin('editor.timezone')}
                data={timezoneSelectData}
                value={timezone}
                onChange={(value) => {
                  if (!value) {
                    return;
                  }
                  setTimezone(value);
                  queueNeutralPatch({ timezone: value });
                }}
                searchable
                allowDeselect={false}
                disabled={!canEditNeutral}
              />
              <DateTimePicker
                label={tProgramEventAdmin('editor.startsAt')}
                value={startsAtInput}
                onChange={(value) => {
                  if (!value) {
                    return;
                  }
                  try {
                    const next = zonedDateTimeInputToInstant(value, timezone);
                    setStartsAt(next);
                    queueNeutralPatch({ startsAt: next });
                  } catch {
                    notifications.show({
                      message: tCommon('notifications.saveFailed'),
                      color: 'red',
                    });
                  }
                }}
                disabled={!canEditNeutral}
              />
              <DateTimePicker
                label={tProgramEventAdmin('editor.endsAt')}
                value={endsAtInput}
                clearable
                onChange={(value) => {
                  try {
                    const next = value ? zonedDateTimeInputToInstant(value, timezone) : null;
                    setEndsAt(next);
                    queueNeutralPatch({ endsAt: next });
                  } catch {
                    notifications.show({
                      message: tCommon('notifications.saveFailed'),
                      color: 'red',
                    });
                  }
                }}
                disabled={!canEditNeutral}
              />
            </SimpleGrid>
            <Group>
              <Checkbox
                label={tProgramEventAdmin('editor.allDay')}
                checked={allDay}
                onChange={(event) => {
                  setAllDay(event.currentTarget.checked);
                  queueNeutralPatch({ allDay: event.currentTarget.checked });
                }}
                disabled={!canEditNeutral}
              />
            </Group>
            <SimpleGrid cols={{ base: 1, md: 2 }}>
              <Select
                label={tProgramEventAdmin('editor.locationMode')}
                data={[
                  { value: 'map_place', label: tProgramEventAdmin('locationModes.mapPlace') },
                  { value: 'online', label: tProgramEventAdmin('locationModes.online') },
                  { value: 'hybrid', label: tProgramEventAdmin('locationModes.hybrid') },
                  { value: 'tba', label: tProgramEventAdmin('locationModes.tba') },
                ]}
                value={locationMode}
                onChange={(value) => {
                  const next = (value ?? 'tba') as ProgramEventLocationModeValue;
                  setLocationMode(next);
                  queueNeutralPatch({ locationMode: next });
                }}
                disabled={!canEditNeutral}
              />
            </SimpleGrid>
            {showLocationSelector ? (
              <LocationSelector
                value={mapPlaceId}
                idPrefix={`program-event-${eventId}-location`}
                canEdit={canEditNeutral}
                onChange={(value) => {
                  setMapPlaceId(value);
                  queueNeutralPatch({ mapPlaceId: value });
                }}
                onCreateNew={(searchTerm) => {
                  if (!canEditNeutral) {
                    return;
                  }
                  setCreatePlaceInitialName(searchTerm);
                  openCreatePlace();
                }}
              />
            ) : null}
            <SimpleGrid cols={{ base: 1, md: 3 }}>
              <TextInput
                label={tProgramEventAdmin('editor.ticketUrl')}
                value={ticketUrl}
                onChange={(event) => {
                  const next = event.currentTarget.value;
                  setTicketUrl(next);
                  queueNeutralPatch({ ticketUrl: next || null });
                }}
                disabled={!canEditNeutral}
              />
              <TextInput
                label={tProgramEventAdmin('editor.streamUrl')}
                value={streamUrl}
                onChange={(event) => {
                  const next = event.currentTarget.value;
                  setStreamUrl(next);
                  queueNeutralPatch({ streamUrl: next || null });
                }}
                disabled={!canEditNeutral}
              />
              <TextInput
                label={tProgramEventAdmin('editor.externalUrl')}
                value={externalUrl}
                onChange={(event) => {
                  const next = event.currentTarget.value;
                  setExternalUrl(next);
                  queueNeutralPatch({ externalUrl: next || null });
                }}
                disabled={!canEditNeutral}
              />
            </SimpleGrid>
          </Stack>
        </SectionCard>

        <SectionCard>
          <Stack gap="md">
            <SimpleGrid cols={{ base: 1, md: 3 }}>
              <MultiSelect
                label={tCommonEntities('artists')}
                data={artistSelectData}
                value={artistIds}
                onChange={(values) => {
                  setArtistIds(values);
                  const observed = relationBaselineRef.current.artists;
                  const baselineById = new Map(observed.map((relation) => [relation.id, relation]));
                  queueNeutralPatch({
                    artists: values.map((id, sortOrder) => ({
                      id,
                      ...(baselineById.has(id) ? { role: baselineById.get(id)?.role } : {}),
                      sortOrder,
                    })),
                    observed: { artists: observed },
                  });
                }}
                searchable
                disabled={!canEditNeutral}
              />
              <MultiSelect
                label={tCommonEntities('labels')}
                data={labelSelectData}
                value={labelIds}
                onChange={(values) => {
                  setLabelIds(values);
                  const observed = relationBaselineRef.current.labels;
                  const baselineById = new Map(observed.map((relation) => [relation.id, relation]));
                  queueNeutralPatch({
                    labels: values.map((id, sortOrder) => ({
                      id,
                      ...(baselineById.has(id) ? { role: baselineById.get(id)?.role } : {}),
                      sortOrder,
                    })),
                    observed: { labels: observed },
                  });
                }}
                searchable
                disabled={!canEditNeutral}
              />
              <MultiSelect
                label={tCommonEntities('clients')}
                data={clientSelectData}
                value={clientIds}
                onChange={(values) => {
                  setClientIds(values);
                  const observed = relationBaselineRef.current.clients;
                  const baselineById = new Map(observed.map((relation) => [relation.id, relation]));
                  queueNeutralPatch({
                    clients: values.map((id, sortOrder) => ({
                      id,
                      ...(baselineById.has(id) ? { role: baselineById.get(id)?.role } : {}),
                      sortOrder,
                    })),
                    observed: { clients: observed },
                  });
                }}
                searchable
                disabled={!canEditNeutral}
              />
            </SimpleGrid>
          </Stack>
        </SectionCard>

        <ProgramEventCreditsSection eventId={eventId} canEdit={canEditNeutral} initialCredits={initialCredits} />

        <SectionCard withBorder p="md" flex={1} style={{ minHeight: 360, display: 'flex', flexDirection: 'column' }}>
          <Text size="sm" fw={500} mb="xs">
            {tCommonLabels('body')}
          </Text>
          <Box flex={1} pos="relative">
            {editorReady ? (
              <Box id={getEditorBodyReadyId('program_event', eventId)} h="100%">
                <LocalizedRichTextFragmentEditor
                  key={`program-event-${eventId}-${roomLocale}`}
                  provider={blockRoom.provider!}
                  blockRoomController={blockRoom.controller!}
                  userName={userName}
                  editable={canEditCurrentLocale}
                  entityId={eventId}
                  entityType={TranscodeEntityType.PROGRAM_EVENT}
                  allowNeutralBlockEdits={activeEditLocale.isSourceLocale}
                  allowStructuralEdits={activeEditLocale.isSourceLocale}
                  aiTarget={
                    canEditCurrentLocale && activeEditLocale.activeLocale
                      ? { type: 'program-event', id: eventId, locale: activeEditLocale.activeLocale }
                      : undefined
                  }
                />
              </Box>
            ) : (
              <Box id={getEditorBodyLoadingId('program_event', eventId)}>
                <PageLoader size="sm" minHeight={300} />
              </Box>
            )}
          </Box>
        </SectionCard>

        <CreatePlaceModal
          opened={createPlaceOpened}
          onClose={closeCreatePlace}
          onSubmit={(data) => {
            if (canEditNeutral) {
              trackAuxiliaryWrite(createPlace.mutateAsync(data));
            }
          }}
          isPending={createPlace.isPending}
          initialName={createPlaceInitialName}
        />
      </Stack>
    </MapPlaceActionProvider>
  );

  return (
    <EditorRuntimeProvider
      provider={blockRoom.provider}
      entityType="program_event"
      entityId={eventId}
      blockRoomProtocol={blockRoom.protocol}
    >
      {editor}
    </EditorRuntimeProvider>
  );
}
