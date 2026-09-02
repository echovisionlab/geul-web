'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Group, SimpleGrid, Stack, Text } from '@mantine/core';
import { DateInput, type DateValue } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import { useDebouncedCallback } from '@mantine/hooks';
import { EditorHeader, type StatusOption } from '@/features/editor/EditorHeader';
import { Select, TextInput } from '@/components/core/Input';
import { SectionCard } from '@/components/core/Section';
import { ShareLinkSection } from '@/features/share/ShareLinkSection';
import { UrlSection } from '@/features/metadata/UrlSection';
import { ActiveEditLocaleContentPreview } from '@/features/translation/ActiveEditLocaleContentPreview';
import { EditorActiveLocaleControl } from '@/features/translation/EditorActiveLocaleControl';
import { EntityTranslationsPanel } from '@/features/translation/EntityTranslationsPanel';
import { isLocaleDocumentEditable } from '@/features/translation/locale-document-mode';
import { useLocaleDocumentSession } from '@/features/translation/useLocaleDocumentSession';
import {
  deleteReleaseAction,
  publishReleaseAction,
  unpublishReleaseAction,
  updateReleaseFieldsAction,
  updateReleaseSlugAction,
} from '@/lib/actions/release';
import type { ReleaseFields, ReleaseTrackItem } from '@/lib/collab/schemas/release-fields.schema';
import { BlockRoomMetadataError, updateBlockRoomLocaleMetadata } from '@/lib/collab/block-room-metadata';
import { EditorRuntimeProvider } from '@/lib/contexts/EditorRuntimeContext';
import { useRichTextBlockRoomController } from '@/features/editor/hooks/useBlockRoomTiptapController';
import { useBlockRoomConnection } from '@/lib/collab/useBlockRoomConnection';
import { useSlugManagement } from '@/lib/hooks/useSlugManagement';
import type {
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
  initialCredits: ReleaseCreditItem[];
  initialLabels: ReleaseLabelItem[];
  initialCategories: ReleaseCategoryItem[];
  initialGenres: ReleaseGenreItem[];
  initialStyles: ReleaseStyleItem[];
  initialFormats: ReleaseFormatItem[];
  initialTracks: ReleaseTrackItem[];
  baseUrl: string;
}

export function ReleaseEditor({
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
  const tActions = useTranslations('common.actions');
  const tStatuses = useTranslations('common.statuses');
  const tStates = useTranslations('common.states');
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
    artists: [],
  });
  const localeSession = useLocaleDocumentSession({
    entityType: 'release',
    entityId: releaseId,
    sourceTitle: initialTitle,
    sourceSummary: '',
  });
  const { activeEditLocale, roomLocale } = localeSession;
  const canEditTranslationSource = true;
  const { isEditingScopedLocale, shouldUseLocaleDocument } = localeSession.mode;
  const blockRoom = useBlockRoomConnection('release', releaseId, roomLocale);
  const { provider, doc, bootstrap, protocol, isConnected, isSynced, acceptEpochAck, reloadCanonical } = blockRoom;
  const blockRoomController = useRichTextBlockRoomController('release', doc, roomLocale);
  const currentProvider = provider;
  const currentIsConnected = isConnected;
  const currentIsSynced = isSynced;
  const [creditNotes, setCreditNotes] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!roomLocale) {
      setCreditNotes({});
      return;
    }
    const projection =
      bootstrap?.localeMetadata ??
      (bootstrap?.sourceMetadata?.locale === roomLocale ? bootstrap.sourceMetadata : undefined);
    setCreditNotes(Object.fromEntries((projection?.creditNotes ?? []).map(({ creditId, note }) => [creditId, note])));
  }, [bootstrap?.localeMetadata, bootstrap?.sourceMetadata, roomLocale]);
  const descriptionEditorKey = `release-${roomLocale ?? 'source'}`;
  const [residentTitle, setResidentTitle] = useState(initialTitle);
  useEffect(() => setResidentTitle(activeEditLocale.displayTitle), [activeEditLocale.displayTitle, roomLocale]);
  const displayedTitle = roomLocale ? residentTitle : activeEditLocale.displayTitle;
  const hasLocaleRoomMutationAuthority = localeSession.hasRoomMutationAuthority({
    sourceLocale: bootstrap?.sourceLocale ?? null,
    locale: bootstrap?.locale ?? null,
    localeExists: bootstrap?.localeExists ?? false,
    documentRevision: bootstrap?.documentRevision ?? null,
    targetRevision: bootstrap?.targetRevision,
  });
  const currentLocaleCanEdit = activeEditLocale.canEditActiveLocale && hasLocaleRoomMutationAuthority;
  const canEditNeutral = currentLocaleCanEdit && activeEditLocale.isSourceLocale;
  const canEditLocalizedTitle = isLocaleDocumentEditable({
    activeLocale: activeEditLocale.activeLocale,
    shouldUseLocaleDocument,
    canEditActiveLocale: currentLocaleCanEdit,
    isSynced: currentIsSynced,
  });
  const editorSession =
    currentProvider && blockRoomController && currentIsSynced
      ? { provider: currentProvider, controller: blockRoomController }
      : null;
  const localizedDescriptionSession = editorSession;
  const updateLocaleMetadata = useMutation({
    mutationFn: (input: {
      locale: string;
      title?: string;
      creditNotes?: readonly { creditId: string; note: string }[];
    }) => {
      if (!bootstrap || !protocol) {
        throw new Error('Release Block room is not ready.');
      }
      return updateBlockRoomLocaleMetadata(protocol, { type: 'release', ...input });
    },
    onSuccess: acceptEpochAck,
    onError: (error) => {
      if (error instanceof BlockRoomMetadataError && error.reloadRequired) {
        reloadCanonical();
      }
      notifications.show({
        message: error instanceof Error ? error.message : tCommon('notifications.saveFailed'),
        color: 'red',
      });
    },
  });
  const updateReleaseFields = useMutation({
    mutationFn: (input: Parameters<typeof updateReleaseFieldsAction>[1]) => updateReleaseFieldsAction(releaseId, input),
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({ message: result.error, color: 'red' });
      }
    },
  });
  const debouncedLocaleMetadataUpdate = useDebouncedCallback(
    (input: { locale: string; title?: string; creditNotes?: readonly { creditId: string; note: string }[] }) =>
      updateLocaleMetadata.mutate(input),
    500,
  );
  const debouncedReleaseFieldsUpdate = useDebouncedCallback(
    (input: Parameters<typeof updateReleaseFieldsAction>[1]) => updateReleaseFields.mutate(input),
    500,
  );
  const setField = useCallback(
    <K extends keyof ReleaseFields>(key: K, value: ReleaseFields[K]) => {
      if (!canEditNeutral) {
        return;
      }
      setFields((current) => ({ ...current, [key]: value }));
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
    [canEditNeutral, debouncedReleaseFieldsUpdate],
  );
  const publishRelease = useMutation({
    mutationFn: () => publishReleaseAction(releaseId),
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({ message: result.error, color: 'red' });
      }
      setStatus('published');
      notifications.show({
        message: tCommon('messages.itemPublished', { item: tCommon('entities.release') }),
        color: 'green',
      });
    },
  });

  const unpublishRelease = useMutation({
    mutationFn: () => unpublishReleaseAction(releaseId),
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({ message: result.error, color: 'red' });
        return;
      }
      setStatus('draft');
      notifications.show({
        message: tCommon('messages.itemUnpublished', { item: tCommon('entities.release') }),
        color: 'yellow',
      });
    },
  });

  const deleteRelease = useMutation({
    mutationFn: () => deleteReleaseAction(releaseId),
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({ message: result.error, color: 'red' });
        return;
      }
      notifications.show({
        message: tCommon('messages.itemDeleted', { item: tCommon('entities.release') }),
        color: 'red',
      });
      router.push('/admin/releases');
    },
  });
  const updateSlug = useMutation({
    mutationFn: (nextSlug: string | null) => updateReleaseSlugAction(releaseId, nextSlug),
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({ message: result.error, color: 'red' });
      }
    },
  });
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
        setSlug(toNullableSlug(value));
      }
    },
    onSave: (nextSlug) => {
      if (canEditNeutral) {
        return updateSlug.mutateAsync(toNullableSlug(nextSlug));
      }
    },
  });

  // Convert string date to Date object for DateInput
  const releaseDateValue = fields.releaseDate ? new Date(fields.releaseDate) : null;

  // Helper to convert DateInput value to ISO string
  const handleReleaseDateChange = (val: DateValue) => {
    if (!val) {
      setField('releaseDate', null);
      return;
    }
    // Ensure val is a Date object before calling toISOString
    const dateValue = val instanceof Date ? val : new Date(val);
    setField('releaseDate', dateValue.toISOString().split('T')[0]);
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
      debouncedLocaleMetadataUpdate({ locale: roomLocale, title: value });
    },
    [activeEditLocale.canEditActiveLocale, debouncedLocaleMetadataUpdate, roomLocale],
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
        });
        return next;
      });
    },
    [currentIsSynced, currentLocaleCanEdit, debouncedLocaleMetadataUpdate, roomLocale],
  );

  return (
    <EditorRuntimeProvider
      provider={currentProvider}
      entityType="release"
      entityId={releaseId}
      blockRoomProtocol={protocol}
    >
      <Stack>
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
          onBack={() => router.back()}
          onStatusChange={canEditNeutral ? handleStatusChange : undefined}
          onDelete={canEditNeutral ? () => deleteRelease.mutate() : undefined}
          deleteConfirmation={{
            title: tActions('delete'),
            message: (
              <Text>
                {tCommon.rich('messages.confirmDeleteNamedRich', {
                  name: displayedTitle || t('titleFallback'),
                  strong: (chunks) => <strong>{chunks}</strong>,
                })}
              </Text>
            ),
          }}
          isStatusChanging={publishRelease.isPending || unpublishRelease.isPending}
          isDeleting={deleteRelease.isPending}
          groupStatusWithCollab
          controls={<EditorActiveLocaleControl state={activeEditLocale} />}
        />

        <UrlSection
          baseUrl={baseUrl}
          entityType="release"
          entityId={releaseId}
          slug={toSlugInputValue(slug)}
          idPrefix={`release-${releaseId}`}
          error={slugMgmt.error}
          saving={slugMgmt.isChecking || updateSlug.isPending}
          disabled={!canEditNeutral}
          onChange={slugMgmt.handleChange}
          onBlur={slugMgmt.handleBlur}
        />

        {/* Basic Info */}
        <SectionCard withBorder>
          <Stack>
            <Text size="sm" fw={500}>
              {t('sections.basicInformation')}
            </Text>

            <Group align="flex-start">
              {canEditNeutral ? (
                <ReleaseArtworkUploader
                  releaseId={releaseId}
                  artworkUrl={fields.artworkUrl}
                  inputId={`release-${releaseId}-artwork`}
                  onArtworkChange={(url) => setField('artworkUrl', url)}
                />
              ) : null}
              <Stack style={{ flex: 1 }} gap="sm">
                <TextInput
                  id={`release-${releaseId}-title`}
                  label={tCommon('labels.title')}
                  value={displayedTitle}
                  onChange={(e) => handleScopedLocaleTitleChange(e.currentTarget.value)}
                  disabled={!canEditLocalizedTitle}
                  required
                />
                {canEditNeutral ? (
                  <SimpleGrid cols={2}>
                    <Select
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
                      id={`release-${releaseId}-release-date`}
                      label={tCommon('labels.releaseDate')}
                      value={releaseDateValue}
                      onChange={handleReleaseDateChange}
                      clearable
                    />
                  </SimpleGrid>
                ) : null}
              </Stack>
            </Group>

            <Stack gap="xs">
              <Text size="sm" fw={500}>
                {tCommon('labels.description')}
              </Text>
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
                    <Text size="sm" c="dimmed">
                      {tStates('loading')}
                    </Text>
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
                <Text size="sm" c="dimmed">
                  {tStates('loading')}
                </Text>
              )}
            </Stack>
          </Stack>
        </SectionCard>

        {/* Streaming Links */}
        {canEditNeutral ? (
          <SectionCard withBorder>
            <Stack>
              <Text size="sm" fw={500}>
                {t('sections.streamingLinks')}
              </Text>
              <SimpleGrid cols={2}>
                <TextInput
                  id={`release-${releaseId}-spotify-url`}
                  label="Spotify"
                  placeholder="https://open.spotify.com/..."
                  value={fields.spotifyUrl}
                  onChange={(e) => setField('spotifyUrl', e.currentTarget.value)}
                />
                <TextInput
                  id={`release-${releaseId}-apple-music-url`}
                  label="Apple Music"
                  placeholder="https://music.apple.com/..."
                  value={fields.appleMusicUrl}
                  onChange={(e) => setField('appleMusicUrl', e.currentTarget.value)}
                />
                <TextInput
                  id={`release-${releaseId}-bandcamp-url`}
                  label="Bandcamp"
                  placeholder="https://....bandcamp.com/..."
                  value={fields.bandcampUrl}
                  onChange={(e) => setField('bandcampUrl', e.currentTarget.value)}
                />
                <TextInput
                  id={`release-${releaseId}-youtube-music-url`}
                  label="YouTube Music"
                  placeholder="https://music.youtube.com/..."
                  value={fields.youtubeMusicUrl}
                  onChange={(e) => setField('youtubeMusicUrl', e.currentTarget.value)}
                />
              </SimpleGrid>
            </Stack>
          </SectionCard>
        ) : null}

        {canEditNeutral ? (
          <ReleaseArtistsSection
            releaseId={releaseId}
            idPrefix={`release-${releaseId}-artists`}
            artists={fields.artists}
            onArtistsChange={(artists) => setField('artists', artists)}
          />
        ) : null}

        {/* Labels */}
        {canEditNeutral ? (
          <ReleaseLabelsSection
            releaseId={releaseId}
            idPrefix={`release-${releaseId}-labels`}
            labels={fields.labels}
            onLabelsChange={(labels) => setField('labels', labels)}
          />
        ) : null}

        {/* Genres, Styles, Formats */}
        {canEditNeutral ? (
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
          />
        ) : null}

        {/* Credits */}
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
        />

        {/* Tracks */}
        {canEditNeutral ? (
          <ReleaseTracksSection
            releaseId={releaseId}
            idPrefix={`release-${releaseId}-tracks`}
            tracks={fields.tracks}
            onTracksChange={(tracks) => setField('tracks', tracks)}
          />
        ) : null}

        {canEditNeutral ? <ShareLinkSection entityType="release" entityId={releaseId} /> : null}

        <EntityTranslationsPanel
          entityType="release"
          entityId={releaseId}
          canManage={canEditNeutral || activeEditLocale.canEditActiveLocale}
          canAdministerTranslations={canEditNeutral && activeEditLocale.isSourceLocaleReady}
          canMutateTargets={canEditTranslationSource}
        />
      </Stack>
    </EditorRuntimeProvider>
  );
}
