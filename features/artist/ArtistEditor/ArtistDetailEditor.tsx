'use client';

import { AuthoringExtension } from '@/features/authoring/AuthoringExtensionsContext';
import { Text as DsText } from '@/components/core/Typography';
import { LayoutStack as DsLayoutStack, LayoutGrid as DsLayoutGrid } from '@/components/core/Layout';

import { unwrapQueryResult } from '@/lib/api/query-result';

import { QueryErrorAlert } from '@/features/application-error/QueryErrorAlert';

import { type ReactElement, useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { IconUsers } from '@tabler/icons-react';
import { ArtistAction } from '@echovisionlab/geul-proto/secure/artist_pb.ts';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';

import { notifications } from '@/components/core/Notification';
import { EditorHeader, type StatusOption } from '@/features/editor/EditorHeader';
import { EditorPermissionRevokedDialog } from '@/features/editor/EditorPermissionRevokedDialog';
import { EditorSessionExpiredDialog } from '@/features/editor/EditorSessionExpiredDialog';
import { useEditorPermissionRevocation } from '@/features/editor/useEditorPermissionRevocation';
import { CountryCodeSelect } from '@/features/location/CountryCodeSelect';
import { MultiSelect, TextInput } from '@/components/core/Input';
import { InputValidationGlyph } from '@/components/core/Input/InputGlyphs';
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
  type BlockRoomDocumentMetadataPatch,
  updateBlockRoomDocumentMetadata,
  updateBlockRoomLocaleMetadata,
} from '@/lib/collab/block-room-metadata';
import { useRichTextBlockRoomController } from '@/features/editor/hooks/useBlockRoomTiptapController';
import { useBlockRoomConnection } from '@/lib/collab/useBlockRoomConnection';
import { useSlugManagement } from '@/lib/hooks/useSlugManagement';
import { useOgGenerationLookupSignal } from '@/lib/hooks/useOgGenerationLookupSignal';
import { useOgImage } from '@/lib/hooks/useOgImage';
import { useBlockRoomMetadataUpdates } from '@/lib/editor/useBlockRoomMetadataUpdates';
import { flushEditorSavesOrNotify } from '@/lib/editor/flush-editor-saves-or-notify';
import { buildLoginRedirectHref } from '@/lib/auth/login-page';
import { listLabelsForSelector } from '@/lib/queries/label-browser';
import type { SocialLinks } from '@/lib/types/common/social-links';
import { useDebouncedRoomMetadata } from '@/lib/editor/useDebouncedRoomMetadata';

type AdminArtistData = NonNullable<Awaited<ReturnType<typeof getArtistAdminAction>>>;
type ArtistEditorStatus = 'draft' | 'published';

interface ArtistDetailEditorProps {
  id: string;
  artist: AdminArtistData;
  baseUrl: string;
}

function useArtistDetailEditorViewModel({ id, artist, baseUrl }: ArtistDetailEditorProps) {
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
  const labelsQuery = useQuery({
    queryKey: ['labels', 'list'],
    queryFn: listLabelsForSelector,
  });
  const { data: labels } = labelsQuery;
  const parentArtistOptionsQuery = useQuery({
    queryKey: ['artists', id, 'parent-options'],
    queryFn: () => listArtistParentOptionsAction(id).then(unwrapQueryResult),
  });
  const { data: parentArtistOptions = [] } = parentArtistOptionsQuery;

  const publishArtist = useMutation({
    mutationFn: () => publishArtistAction(id),
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({ message: result.error, tone: 'danger' });
        return;
      }
      setField('status', 'published');
      notifications.show({
        message: tCommon('messages.itemPublished', { item: tCommon('entities.artist') }),
        tone: 'positive',
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
  const { provider, doc, bootstrap, protocol, isConnected, isSynced } = blockRoom;
  const blockRoomController = useRichTextBlockRoomController('artist', doc, roomLocale);
  const permissionRevocation = useEditorPermissionRevocation(provider, 'artist', id);
  const canMutate = allowedActions.has(ArtistAction.EDIT) && !permissionRevocation.blocked;
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
        notifications.show({ message: result.error, tone: 'danger' });
        return;
      }
      notifications.show({ message: tCommon('notifications.ogGenerationRequested'), tone: 'neutral' });
      ogImage.trackRequestedGeneration(result.generationId, request.targetKey);
    },
  });
  const bioEditorKey = `artist-${roomLocale ?? 'source'}`;
  const [residentName, setResidentName] = useState(artist.name);
  useLayoutEffect(() => {
    setResidentName(activeEditLocale.displayTitle);
  }, [activeEditLocale.displayTitle, roomLocale]);

  const debouncedLocaleMetadataUpdate = useDebouncedRoomMetadata({
    connection: blockRoom,
    document: `artist:${id}`,
    delay: 500,
    write: (protocol, input: { locale: string; title: string }) =>
      updateBlockRoomLocaleMetadata(protocol, { type: 'artist', ...input }),
  });
  const debouncedDocumentMetadataUpdate = useDebouncedRoomMetadata({
    connection: blockRoom,
    document: `artist:${id}`,
    delay: 500,
    operation: 'document',
    write: (protocol, input: BlockRoomDocumentMetadataPatch<'artist'>) =>
      updateBlockRoomDocumentMetadata(protocol, { type: 'artist', ...input }),
  });
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
          debouncedDocumentMetadataUpdate({
            socialLinks: value as Record<string, string>,
            observed: { socialLinks: fields.socialLinks },
          });
          return;
        case 'slug':
          debouncedDocumentMetadataUpdate({ slug: String(value) || null });
          return;
        case 'labelIds':
          debouncedDocumentMetadataUpdate({
            labelIds: value as string[],
            observed: { labelIds: fields.labelIds },
          });
          return;
        case 'parentArtistId':
          debouncedDocumentMetadataUpdate({ parentArtistId: value ? String(value) : null });
      }
    },
    [canEditNeutral, debouncedDocumentMetadataUpdate, fields],
  );

  useBlockRoomMetadataUpdates(blockRoom, `artist:${id}`, (update) => {
    if (update.operation === 'locale') {
      if (roomLocale && typeof update.values.title === 'string') {
        setResidentName(update.values.title);
      }
      return;
    }
    if (update.operation !== 'document') {
      return;
    }

    const values = update.values;
    const socialLinks = values.socialLinks;
    const nextSocialLinks =
      socialLinks &&
      typeof socialLinks === 'object' &&
      !Array.isArray(socialLinks) &&
      Object.values(socialLinks).every((value) => typeof value === 'string')
        ? (socialLinks as Record<string, string>)
        : null;
    if (nextSocialLinks) {
      setLocalSocialLinks(nextSocialLinks);
    }
    setFields((current) => {
      let next = current;
      const assign = <K extends keyof typeof current>(key: K, value: (typeof current)[K]) => {
        if (next === current) {
          next = { ...current };
        }
        next[key] = value;
      };
      for (const key of ['realName', 'countryCode', 'website', 'slug'] as const) {
        const value = values[key];
        if (typeof value === 'string' || value === null) {
          assign(key, value ?? '');
        }
      }
      const parentArtistId = values.parentArtistId;
      if (typeof parentArtistId === 'string' || parentArtistId === null) {
        assign('parentArtistId', parentArtistId);
      }
      if (nextSocialLinks) {
        assign('socialLinks', nextSocialLinks);
      }
      const labelIds = values.labelIds;
      if (Array.isArray(labelIds) && labelIds.every((value) => typeof value === 'string')) {
        assign('labelIds', labelIds as string[]);
      }
      return next;
    });
  });

  const unpublishArtist = useMutation({
    mutationFn: () => unpublishArtistAction(id),
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({ message: result.error, tone: 'danger' });
        return;
      }
      setField('status', 'draft');
      notifications.show({
        message: tCommon('messages.itemUnpublished', { item: tCommon('entities.artist') }),
        tone: 'positive',
      });
    },
  });

  const [flushingCommand, setFlushingCommand] = useState<'back' | 'status' | 'delete' | null>(null);
  const flushPendingSaves = useCallback(
    async (command: 'back' | 'status' | 'delete' = 'back') => {
      setFlushingCommand(command);
      try {
        return await flushEditorSavesOrNotify(`artist:${id}`, tCommon('notifications.saveFailed'));
      } finally {
        setFlushingCommand(null);
      }
    },
    [id, tCommon],
  );
  const handleBack = useCallback(async () => {
    if (await flushPendingSaves()) {
      router.back();
    }
  }, [flushPendingSaves, router]);
  const handleDelete = useCallback(async () => {
    if (await flushPendingSaves('delete')) {
      setDeleteDialogOpened(true);
    }
  }, [flushPendingSaves]);

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
      if (canEditNeutral) {
        slugMgmt.updateFromTitle(value);
      }
      debouncedLocaleMetadataUpdate({ locale: roomLocale, title: value });
    },
    [
      canEditNeutral,
      slugMgmt.updateFromTitle,
      activeEditLocale.canEditActiveLocale,
      canMutate,
      debouncedLocaleMetadataUpdate,
      roomLocale,
    ],
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
    async (nextStatus: ArtistEditorStatus) => {
      if (!canEditNeutral) {
        return;
      }
      if (!(await flushPendingSaves('status'))) {
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
    [canEditNeutral, canPublish, canUnpublish, flushPendingSaves, publishArtist, unpublishArtist],
  );

  const slugError = slugMgmt.error;

  if (activeEditLocale.isLoading || (roomLocale && (!provider || !doc))) {
    return <PageLoader placement="flow" />;
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

    isReady: Boolean(doc),
  });
  const editorSession =
    currentProvider && blockRoomController ? { provider: currentProvider, controller: blockRoomController } : null;
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

  return {
    currentProvider,
    id,
    protocol,
    labelsQuery: {
      isError: labelsQuery.isError,
      error: labelsQuery.error,
      isFetching: labelsQuery.isFetching,
      refetch: async () => {
        await labelsQuery.refetch();
      },
      data: labelsQuery.data,
      isLoading: labelsQuery.isLoading,
    },
    parentArtistOptionsQuery: {
      isError: parentArtistOptionsQuery.isError,
      error: parentArtistOptionsQuery.error,
      isFetching: parentArtistOptionsQuery.isFetching,
      refetch: async () => {
        await parentArtistOptionsQuery.refetch();
      },
      data: parentArtistOptionsQuery.data,
      isLoading: parentArtistOptionsQuery.isLoading,
    },
    displayedName,
    canEditLocalizedName,
    handleScopedLocaleNameChange,
    tCommon,
    currentIsConnected,
    currentIsSynced,
    normalizedStatus,
    artistStatusOptions,
    handleBack,
    canEditNeutral,
    canPublish,
    canUnpublish,
    handleStatusChange,
    canDelete,
    deletePreparationPending: flushingCommand === 'delete',
    handleDelete,
    publishArtist: { isPending: publishArtist.isPending || flushingCommand === 'status' },
    unpublishArtist: { isPending: unpublishArtist.isPending || flushingCommand === 'status' },
    activeEditLocale,
    canManageParticipants,
    t,
    setAssignUsersModalOpened,
    ogImage: {
      src: ogImage.src,
      isRegenerating: ogImage.isRegenerating,
      status: ogImage.status,
      error: ogImage.error,
      targetKey: ogImage.targetKey,
    },
    canMutate,
    regenerateOgImage: { isPending: regenerateOgImage.isPending, mutate: regenerateOgImage.mutate },
    artist: { images: artist.images, imageRevision: artist.imageRevision },
    baseUrl,
    fields: {
      slug: fields.slug,
      realName: fields.realName,
      countryCode: fields.countryCode,
      website: fields.website,
      labelIds: fields.labelIds,
      parentArtistId: fields.parentArtistId,
    },
    slugMgmt: { isAvailable: slugMgmt.isAvailable, isChecking: slugMgmt.isChecking, handleBlur: slugMgmt.handleBlur },
    slugError,
    handleSlugChange,
    setField,
    isEditingScopedLocale,
    hasScopedLocaleLiveRow,
    localizedBioSession,
    bioEditorKey,
    currentLocaleCanEdit,
    editorSession,
    labelOptions,
    handleLabelsChange,
    parentArtistOptions,
    localSocialLinks,
    handleSocialLinksChange,
    canManageShareLinks,
    assignUsersModalOpened,
    canRemoveOwner,
    deleteDialogOpened,
    setDeleteDialogOpened,
    router: { replace: router.replace, refresh: router.refresh },
    permissionRevocation: {
      revoked: permissionRevocation.revoked,
      sessionExpired: permissionRevocation.sessionExpired,
    },
  };
}

export function ArtistDetailEditor(props: ArtistDetailEditorProps) {
  const model = useArtistDetailEditorViewModel(props);
  return 'currentProvider' in model ? <ArtistDetailEditorView model={model} /> : model;
}

export type ArtistDetailEditorViewModel = Exclude<ReturnType<typeof useArtistDetailEditorViewModel>, ReactElement>;

/** Complete production editor composition; controllers supply data and commands. */
export function ArtistDetailEditorView({ model }: { model: ArtistDetailEditorViewModel }) {
  const {
    currentProvider,
    id,
    protocol,
    labelsQuery,
    parentArtistOptionsQuery,
    displayedName,
    canEditLocalizedName,
    handleScopedLocaleNameChange,
    tCommon,
    currentIsConnected,
    currentIsSynced,
    normalizedStatus,
    artistStatusOptions,
    handleBack,
    canEditNeutral,
    canPublish,
    canUnpublish,
    handleStatusChange,
    canDelete,
    deletePreparationPending,
    handleDelete,
    publishArtist,
    unpublishArtist,
    activeEditLocale,
    canManageParticipants,
    t,
    setAssignUsersModalOpened,
    ogImage,
    canMutate,
    regenerateOgImage,
    artist,
    baseUrl,
    fields,
    slugMgmt,
    slugError,
    handleSlugChange,
    setField,
    isEditingScopedLocale,
    hasScopedLocaleLiveRow,
    localizedBioSession,
    bioEditorKey,
    currentLocaleCanEdit,
    editorSession,
    labelOptions,
    handleLabelsChange,
    parentArtistOptions,
    localSocialLinks,
    handleSocialLinksChange,
    canManageShareLinks,
    assignUsersModalOpened,
    canRemoveOwner,
    deleteDialogOpened,
    setDeleteDialogOpened,
    router,
    permissionRevocation,
  } = model;
  return (
    <EditorRuntimeProvider provider={currentProvider} entityType="artist" entityId={id} blockRoomProtocol={protocol}>
      <DsLayoutStack>
        <QueryErrorAlert
          queries={[
            labelsQuery,
            parentArtistOptionsQuery,
            ...(activeEditLocale.errorQuery ? [activeEditLocale.errorQuery] : []),
          ]}
        />
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
          onBack={handleBack}
          backTooltip={tCommon('actions.back')}
          onStatusChange={canEditNeutral && (canPublish || canUnpublish) ? handleStatusChange : undefined}
          onDelete={canEditNeutral && canDelete ? handleDelete : undefined}
          isDeleting={deletePreparationPending}
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

        <DsLayoutStack gap="md">
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
            <AuthoringExtension kind="uploads">
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
            </AuthoringExtension>
          ) : null}

          <UrlSection
            baseUrl={baseUrl}
            entityType="artist"
            entityId={id}
            slug={fields.slug}
            isAvailable={slugMgmt.isAvailable}
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

          <DsLayoutStack gap="xs">
            <DsText size="sm" weight="medium">
              {tCommon('labels.bio')}
            </DsText>
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
                  <PageLoader placement="flow" />
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
              <PageLoader placement="flow" />
            )}
          </DsLayoutStack>

          <DsLayoutGrid columns={2}>
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
          </DsLayoutGrid>

          <MultiSelect
            id={`artist-${id}-label-ids`}
            label={tCommon('entities.labels')}
            placeholder={t('placeholders.labels')}
            aria-busy={labelsQuery.isFetching || undefined}
            rightSection={labelsQuery.isFetching ? <InputValidationGlyph status="checking" /> : undefined}
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
              loading={parentArtistOptionsQuery.isFetching}
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
            <AuthoringExtension kind="sharing">
              <ShareLinkSection entityType="artist" entityId={id} disabled={!canEditNeutral || !canManageShareLinks} />
            </AuthoringExtension>
          )}
        </DsLayoutStack>

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

        <AuthoringExtension kind="translations">
          <EntityTranslationsPanel entityType="artist" entityId={id} canManage={canMutate} />
        </AuthoringExtension>

        <EditorPermissionRevokedDialog opened={permissionRevocation.revoked} onConfirm={() => router.replace('/')} />
        <EditorSessionExpiredDialog
          opened={permissionRevocation.sessionExpired}
          onConfirm={() => window.location.assign(buildLoginRedirectHref(getCurrentPath()))}
        />
      </DsLayoutStack>
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
