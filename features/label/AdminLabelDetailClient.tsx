'use client';

import { AuthoringExtension } from '@/features/authoring/AuthoringExtensionsContext';
import { Text as DsText } from '@/components/core/Typography';

import {
  LayoutStack as DsLayoutStack,
  LayoutGrid as DsLayoutGrid,
  LayoutInline as DsLayoutInline,
  LayoutInset as DsLayoutInset,
} from '@/components/core/Layout';

import { QueryErrorAlert } from '@/features/application-error/QueryErrorAlert';

import { type ReactElement, useCallback, useLayoutEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { IconUsers } from '@tabler/icons-react';
import { LabelAction } from '@echovisionlab/geul-proto/secure/label_pb.ts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';

import { notifications } from '@/components/core/Notification';
import { Button } from '@/components/core/Button';
import { EditorHeader, type StatusOption } from '@/features/editor/EditorHeader';
import { EditorPermissionRevokedDialog } from '@/features/editor/EditorPermissionRevokedDialog';
import { EditorSessionExpiredDialog } from '@/features/editor/EditorSessionExpiredDialog';
import { useEditorPermissionRevocation } from '@/features/editor/useEditorPermissionRevocation';
import { CountryCodeSelect } from '@/features/location/CountryCodeSelect';
import { Select, TextInput } from '@/components/core/Input';
import { PageLoader } from '@/features/site/PageLoader';
import { SocialLinksEditor } from '@/features/social-links/SocialLinksEditor';
import { UrlSection } from '@/features/metadata/UrlSection';
import { LabelDescriptionEditor } from '@/features/label/LabelEditor/LabelDescriptionEditor';
import { LabelParticipantsDialog } from '@/features/label/LabelEditor/LabelParticipantsDialog';
import { LabelLogoUploader } from '@/features/label/LabelLogoUploader';
import { ShareLinkSection } from '@/features/share/ShareLinkSection';
import { ActiveEditLocaleContentPreview } from '@/features/translation/ActiveEditLocaleContentPreview';
import { EditorActiveLocaleMenu } from '@/features/translation/EditorActiveLocaleMenu';
import { EntityTranslationsPanel } from '@/features/translation/EntityTranslationsPanel';
import { isLocaleDocumentEditable } from '@/features/translation/locale-document-mode';
import { useLocaleDocumentSession } from '@/features/translation/useLocaleDocumentSession';
import { publishLabelAction, setLabelParentAction, unpublishLabelAction } from '@/lib/actions/label';
import { buildLoginRedirectHref } from '@/lib/auth/login-page';
import { EditorRuntimeProvider } from '@/lib/contexts/EditorRuntimeContext';
import {
  type BlockRoomDocumentMetadataPatch,
  updateBlockRoomDocumentMetadata,
  updateBlockRoomLocaleMetadata,
} from '@/lib/collab/block-room-metadata';
import { useRichTextBlockRoomController } from '@/features/editor/hooks/useBlockRoomTiptapController';
import { useBlockRoomConnection } from '@/lib/collab/useBlockRoomConnection';
import { useSlugManagement } from '@/lib/hooks/useSlugManagement';
import { useBlockRoomMetadataUpdates } from '@/lib/editor/useBlockRoomMetadataUpdates';
import { flushEditorSavesOrNotify } from '@/lib/editor/flush-editor-saves-or-notify';
import { normalizeEnumToken } from '@/lib/i18n/admin-labels';
import type { getLabelAdmin } from '@/lib/queries/label';
import { listLabelsForSelector } from '@/lib/queries/label-browser';
import { parseSocialLinks } from '@/lib/types/common/social-links';
import type { LabelStatus } from '@/lib/types/label/model';
import { useDebouncedRoomMetadata } from '@/lib/editor/useDebouncedRoomMetadata';

type AdminLabelData = NonNullable<Awaited<ReturnType<typeof getLabelAdmin>>>;

interface AdminLabelDetailClientProps {
  id: string;
  label: AdminLabelData;
  baseUrl: string;
  backHref?: string;
}

function useLabelEditorViewModel({ id, label, baseUrl, backHref = '/admin/labels' }: AdminLabelDetailClientProps) {
  const router = useRouter();
  const t = useTranslations('labelAdminDetail');
  const tCommon = useTranslations('common');
  const tActions = useTranslations('common.actions');
  const tStatuses = useTranslations('common.statuses');
  const queryClient = useQueryClient();
  const [participantsOpened, setParticipantsOpened] = useState(false);
  const [currentStatus, setCurrentStatus] = useState<LabelStatus>(
    (normalizeEnumToken(label.status) as LabelStatus) || 'draft',
  );
  const [logoImages, setLogoImages] = useState({
    light: label.imageLightUrl ?? null,
    dark: label.imageDarkUrl ?? null,
  });
  const allowedActions = new Set(label.allowedActions);
  const canPublish = allowedActions.has(LabelAction.PUBLISH);
  const canUnpublish = allowedActions.has(LabelAction.UNPUBLISH);
  const canManageShareLinks = allowedActions.has(LabelAction.MANAGE_SHARE_LINKS);
  const canManageParticipants = allowedActions.has(LabelAction.MANAGE_PARTICIPANTS);
  const canRemoveOwner = allowedActions.has(LabelAction.REMOVE_OWNER);

  const [fields, setFields] = useState({
    slug: label.slug || '',
    countryCode: label.countryCode || '',
    website: label.website || '',
    socialLinks: parseSocialLinks(label.socialLinks),
    parentLabelId: label.parentLabelId || null,
  });
  const localeSession = useLocaleDocumentSession({
    entityType: 'label',
    entityId: id,
    sourceTitle: label.name,
    sourceSummary: '',
  });
  const { activeEditLocale, roomLocale } = localeSession;
  const { isEditingScopedLocale, hasScopedLocaleLiveRow, shouldUseLocaleDocument } = localeSession.mode;
  const blockRoom = useBlockRoomConnection('label', id, roomLocale);
  const { provider, doc, bootstrap, protocol, isConnected, isSynced } = blockRoom;
  const blockRoomController = useRichTextBlockRoomController('label', doc, roomLocale);
  const permissionRevocation = useEditorPermissionRevocation(provider, 'label', id);
  const canMutate = allowedActions.has(LabelAction.EDIT) && !permissionRevocation.blocked;
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
  const descriptionEditorKey = `label-${roomLocale ?? 'source'}`;
  const [residentName, setResidentName] = useState(label.name);
  useLayoutEffect(() => setResidentName(activeEditLocale.displayTitle), [activeEditLocale.displayTitle, roomLocale]);

  const debouncedLocaleMetadataUpdate = useDebouncedRoomMetadata({
    connection: blockRoom,
    document: `label:${id}`,
    delay: 500,
    write: (protocol, input: { locale: string; title: string }) =>
      updateBlockRoomLocaleMetadata(protocol, { type: 'label', ...input }),
  });
  const debouncedDocumentMetadataUpdate = useDebouncedRoomMetadata({
    connection: blockRoom,
    document: `label:${id}`,
    delay: 500,
    operation: 'document',
    write: (protocol, input: BlockRoomDocumentMetadataPatch<'label'>) =>
      updateBlockRoomDocumentMetadata(protocol, { type: 'label', ...input }),
  });
  const setField = useCallback(
    <K extends keyof typeof fields>(key: K, value: (typeof fields)[K]) => {
      if (!canEditNeutral) {
        return;
      }
      setFields((current) => ({ ...current, [key]: value }));
      switch (key) {
        case 'slug':
          debouncedDocumentMetadataUpdate({ slug: String(value) || null });
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
      }
    },
    [canEditNeutral, debouncedDocumentMetadataUpdate, fields],
  );

  useBlockRoomMetadataUpdates(blockRoom, `label:${id}`, (update) => {
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
    setFields((current) => {
      let next = current;
      const assign = <K extends keyof typeof current>(key: K, value: (typeof current)[K]) => {
        if (next === current) {
          next = { ...current };
        }
        next[key] = value;
      };
      for (const key of ['slug', 'countryCode', 'website'] as const) {
        const value = values[key];
        if (typeof value === 'string' || value === null) {
          assign(key, value ?? '');
        }
      }
      if (nextSocialLinks) {
        assign('socialLinks', nextSocialLinks);
      }
      return next;
    });
  });

  const slugMgmt = useSlugManagement({
    entityType: 'label',
    entityId: id,
    slug: fields.slug || '',
    onSlugChange: (val) => setField('slug', val),
  });

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

  const labelsForParentQuery = useQuery({
    queryKey: ['labels', 'list'],
    queryFn: listLabelsForSelector,
  });
  const { data: labelsForParent } = labelsForParentQuery;

  const canChangeParent = canEditNeutral && canManageParticipants;

  const saveParent = useMutation({
    mutationFn: ({ next }: { next: string | null; previous: string | null }) => setLabelParentAction(id, next),
    onSuccess: (result, { previous }) => {
      if (result.error) {
        setFields((current) => ({ ...current, parentLabelId: previous }));
        notifications.show({ message: result.error, tone: 'danger' });
      }
    },
  });

  const handleParentChange = (next: string | null) => {
    if (canChangeParent) {
      setFields((current) => ({ ...current, parentLabelId: next }));
      saveParent.mutate({ next, previous: fields.parentLabelId });
    }
  };

  const publishLabel = useMutation({
    mutationFn: (labelId: string) => publishLabelAction(labelId),
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({ message: result.error, tone: 'danger' });
        return;
      }
      notifications.show({
        message: tCommon('messages.itemPublished', { item: tCommon('entities.label') }),
        tone: 'positive',
      });
      setCurrentStatus('published');
      queryClient.invalidateQueries({ queryKey: ['labels'] });
    },
  });

  const unpublishLabel = useMutation({
    mutationFn: (labelId: string) => unpublishLabelAction(labelId),
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({ message: result.error, tone: 'danger' });
        return;
      }
      notifications.show({
        message: tCommon('messages.itemUnpublished', { item: tCommon('entities.label') }),
        tone: 'positive',
      });
      setCurrentStatus('draft');
      queryClient.invalidateQueries({ queryKey: ['labels'] });
    },
  });

  const [flushingCommand, setFlushingCommand] = useState<'back' | 'status' | 'delete' | null>(null);
  const flushPendingSaves = useCallback(
    async (command: 'back' | 'status' | 'delete' = 'back') => {
      setFlushingCommand(command);
      try {
        return await flushEditorSavesOrNotify(`label:${id}`, tCommon('notifications.saveFailed'));
      } finally {
        setFlushingCommand(null);
      }
    },
    [id, tCommon],
  );
  const handleBack = useCallback(async () => {
    if (await flushPendingSaves()) {
      router.push(backHref);
    }
  }, [backHref, flushPendingSaves, router]);
  const handleStatusChange = useCallback(
    async (status: LabelStatus) => {
      if (!canEditNeutral || !(await flushPendingSaves('status'))) {
        return;
      }
      if (status === 'published') {
        publishLabel.mutate(id);
        return;
      }

      unpublishLabel.mutate(id);
    },
    [canEditNeutral, flushPendingSaves, id, publishLabel.mutate, unpublishLabel.mutate],
  );

  const labelStatusOptions: StatusOption<LabelStatus>[] = [
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

  const handleImageChange = (variant: 'light' | 'dark', url: string | null) => {
    if (!canEditNeutral) {
      return;
    }
    setLogoImages((current) => ({ ...current, [variant]: url }));
  };

  const parentLabelOptions =
    labelsForParent
      ?.filter((entry) => entry.id !== id)
      .map((entry) => ({
        value: entry.id,
        label: entry.name,
      })) || [];

  const canEditLocalizedName = isLocaleDocumentEditable({
    activeLocale: activeEditLocale.activeLocale,
    shouldUseLocaleDocument,
    canEditActiveLocale: currentLocaleCanEdit,
    isSynced: currentIsSynced,

    isReady: Boolean(doc),
  });
  const editorSession =
    currentProvider && blockRoomController ? { provider: currentProvider, controller: blockRoomController } : null;
  const localizedDescriptionSession = editorSession;
  const displayedName = roomLocale ? residentName : activeEditLocale.displayTitle;
  if (activeEditLocale.isLoading || (roomLocale && (!provider || !doc))) {
    return <PageLoader placement="flow" />;
  }

  return {
    currentProvider,
    id,
    protocol,
    labelsForParentQuery: {
      isError: labelsForParentQuery.isError,
      error: labelsForParentQuery.error,
      isFetching: labelsForParentQuery.isFetching,
      refetch: async () => {
        await labelsForParentQuery.refetch();
      },
    },
    displayedName,
    canEditLocalizedName,
    handleScopedLocaleNameChange,
    tCommon,
    currentStatus,
    labelStatusOptions,
    currentIsConnected,
    currentIsSynced,
    handleBack,
    canEditNeutral,
    canPublish,
    canUnpublish,
    handleStatusChange,
    publishLabel: { isPending: publishLabel.isPending || flushingCommand === 'status' },
    unpublishLabel: { isPending: unpublishLabel.isPending || flushingCommand === 'status' },
    t,
    activeEditLocale: {
      isControlVisible: activeEditLocale.isControlVisible,
      activeLocale: activeEditLocale.activeLocale,
      activeLocaleLabel: activeEditLocale.activeLocaleLabel,
      sourceLocale: activeEditLocale.sourceLocale,
      localeOptions: activeEditLocale.localeOptions,
      setActiveLocale: activeEditLocale.setActiveLocale,
      isLoading: activeEditLocale.isLoading,
      contentPreviewLoading: activeEditLocale.contentPreviewLoading,
    },
    canMutate,
    canManageParticipants,
    setParticipantsOpened,
    logoImages: { light: logoImages.light, dark: logoImages.dark },
    handleImageChange,
    handleParentChange,
    canChangeParent,
    baseUrl,
    fields: {
      slug: fields.slug,
      countryCode: fields.countryCode,
      website: fields.website,
      parentLabelId: fields.parentLabelId,
      socialLinks: fields.socialLinks,
    },
    slugMgmt: {
      isAvailable: slugMgmt.isAvailable,
      error: slugMgmt.error,
      isChecking: slugMgmt.isChecking,
      handleChange: slugMgmt.handleChange,
    },
    isEditingScopedLocale,
    hasScopedLocaleLiveRow,
    localizedDescriptionSession,
    descriptionEditorKey,
    currentLocaleCanEdit,
    editorSession,
    setField,
    parentLabelOptions,
    canManageShareLinks,
    participantsOpened,
    canRemoveOwner,
    permissionRevocation: {
      revoked: permissionRevocation.revoked,
      sessionExpired: permissionRevocation.sessionExpired,
    },
    router: { replace: router.replace },
    label: { slug: label.slug },
  };
}

export function AdminLabelDetailClient(props: AdminLabelDetailClientProps) {
  const model = useLabelEditorViewModel(props);
  return 'currentProvider' in model ? <LabelEditorView model={model} /> : model;
}

export type LabelEditorViewModel = Exclude<ReturnType<typeof useLabelEditorViewModel>, ReactElement>;

/** Complete production editor composition; controllers supply data and commands. */
export function LabelEditorView({ model }: { model: LabelEditorViewModel }) {
  const {
    currentProvider,
    id,
    protocol,
    labelsForParentQuery,
    displayedName,
    canEditLocalizedName,
    handleScopedLocaleNameChange,
    tCommon,
    currentStatus,
    labelStatusOptions,
    currentIsConnected,
    currentIsSynced,
    handleBack,
    canEditNeutral,
    canPublish,
    canUnpublish,
    handleStatusChange,
    publishLabel,
    unpublishLabel,
    t,
    activeEditLocale,
    canMutate,
    canManageParticipants,
    setParticipantsOpened,
    logoImages,
    handleImageChange,
    handleParentChange,
    canChangeParent,
    baseUrl,
    fields,
    slugMgmt,
    isEditingScopedLocale,
    hasScopedLocaleLiveRow,
    localizedDescriptionSession,
    descriptionEditorKey,
    currentLocaleCanEdit,
    editorSession,
    setField,
    parentLabelOptions,
    canManageShareLinks,
    participantsOpened,
    canRemoveOwner,
    permissionRevocation,
    router,
    label,
  } = model;
  return (
    <EditorRuntimeProvider provider={currentProvider} entityType="label" entityId={id} blockRoomProtocol={protocol}>
      <DsLayoutStack>
        <QueryErrorAlert queries={[labelsForParentQuery]} />
        <EditorHeader
          title={displayedName}
          onTitleChange={canEditLocalizedName ? handleScopedLocaleNameChange : undefined}
          titleInputId={`label-${id}-header-title`}
          titlePlaceholder={tCommon('states.untitledEntity', { entity: tCommon('entities.label') })}
          titleDisabled={!canEditLocalizedName}
          status={currentStatus}
          statusOptions={labelStatusOptions}
          isConnected={currentIsConnected}
          isSynced={currentIsSynced}
          onBack={handleBack}
          onStatusChange={canEditNeutral && (canPublish || canUnpublish) ? handleStatusChange : undefined}
          isStatusChanging={publishLabel.isPending || unpublishLabel.isPending}
          backTooltip={t('actions.backToLabels')}
          controls={
            activeEditLocale.isControlVisible ? (
              <EditorActiveLocaleMenu
                activeLocale={activeEditLocale.activeLocale}
                activeLocaleLabel={activeEditLocale.activeLocaleLabel}
                sourceLocale={activeEditLocale.sourceLocale}
                localeOptions={activeEditLocale.localeOptions}
                onChange={activeEditLocale.setActiveLocale}
                disabled={!canMutate || activeEditLocale.isLoading}
              />
            ) : null
          }
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
                    onClick: () => setParticipantsOpened(true),
                  },
                ]
              : undefined
          }
        />

        <DsLayoutStack gap="md">
          <DsLayoutGrid columns={{ base: 1, sm: 2 }} columnGap="lg" rowGap="lg">
            <AuthoringExtension kind="uploads">
              <LabelLogoUploader
                labelId={id}
                currentImage={logoImages.light}
                variant="light"
                name={displayedName}
                inputId={`label-${id}-image`}
                size={100}
                label={tCommon('labels.logoLight')}
                disabled={!canEditNeutral}
                onImageChange={(url) => handleImageChange('light', url)}
              />
            </AuthoringExtension>

            <AuthoringExtension kind="uploads">
              <LabelLogoUploader
                labelId={id}
                currentImage={logoImages.dark}
                variant="dark"
                name={displayedName}
                inputId={`label-${id}-image-dark`}
                size={100}
                label={tCommon('labels.logoDark')}
                disabled={!canEditNeutral}
                onImageChange={(url) => handleImageChange('dark', url)}
              />
            </AuthoringExtension>
          </DsLayoutGrid>

          <TextInput
            id={`label-${id}-name`}
            label={tCommon('labels.name')}
            placeholder={t('placeholders.name')}
            value={displayedName}
            onChange={(event) => handleScopedLocaleNameChange(event.currentTarget.value)}
            disabled={!canEditLocalizedName}
            required
          />

          <UrlSection
            baseUrl={baseUrl}
            entityType="label"
            entityId={id}
            slug={fields.slug || ''}
            isAvailable={slugMgmt.isAvailable}
            idPrefix={`label-${id}`}
            error={slugMgmt.error}
            saving={slugMgmt.isChecking}
            disabled={!canEditNeutral}
            onChange={slugMgmt.handleChange}
          />

          <DsLayoutStack gap="xs">
            <DsText size="sm" weight="medium">
              {tCommon('labels.description')}
            </DsText>
            {isEditingScopedLocale && activeEditLocale.activeLocaleLabel ? (
              hasScopedLocaleLiveRow ? (
                localizedDescriptionSession ? (
                  <LabelDescriptionEditor
                    key={descriptionEditorKey}
                    id={`label-${id}-description-${activeEditLocale.activeLocale ?? 'translation'}`}
                    labelId={id}
                    provider={localizedDescriptionSession.provider}
                    blockRoomController={localizedDescriptionSession.controller}
                    disabled={!canMutate || !currentLocaleCanEdit}
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
                    <LabelDescriptionEditor
                      key={`${descriptionEditorKey}-source-fallback`}
                      id={`label-${id}-description-source-fallback`}
                      labelId={id}
                      provider={localizedDescriptionSession.provider}
                      blockRoomController={localizedDescriptionSession.controller}
                      disabled
                      structureLocked
                    />
                  ) : null}
                </ActiveEditLocaleContentPreview>
              )
            ) : editorSession ? (
              <LabelDescriptionEditor
                key={descriptionEditorKey}
                id={`label-${id}-description`}
                labelId={id}
                provider={editorSession.provider}
                blockRoomController={editorSession.controller}
                disabled={!canMutate || !currentLocaleCanEdit}
                structureLocked={false}
              />
            ) : (
              <PageLoader placement="flow" />
            )}
          </DsLayoutStack>

          <DsLayoutGrid columns={2}>
            <CountryCodeSelect
              id={`label-${id}-country-code`}
              label={tCommon('labels.country')}
              placeholder={tCommon('placeholders.search')}
              value={fields.countryCode}
              onChange={(value) => setField('countryCode', value)}
              disabled={!canEditNeutral}
            />
            <TextInput
              id={`label-${id}-website`}
              label={tCommon('labels.website')}
              placeholder={tCommon('placeholders.website')}
              value={fields.website}
              onChange={(event) => setField('website', event.currentTarget.value)}
              disabled={!canEditNeutral}
            />
          </DsLayoutGrid>

          <Select
            id={`label-${id}-parent-label-id`}
            label={t('fields.parentLabel')}
            placeholder={t('placeholders.parentLabel')}
            isLoading={labelsForParentQuery.isFetching}
            data={parentLabelOptions}
            value={fields.parentLabelId}
            onChange={handleParentChange}
            clearable
            searchable
            disabled={!canChangeParent}
          />

          <SocialLinksEditor
            idPrefix={`label-${id}-social-links`}
            value={fields.socialLinks}
            onChange={(value) => setField('socialLinks', value)}
            disabled={!canEditNeutral}
          />
          {canManageShareLinks ? (
            <AuthoringExtension kind="sharing">
              <ShareLinkSection entityType="label" entityId={id} disabled={!canEditNeutral} />
            </AuthoringExtension>
          ) : null}
          <DsLayoutInset blockStart="md">
            <DsLayoutInline justify="end">
              <Button tone="neutral" emphasis="low" onClick={handleBack}>
                {tCommon('actions.cancel')}
              </Button>
            </DsLayoutInline>
          </DsLayoutInset>
        </DsLayoutStack>

        <LabelParticipantsDialog
          labelId={id}
          opened={participantsOpened}
          onClose={() => setParticipantsOpened(false)}
          canManageParticipants={canEditNeutral && canManageParticipants}
          canRemoveOwner={canEditNeutral && canRemoveOwner}
        />

        {canMutate ? (
          <AuthoringExtension kind="translations">
            <EntityTranslationsPanel entityType="label" entityId={id} />
          </AuthoringExtension>
        ) : null}

        <EditorPermissionRevokedDialog
          opened={permissionRevocation.revoked}
          onConfirm={() => router.replace(currentStatus === 'published' ? `/labels/${label.slug || id}` : '/')}
        />
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
