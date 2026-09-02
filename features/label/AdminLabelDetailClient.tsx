'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { IconUsers } from '@tabler/icons-react';
import { LabelAction } from '@echovisionlab/geul-proto/secure/label_pb.ts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Group, SimpleGrid, Stack, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useDebouncedCallback } from '@mantine/hooks';
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
import { publishLabelAction, unpublishLabelAction } from '@/lib/actions/label';
import { buildLoginRedirectHref } from '@/lib/auth/login-page';
import { EditorRuntimeProvider } from '@/lib/contexts/EditorRuntimeContext';
import {
  BlockRoomMetadataError,
  updateBlockRoomDocumentMetadata,
  updateBlockRoomLocaleMetadata,
} from '@/lib/collab/block-room-metadata';
import { useRichTextBlockRoomController } from '@/features/editor/hooks/useBlockRoomTiptapController';
import { useBlockRoomConnection } from '@/lib/collab/useBlockRoomConnection';
import { useSlugManagement } from '@/lib/hooks/useSlugManagement';
import { normalizeEnumToken } from '@/lib/i18n/admin-labels';
import type { getLabelAdmin } from '@/lib/queries/label';
import { listLabelsForSelector } from '@/lib/queries/label-browser';
import { parseSocialLinks } from '@/lib/types/common/social-links';
import type { LabelStatus } from '@/lib/types/label/model';

type AdminLabelData = NonNullable<Awaited<ReturnType<typeof getLabelAdmin>>>;

interface AdminLabelDetailClientProps {
  id: string;
  label: AdminLabelData;
  baseUrl: string;
  backHref?: string;
}

export function AdminLabelDetailClient({
  id,
  label,
  baseUrl,
  backHref = '/admin/labels',
}: AdminLabelDetailClientProps) {
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
  const { provider, doc, bootstrap, protocol, isConnected, isSynced, acceptEpochAck, reloadCanonical } = blockRoom;
  const blockRoomController = useRichTextBlockRoomController('label', doc, roomLocale);
  const permissionRevocation = useEditorPermissionRevocation(provider, 'label', id);
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
  const descriptionEditorKey = `label-${roomLocale ?? 'source'}`;
  const [residentName, setResidentName] = useState(label.name);
  useEffect(() => setResidentName(activeEditLocale.displayTitle), [activeEditLocale.displayTitle, roomLocale]);
  const updateLocaleMetadata = useMutation({
    mutationFn: (input: { locale: string; title: string }) => {
      if (!bootstrap || !protocol) {
        throw new Error('Label Block room is not ready.');
      }
      return updateBlockRoomLocaleMetadata(protocol, { type: 'label', ...input });
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
      input: Omit<Extract<Parameters<typeof updateBlockRoomDocumentMetadata>[1], { type: 'label' }>, 'type'>,
    ) => {
      if (!bootstrap || !protocol) {
        throw new Error('Label Block room is not ready.');
      }
      return updateBlockRoomDocumentMetadata(protocol, { type: 'label', ...input });
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
    (input: Omit<Extract<Parameters<typeof updateBlockRoomDocumentMetadata>[1], { type: 'label' }>, 'type'>) =>
      updateDocumentMetadata.mutate(input),
    500,
  );
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
          debouncedDocumentMetadataUpdate({ socialLinks: value as Record<string, string> });
          return;
        case 'parentLabelId':
          debouncedDocumentMetadataUpdate({ parentLabelId: value ? String(value) : null });
      }
    },
    [canEditNeutral, debouncedDocumentMetadataUpdate],
  );

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
      debouncedLocaleMetadataUpdate({ locale: roomLocale, title: value });
    },
    [activeEditLocale.canEditActiveLocale, canMutate, debouncedLocaleMetadataUpdate, roomLocale],
  );

  const { data: labelsForParent } = useQuery({
    queryKey: ['labels', 'list'],
    queryFn: listLabelsForSelector,
  });

  const publishLabel = useMutation({
    mutationFn: (labelId: string) => publishLabelAction(labelId),
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({ message: result.error, color: 'red' });
        return;
      }
      notifications.show({
        message: tCommon('messages.itemPublished', { item: tCommon('entities.label') }),
        color: 'green',
      });
      setCurrentStatus('published');
      queryClient.invalidateQueries({ queryKey: ['labels'] });
    },
  });

  const unpublishLabel = useMutation({
    mutationFn: (labelId: string) => unpublishLabelAction(labelId),
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({ message: result.error, color: 'red' });
        return;
      }
      notifications.show({
        message: tCommon('messages.itemUnpublished', { item: tCommon('entities.label') }),
        color: 'yellow',
      });
      setCurrentStatus('draft');
      queryClient.invalidateQueries({ queryKey: ['labels'] });
    },
  });

  const handleStatusChange = (status: LabelStatus) => {
    if (!canEditNeutral) {
      return;
    }
    if (status === 'published') {
      publishLabel.mutate(id);
      return;
    }

    unpublishLabel.mutate(id);
  };

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
  });
  const editorSession =
    currentProvider && blockRoomController && currentIsSynced
      ? { provider: currentProvider, controller: blockRoomController }
      : null;
  const localizedDescriptionSession = editorSession;
  const displayedName = roomLocale ? residentName : activeEditLocale.displayTitle;
  if (activeEditLocale.isLoading || (roomLocale && (!provider || !doc || !isSynced))) {
    return <PageLoader />;
  }

  return (
    <EditorRuntimeProvider provider={currentProvider} entityType="label" entityId={id} blockRoomProtocol={protocol}>
      <Stack>
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
          onBack={() => router.push(backHref)}
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

        <Stack gap="md">
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
            idPrefix={`label-${id}`}
            error={slugMgmt.error}
            saving={slugMgmt.isChecking}
            disabled={!canEditNeutral}
            onChange={slugMgmt.handleChange}
          />

          <Stack gap="xs">
            <Text size="sm" fw={500}>
              {tCommon('labels.description')}
            </Text>
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
              <Text size="sm" c="dimmed">
                {tCommon('states.loading')}
              </Text>
            )}
          </Stack>

          <SimpleGrid cols={2}>
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
          </SimpleGrid>

          <Select
            id={`label-${id}-parent-label-id`}
            label={t('fields.parentLabel')}
            placeholder={t('placeholders.parentLabel')}
            data={parentLabelOptions}
            value={fields.parentLabelId}
            onChange={(value) => setField('parentLabelId', value)}
            clearable
            searchable
            disabled={!canEditNeutral}
          />

          <SocialLinksEditor
            idPrefix={`label-${id}-social-links`}
            value={fields.socialLinks}
            onChange={(value) => setField('socialLinks', value)}
            disabled={!canEditNeutral}
          />
          {canManageShareLinks ? (
            <ShareLinkSection entityType="label" entityId={id} disabled={!canEditNeutral} />
          ) : null}
          <Group justify="flex-end" mt="md">
            <Button tone="neutral" emphasis="low" onClick={() => router.push(backHref)}>
              {tCommon('actions.cancel')}
            </Button>
          </Group>
        </Stack>

        <LabelParticipantsDialog
          labelId={id}
          opened={participantsOpened}
          onClose={() => setParticipantsOpened(false)}
          canManageParticipants={canEditNeutral && canManageParticipants}
          canRemoveOwner={canEditNeutral && canRemoveOwner}
        />

        {canMutate ? <EntityTranslationsPanel entityType="label" entityId={id} /> : null}

        <EditorPermissionRevokedDialog
          opened={permissionRevocation.revoked}
          onConfirm={() => router.replace(currentStatus === 'published' ? `/labels/${label.slug || id}` : '/')}
        />
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
