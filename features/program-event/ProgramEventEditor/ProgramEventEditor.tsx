'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { TranscodeEntityType } from '@echovisionlab/geul-proto/secure/events_pb.ts';
import { useMutation } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Box, Combobox, Group, InputBase, Loader, SimpleGrid, Stack, Text, useCombobox } from '@mantine/core';
import { DateTimePicker } from '@mantine/dates';
import { useDebouncedCallback, useDisclosure } from '@mantine/hooks';
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
import { createProgramEventTypeAction, type ProgramEventCreditItem } from '@/lib/actions/program-event';
import {
  createMapPlaceForBlockWithBrowserClient,
  createMapPlaceWithBrowserClient,
} from '@/lib/api/map-place-browser-client';
import type { ProgramEventPosterMedia } from '@/lib/collab/program-event-meta';
import { BlockRoomMetadataError, updateBlockRoomLocaleMetadata } from '@/lib/collab/block-room-metadata';
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
  initialArtists: string[];
  initialLabels: string[];
  initialClients: string[];
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
  const [artistIds, setArtistIds] = useState(initialArtists);
  const [labelIds, setLabelIds] = useState(initialLabels);
  const [clientIds, setClientIds] = useState(initialClients);
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
  const { status, mutateEditableEvent } = lifecycle;
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
  useEffect(() => {
    setResidentTitle(activeEditLocale.displayTitle);
    setResidentSummary(activeEditLocale.displaySummary);
  }, [activeEditLocale.displaySummary, activeEditLocale.displayTitle, roomLocale]);
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
      mutateEditableEvent({ typeId: nextType.id });
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
      mutateEditableEvent({ mapPlaceId: result.data.id });
      closeCreatePlace();
    },
  });

  const debouncedMetaUpdate = useDebouncedCallback((data: ProgramEventUpdate) => mutateEditableEvent(data), 500);
  const debouncedRelationsUpdate = useDebouncedCallback(
    (next: { artists: string[]; labels: string[]; clients: string[] }) => {
      mutateEditableEvent({
        artists: next.artists.map((id, index) => ({ id, sortOrder: index })),
        labels: next.labels.map((id, index) => ({ id, sortOrder: index })),
        clients: next.clients.map((id, index) => ({ id, sortOrder: index })),
      });
    },
    500,
  );
  const updateResidentMetadata = useMutation({
    mutationFn: (update: { locale: string; title?: string; summary?: string | null }) => {
      if (!blockRoom.bootstrap || !blockRoom.protocol) {
        throw new Error('Program Event Block room is not ready.');
      }
      return updateBlockRoomLocaleMetadata(blockRoom.protocol, {
        type: 'program-event',
        ...update,
      });
    },
    onSuccess: (ack) => {
      blockRoom.acceptEpochAck(ack);
    },
    onError: (error) => {
      if (error instanceof BlockRoomMetadataError && error.reloadRequired) {
        blockRoom.reloadCanonical();
      }
      notifications.show({
        message: error instanceof Error ? error.message : tCommon('notifications.saveFailed'),
        color: 'red',
      });
    },
  });
  const debouncedResidentMetadataUpdate = useDebouncedCallback(
    (update: { locale: string; title?: string; summary?: string | null }) => {
      updateResidentMetadata.mutate(update);
    },
    500,
  );

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
      createType.mutate(typeSearch.trim());
      return;
    }
    setTypeId(value);
    debouncedMetaUpdate({ typeId: value });
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
          onBack={() => router.back()}
          onStatusChange={lifecycle.statusOptions.length > 1 ? lifecycle.changeStatus : undefined}
          onDelete={lifecycle.canDelete ? () => lifecycle.deleteEvent.mutate() : undefined}
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
              setSlug(sanitizeSlugInput(value));
            }
          }}
          onBlur={() => mutateEditableEvent({ slug })}
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
                  debouncedMetaUpdate({ seriesId: value ?? null });
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
                  debouncedMetaUpdate({ seriesOrder: next });
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
                  debouncedMetaUpdate({ timezone: value });
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
                    debouncedMetaUpdate({ startsAt: next });
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
                    debouncedMetaUpdate({ endsAt: next });
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
                  debouncedMetaUpdate({ allDay: event.currentTarget.checked });
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
                  debouncedMetaUpdate({ locationMode: next });
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
                  debouncedMetaUpdate({ mapPlaceId: value });
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
                  setTicketUrl(event.currentTarget.value);
                  debouncedMetaUpdate({ ticketUrl: event.currentTarget.value });
                }}
                disabled={!canEditNeutral}
              />
              <TextInput
                label={tProgramEventAdmin('editor.streamUrl')}
                value={streamUrl}
                onChange={(event) => {
                  setStreamUrl(event.currentTarget.value);
                  debouncedMetaUpdate({ streamUrl: event.currentTarget.value });
                }}
                disabled={!canEditNeutral}
              />
              <TextInput
                label={tProgramEventAdmin('editor.externalUrl')}
                value={externalUrl}
                onChange={(event) => {
                  setExternalUrl(event.currentTarget.value);
                  debouncedMetaUpdate({ externalUrl: event.currentTarget.value });
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
                  debouncedRelationsUpdate({
                    artists: values,
                    labels: labelIds,
                    clients: clientIds,
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
                  debouncedRelationsUpdate({
                    artists: artistIds,
                    labels: values,
                    clients: clientIds,
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
                  debouncedRelationsUpdate({
                    artists: artistIds,
                    labels: labelIds,
                    clients: values,
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
              createPlace.mutate(data);
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
