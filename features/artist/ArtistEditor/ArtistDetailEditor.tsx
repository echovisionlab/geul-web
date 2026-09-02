'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { IconUsers } from '@tabler/icons-react';
import { ArtistAction } from '@echovisionlab/geul-proto/secure/artist_pb.ts';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { SimpleGrid, Stack, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useDebouncedCallback } from '@mantine/hooks';
import { EditorHeader, type StatusOption } from '@/features/editor/EditorHeader';
import { EditorPermissionRevokedDialog } from '@/features/editor/EditorPermissionRevokedDialog';
import { EditorSessionExpiredDialog } from '@/features/editor/EditorSessionExpiredDialog';
import { useEditorPermissionRevocation } from '@/features/editor/useEditorPermissionRevocation';
import { CountryCodeSelect } from '@/features/location/CountryCodeSelect';
import { MultiSelect, TextInput } from '@/components/core/Input';
import { PageLoader } from '@/features/site/PageLoader';
import { SocialLinksEditor } from '@/features/social-links/SocialLinksEditor';
import { UrlSection } from '@/features/metadata/UrlSection';
import { ArtistParticipantsDialog } from '@/features/artist/ArtistEditor/ArtistParticipantsDialog';
import { ArtistDeleteDialog } from '@/features/artist/ArtistDeleteDialog';
import { ArtistParentSelect } from '@/features/artist/ArtistEditor/ArtistParentSelect';
import { ArtistBioEditor } from '@/features/artist/ArtistEditor/ArtistBioEditor';
import { ArtistImageGalleryEditor } from '@/features/artist/ArtistEditor/ArtistImageGalleryEditor';
import { OgImagePreview } from '@/features/metadata/OgImagePreview';
import { ShareLinkSection } from '@/features/share/ShareLinkSection';
import { ActiveEditLocaleContentPreview } from '@/features/translation/ActiveEditLocaleContentPreview';
import { EditorActiveLocaleControl } from '@/features/translation/EditorActiveLocaleControl';
import { EntityTranslationsPanel } from '@/features/translation/EntityTranslationsPanel';
import { isLocaleDocumentEditable } from '@/features/translation/locale-document-mode';
import { useLocaleDocumentSession } from '@/features/translation/useLocaleDocumentSession';
import {
  listArtistParentOptionsAction,
  publishArtistAction,
  regenerateArtistOgImageAction,
  unpublishArtistAction,
  type getArtistAdminAction,
} from '@/lib/actions/artist';
import { EditorRuntimeProvider } from '@/lib/contexts/EditorRuntimeContext';
import {
  BlockRoomMetadataError,
  updateBlockRoomDocumentMetadata,
  updateBlockRoomLocaleMetadata,
} from '@/lib/collab/block-room-metadata';
import { useRichTextBlockRoomController } from '@/features/editor/hooks/useBlockRoomTiptapController';
import { useBlockRoomConnection } from '@/lib/collab/useBlockRoomConnection';
import { useSlugManagement } from '@/lib/hooks/useSlugManagement';
import { useOgGenerationLookupSignal } from '@/lib/hooks/useOgGenerationLookupSignal';
import { useOgImage } from '@/lib/hooks/useOgImage';
import { buildLoginRedirectHref } from '@/lib/auth/login-page';
import { listLabelsForSelector } from '@/lib/queries/label-browser';
import type { SocialLinks } from '@/lib/types/common/social-links';

type AdminArtistData = NonNullable<Awaited<ReturnType<typeof getArtistAdminAction>>>;
type ArtistEditorStatus = 'draft' | 'published';

interface ArtistDetailEditorProps {
  id: string;
  artist: AdminArtistData;
  baseUrl: string;
}

export function ArtistDetailEditor({ id, artist, baseUrl }: ArtistDetailEditorProps) {
  const router = useRouter();
  const t = useTranslations('artistAdminDetail');
  const tCommon = useTranslations('common');
  const tActions = useTranslations('common.actions');
  const tStatuses = useTranslations('common.statuses');
  const [assignUsersModalOpened, setAssignUsersModalOpened] = useState(false);
  const [deleteDialogOpened, setDeleteDialogOpened] = useState(false);
  const [localSocialLinks, setLocalSocialLinks] = useState<SocialLinks>({});
  const allowedActions = new Set(artist.allowedActions);
  const canPublish = allowedActions.has(ArtistAction.PUBLISH);
  const canUnpublish = allowedActions.has(ArtistAction.UNPUBLISH);
  const canManageShareLinks = allowedActions.has(ArtistAction.MANAGE_SHARE_LINKS);
  const canManageParticipants = allowedActions.has(ArtistAction.MANAGE_PARTICIPANTS);
  const canRemoveOwner = allowedActions.has(ArtistAction.REMOVE_OWNER);
  const canDelete = allowedActions.has(ArtistAction.DELETE);

  const [fields, setFields] = useState({
    status: normalizeArtistStatus(artist.status),
    realName: artist.realName || '',
    countryCode: artist.countryCode || '',
    website: artist.website || '',
    socialLinks: (artist.socialLinks as Record<string, string>) || {},
    slug: artist.slug || '',
    labelIds: artist.labelIds,
    parentArtistId: artist.parentArtistId,
  });
  const { data: labels } = useQuery({
    queryKey: ['labels', 'list'],
    queryFn: listLabelsForSelector,
  });
  const { data: parentArtistOptions = [] } = useQuery({
    queryKey: ['artists', id, 'parent-options'],
    queryFn: () => listArtistParentOptionsAction(id),
  });

  const publishArtist = useMutation({
    mutationFn: () => publishArtistAction(id),
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({ message: result.error, color: 'red' });
        return;
      }
      setField('status', 'published');
      notifications.show({
        message: tCommon('messages.itemPublished', { item: tCommon('entities.artist') }),
        color: 'green',
      });
    },
  });

  const localeSession = useLocaleDocumentSession({
    entityType: 'artist',
    entityId: id,
    sourceTitle: artist.name,
    sourceSummary: '',
  });
  const { activeEditLocale, roomLocale } = localeSession;
  const { isEditingScopedLocale, hasScopedLocaleLiveRow, shouldUseLocaleDocument } = localeSession.mode;
  const blockRoom = useBlockRoomConnection('artist', id, roomLocale);
  const { provider, doc, bootstrap, protocol, isConnected, isSynced, acceptEpochAck, reloadCanonical } = blockRoom;
  const blockRoomController = useRichTextBlockRoomController('artist', doc, roomLocale);
  const permissionRevocation = useEditorPermissionRevocation(provider, 'artist', id);
  const canMutate = !permissionRevocation.blocked;
  const hasLocaleRoomMutationAuthority = localeSession.hasRoomMutationAuthority({
    sourceLocale: bootstrap?.sourceLocale ?? null,
    locale: bootstrap?.locale ?? null,
    localeExists: bootstrap?.localeExists ?? false,
    documentRevision: bootstrap?.documentRevision ?? null,
    targetRevision: bootstrap?.targetRevision,
  });
  const currentLocaleCanEdit = canMutate && activeEditLocale.canEditActiveLocale && hasLocaleRoomMutationAuthority;
  const canEditNeutral = currentLocaleCanEdit && activeEditLocale.isSourceLocale;
  const currentProvider = provider;
  const currentIsConnected = isConnected;
  const currentIsSynced = isSynced;
  const ogImage = useOgImage({
    entityType: 'artist',
    entityId: id,
    initialOgImageUrl: activeEditLocale.isSourceLocale ? artist.ogImageUrl : activeEditLocale.displayOgImageUrl,
    locale: activeEditLocale.hasLiveRow ? activeEditLocale.activeLocale : null,
    provider: currentProvider,
  });
  useOgGenerationLookupSignal(activeEditLocale.ogGenerationRun, activeEditLocale.activeLocale, ogImage.trackLatest);
  const regenerateOgImage = useMutation({
    mutationFn: (request: { locale: string; targetKey: string }) => regenerateArtistOgImageAction(id, request.locale),
    onSuccess: (result, request) => {
      if (result.error) {
        notifications.show({ message: result.error, color: 'red' });
        return;
      }
      notifications.show({ message: tCommon('notifications.ogGenerationRequested'), color: 'blue' });
      ogImage.trackRequestedGeneration(result.generationId, request.targetKey);
    },
  });
  const bioEditorKey = `artist-${roomLocale ?? 'source'}`;
  const [residentName, setResidentName] = useState(artist.name);
  useEffect(() => {
    setResidentName(activeEditLocale.displayTitle);
  }, [activeEditLocale.displayTitle, roomLocale]);
  const updateLocaleMetadata = useMutation({
    mutationFn: (input: { locale: string; title: string }) => {
      if (!bootstrap || !protocol) {
        throw new Error('Artist Block room is not ready.');
      }
      return updateBlockRoomLocaleMetadata(protocol, { type: 'artist', ...input });
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
  const updateDocumentMetadata = useMutation({
    mutationFn: (
      input: Omit<Extract<Parameters<typeof updateBlockRoomDocumentMetadata>[1], { type: 'artist' }>, 'type'>,
    ) => {
      if (!bootstrap || !protocol) {
        throw new Error('Artist Block room is not ready.');
      }
      return updateBlockRoomDocumentMetadata(protocol, { type: 'artist', ...input });
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
  const debouncedLocaleMetadataUpdate = useDebouncedCallback(
    (input: { locale: string; title: string }) => updateLocaleMetadata.mutate(input),
    500,
  );
  const debouncedDocumentMetadataUpdate = useDebouncedCallback(
    (input: Omit<Extract<Parameters<typeof updateBlockRoomDocumentMetadata>[1], { type: 'artist' }>, 'type'>) =>
      updateDocumentMetadata.mutate(input),
    500,
  );
  const setField = useCallback(
    <K extends keyof typeof fields>(key: K, value: (typeof fields)[K]) => {
      if (key !== 'status' && !canEditNeutral) {
        return;
      }
      setFields((current) => ({ ...current, [key]: value }));
      switch (key) {
        case 'status':
          return;
        case 'realName':
          debouncedDocumentMetadataUpdate({ realName: String(value) || null });
          return;
        case 'countryCode':
          debouncedDocumentMetadataUpdate({ countryCode: String(value) || null });
          return;
        case 'website':
          debouncedDocumentMetadataUpdate({ website: String(value) || null });
          return;
        case 'socialLinks':
          debouncedDocumentMetadataUpdate({ socialLinks: value as Record<string, string> });
          return;
        case 'slug':
          debouncedDocumentMetadataUpdate({ slug: String(value) || null });
          return;
        case 'labelIds':
          debouncedDocumentMetadataUpdate({ labelIds: value as string[] });
          return;
        case 'parentArtistId':
          debouncedDocumentMetadataUpdate({ parentArtistId: value ? String(value) : null });
      }
    },
    [canEditNeutral, debouncedDocumentMetadataUpdate],
  );

  const unpublishArtist = useMutation({
    mutationFn: () => unpublishArtistAction(id),
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({ message: result.error, color: 'red' });
        return;
      }
      setField('status', 'draft');
      notifications.show({
        message: tCommon('messages.itemUnpublished', { item: tCommon('entities.artist') }),
        color: 'yellow',
      });
    },
  });

  const slugMgmt = useSlugManagement({
    entityType: 'artist',
    entityId: id,
    slug: fields.slug || '',
    onSlugChange: (val) => setField('slug', val),
  });

  // Sync social links from collaboration
  useEffect(() => {
    if (fields.socialLinks && Object.keys(fields.socialLinks).length > 0) {
      setLocalSocialLinks(fields.socialLinks);
    }
  }, [fields.socialLinks]);

  const handleScopedLocaleNameChange = useCallback(
    (value: string) => {
      if (!canMutate || !activeEditLocale.canEditActiveLocale) {
        return;
      }
      if (!roomLocale) {
        return;
      }
      setResidentName(value);
      debouncedLocaleMetadataUpdate({ locale: roomLocale, title: value });
    },
    [activeEditLocale.canEditActiveLocale, canMutate, debouncedLocaleMetadataUpdate, roomLocale],
  );

  const handleSlugChange = useCallback(
    (value: string) => {
      slugMgmt.handleChange(value);
    },
    [slugMgmt],
  );

  const handleSocialLinksChange = (links: SocialLinks) => {
    if (!canEditNeutral) {
      return;
    }
    setLocalSocialLinks(links);
    setField('socialLinks', links);
  };

  const handleLabelsChange = (newLabelIds: string[]) => {
    if (canEditNeutral) {
      setField('labelIds', newLabelIds);
    }
  };

  const handleStatusChange = useCallback(
    (nextStatus: ArtistEditorStatus) => {
      if (!canEditNeutral) {
        return;
      }
      if (nextStatus === 'published' && canPublish) {
        publishArtist.mutate();
        return;
      }

      if (nextStatus === 'draft' && canUnpublish) {
        unpublishArtist.mutate();
      }
    },
    [canEditNeutral, canPublish, canUnpublish, publishArtist, unpublishArtist],
  );

  const slugError = slugMgmt.error;

  if (activeEditLocale.isLoading || (roomLocale && (!isSynced || !provider || !doc))) {
    return <PageLoader />;
  }

  const labelOptions =
    labels?.map((l) => ({
      value: l.id,
      label: l.name,
    })) || [];

  const normalizedStatus = normalizeArtistStatus(fields.status);
  const canEditLocalizedName = isLocaleDocumentEditable({
    activeLocale: activeEditLocale.activeLocale,
    shouldUseLocaleDocument,
    canEditActiveLocale: currentLocaleCanEdit,
    isSynced: currentIsSynced,
  });
  const editorSession =
    currentProvider && blockRoomController && currentIsSynced
      ? { provider: currentProvider, controller: blockRoomController }
      : null;
  const localizedBioSession = editorSession;
  const displayedName = roomLocale ? residentName : activeEditLocale.displayTitle;
  const artistStatusOptions: StatusOption<ArtistEditorStatus>[] = [
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

  return (
    <EditorRuntimeProvider provider={currentProvider} entityType="artist" entityId={id} blockRoomProtocol={protocol}>
      <Stack>
        <EditorHeader
          title={displayedName}
          onTitleChange={canEditLocalizedName ? handleScopedLocaleNameChange : undefined}
          titleInputId={`artist-${id}-header-title`}
          titlePlaceholder={tCommon('states.untitledEntity', { entity: tCommon('entities.artist') })}
          titleDisabled={!canEditLocalizedName}
          isConnected={currentIsConnected}
          isSynced={currentIsSynced}
          status={normalizedStatus}
          statusOptions={artistStatusOptions}
          onBack={() => router.back()}
          backTooltip={tCommon('actions.back')}
          onStatusChange={canEditNeutral && (canPublish || canUnpublish) ? handleStatusChange : undefined}
          onDelete={canEditNeutral && canDelete ? () => setDeleteDialogOpened(true) : undefined}
          isStatusChanging={publishArtist.isPending || unpublishArtist.isPending}
          groupStatusWithCollab
          controls={<EditorActiveLocaleControl state={activeEditLocale} />}
          actionItems={
            canEditNeutral && canManageParticipants
              ? [
                  {
                    key: 'assign-users',
                    label: t('actions.assignUsers'),
                    tooltip: t('actions.assignUsers'),
                    ariaLabel: t('actions.assignUsers'),
                    icon: <IconUsers size={20} />,
                    iconOnly: true,
                    onClick: () => setAssignUsersModalOpened(true),
                  },
                ]
              : undefined
          }
        />

        <Stack gap="md">
          <OgImagePreview
            src={ogImage.src}
            canRegenerate={canMutate && activeEditLocale.hasLiveRow && Boolean(activeEditLocale.activeLocale)}
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

          {canEditNeutral ? (
            <ArtistImageGalleryEditor
              artistId={id}
              artistName={displayedName}
              inputId={`artist-${id}-image`}
              initialImages={artist.images}
              initialRevision={artist.imageRevision}
              labels={{
                image: tCommon('labels.image'),
                gallery: t('gallery.title'),
                makePrimary: t('gallery.makePrimary'),
                moveEarlier: t('gallery.moveEarlier'),
                moveLater: t('gallery.moveLater'),
                remove: tCommon('actions.remove'),
                updateFailed: tCommon('messages.failedToLoad'),
              }}
            />
          ) : null}

          <UrlSection
            baseUrl={baseUrl}
            entityType="artist"
            entityId={id}
            slug={fields.slug}
            idPrefix={`artist-${id}`}
            error={slugError}
            saving={slugMgmt.isChecking}
            disabled={!canEditNeutral}
            onChange={handleSlugChange}
            onBlur={slugMgmt.handleBlur}
            inputProps={{ placeholder: t('placeholders.slug') }}
          />

          <TextInput
            id={`artist-${id}-name`}
            label={tCommon('labels.name')}
            placeholder={t('placeholders.name')}
            value={displayedName}
            onChange={(e) => handleScopedLocaleNameChange(e.currentTarget.value)}
            disabled={!canEditLocalizedName}
            required
          />

          <TextInput
            id={`artist-${id}-real-name`}
            label={tCommon('labels.realName')}
            placeholder={t('placeholders.realName')}
            value={fields.realName}
            onChange={(e) => setField('realName', e.currentTarget.value)}
            disabled={!canEditNeutral}
          />

          <Stack gap="xs">
            <Text size="sm" fw={500}>
              {tCommon('labels.bio')}
            </Text>
            {isEditingScopedLocale && activeEditLocale.activeLocaleLabel ? (
              hasScopedLocaleLiveRow ? (
                localizedBioSession ? (
                  <ArtistBioEditor
                    key={bioEditorKey}
                    id={`artist-${id}-bio-${activeEditLocale.activeLocale ?? 'translation'}`}
                    artistId={id}
                    provider={localizedBioSession.provider}
                    blockRoomController={localizedBioSession.controller}
                    disabled={!currentLocaleCanEdit}
                    structureLocked
                  />
                ) : (
                  <Text size="sm" c="dimmed">
                    {tCommon('states.loading')}
                  </Text>
                )
              ) : (
                <ActiveEditLocaleContentPreview
                  localeLabel={activeEditLocale.activeLocaleLabel}
                  hasLiveRow={false}
                  contentPreview=""
                  loading={activeEditLocale.contentPreviewLoading}
                >
                  {localizedBioSession ? (
                    <ArtistBioEditor
                      key={`${bioEditorKey}-source-fallback`}
                      id={`artist-${id}-bio-source-fallback`}
                      artistId={id}
                      provider={localizedBioSession.provider}
                      blockRoomController={localizedBioSession.controller}
                      disabled
                      structureLocked
                    />
                  ) : null}
                </ActiveEditLocaleContentPreview>
              )
            ) : editorSession ? (
              <ArtistBioEditor
                key={bioEditorKey}
                id={`artist-${id}-bio`}
                artistId={id}
                provider={editorSession.provider}
                blockRoomController={editorSession.controller}
                disabled={!currentLocaleCanEdit}
                structureLocked={false}
              />
            ) : (
              <Text size="sm" c="dimmed">
                {tCommon('states.loading')}
              </Text>
            )}
          </Stack>

          <SimpleGrid cols={2}>
            <CountryCodeSelect
              id={`artist-${id}-country-code`}
              label={tCommon('labels.country')}
              placeholder={tCommon('placeholders.search')}
              value={fields.countryCode}
              onChange={(value) => setField('countryCode', value)}
              disabled={!canEditNeutral}
            />
            <TextInput
              id={`artist-${id}-website`}
              label={tCommon('labels.website')}
              placeholder={tCommon('placeholders.website')}
              value={fields.website}
              onChange={(e) => setField('website', e.currentTarget.value)}
              disabled={!canEditNeutral}
            />
          </SimpleGrid>

          <MultiSelect
            id={`artist-${id}-label-ids`}
            label={tCommon('entities.labels')}
            placeholder={t('placeholders.labels')}
            data={labelOptions}
            value={fields.labelIds}
            onChange={handleLabelsChange}
            searchable
            clearable
            disabled={!canEditNeutral}
            description={t('descriptions.labels')}
          />

          {activeEditLocale.isSourceLocale ? (
            <ArtistParentSelect
              id={`artist-${id}-parent`}
              label={t('relations.parentArtist')}
              placeholder={t('placeholders.parentArtist')}
              options={parentArtistOptions}
              value={fields.parentArtistId}
              onChange={(value) => setField('parentArtistId', value)}
            />
          ) : null}

          <SocialLinksEditor
            idPrefix={`artist-${id}-social-links`}
            value={localSocialLinks}
            onChange={handleSocialLinksChange}
            disabled={!canEditNeutral}
          />

          {canManageShareLinks && (
            <ShareLinkSection entityType="artist" entityId={id} disabled={!canEditNeutral || !canManageShareLinks} />
          )}
        </Stack>

        <ArtistParticipantsDialog
          artistId={id}
          opened={assignUsersModalOpened}
          onClose={() => setAssignUsersModalOpened(false)}
          canManageParticipants={canEditNeutral && canManageParticipants}
          canRemoveOwner={canEditNeutral && canRemoveOwner}
        />

        <ArtistDeleteDialog
          artist={canEditNeutral && deleteDialogOpened ? { id, name: displayedName } : null}
          onClose={() => setDeleteDialogOpened(false)}
          onDeleted={() => {
            setDeleteDialogOpened(false);
            router.replace('/my/artists');
            router.refresh();
          }}
        />

        <EntityTranslationsPanel entityType="artist" entityId={id} canManage={canMutate} />

        <EditorPermissionRevokedDialog opened={permissionRevocation.revoked} onConfirm={() => router.replace('/')} />
        <EditorSessionExpiredDialog
          opened={permissionRevocation.sessionExpired}
          onConfirm={() => window.location.assign(buildLoginRedirectHref(getCurrentPath()))}
        />
      </Stack>
    </EditorRuntimeProvider>
  );
}

function getCurrentPath(): string {
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

function normalizeArtistStatus(status: string | null | undefined): ArtistEditorStatus {
  switch (status) {
    case 'published':
    case 'draft':
      return status;
    case 'ARTIST_STATUS_PUBLISHED':
      return 'published';
    case 'ARTIST_STATUS_DRAFT':
    default:
      return 'draft';
  }
}
