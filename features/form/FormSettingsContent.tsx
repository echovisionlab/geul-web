'use client';

import { useCallback, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Divider, Group, Stack, Text, Title } from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import { MultiSelect, NumberInput, PasswordInput, Switch } from '@/components/core/Input';
import { MediaPreviewGrid } from '@/components/core/MediaPreviewGrid';
import { SectionCard } from '@/components/core/Section';
import { OgImagePreview } from '@/features/metadata/OgImagePreview';
import { UrlSection } from '@/features/metadata/UrlSection';
import { ShareLinkSection } from '@/features/share/ShareLinkSection';
import { ImageUploadCropController } from '@/features/upload/ImageUploadCropController';
import {
  regenerateFormOgImageAction,
  removeFormFeaturedImageAction,
  setFormFeaturedImageAction,
  updateFormAction,
  type UpdateFormInput,
} from '@/lib/actions/form';
import { getUploadSelectionMimeTypes, UPLOAD_CONFIGS } from '@/lib/constants/upload-config';
import { useFormEditorContext } from '@/lib/contexts/FormEditorContext';
import { useFormTranslationContext } from '@/features/form/FormTranslationContext';
import { useOgGenerationLookupSignal } from '@/lib/hooks/useOgGenerationLookupSignal';
import { useOgImage } from '@/lib/hooks/useOgImage';
import { useSlugManagement } from '@/lib/hooks/useSlugManagement';
import { useUpload } from '@/lib/hooks/useUpload';
import type { UserRole } from '@/lib/types/user/model';
import { UploadType } from '@/lib/types/upload/model';

interface FormSettingsContentProps {
  formId: string;
  baseUrl: string;
  initialSlug: string;
  initialIsPublic: boolean;
  initialOpensAt: string | null;
  initialClosesAt: string | null;
  initialMaxSubmissions: number | null;
  initialRequireAuth: boolean;
  initialAllowedRoles: UserRole[];
  initialAllowDuplicateSubmission: boolean;
  initialOgImageUrl: string | null;
  initialFeaturedImageUrl: string | null;
  initialHasPassword: boolean;
}

const formFeaturedImageConfig = UPLOAD_CONFIGS[UploadType.FORM_FEATURED_IMAGE];

export function FormSettingsContent({
  formId,
  baseUrl,
  initialSlug,
  initialIsPublic,
  initialOpensAt,
  initialClosesAt,
  initialMaxSubmissions,
  initialRequireAuth,
  initialAllowedRoles,
  initialAllowDuplicateSubmission,
  initialOgImageUrl,
  initialFeaturedImageUrl,
  initialHasPassword,
}: FormSettingsContentProps) {
  const t = useTranslations('formAdmin');
  const tCommon = useTranslations('common');
  const tFeaturedImage = useTranslations('featuredImage');
  const tCommonPlaceholders = useTranslations('common.placeholders');
  const tCommonNotifications = useTranslations('common.notifications');
  const { provider, ogGenerationLookup } = useFormEditorContext();
  const { activeEditLocale } = useFormTranslationContext();
  const [slug, setSlug] = useState(initialSlug);
  const [isPublic, setIsPublic] = useState(initialIsPublic);
  const [opensAt, setOpensAt] = useState<Date | null>(initialOpensAt ? new Date(initialOpensAt) : null);
  const [closesAt, setClosesAt] = useState<Date | null>(initialClosesAt ? new Date(initialClosesAt) : null);
  const [maxSubmissions, setMaxSubmissions] = useState<number | null>(initialMaxSubmissions);
  const [requireAuth, setRequireAuth] = useState(initialRequireAuth);
  const [allowedRoles, setAllowedRoles] = useState<UserRole[]>(initialAllowedRoles);
  const [allowDuplicateSubmission, setAllowDuplicateSubmission] = useState(initialAllowDuplicateSubmission);
  const [password, setPassword] = useState('');
  const [passwordDirty, setPasswordDirty] = useState(false);
  const [featuredImageUrl, setFeaturedImageUrl] = useState<string | null>(initialFeaturedImageUrl);
  const [uploadProgress, setUploadProgress] = useState(0);
  const ogImage = useOgImage({
    entityType: 'form',
    entityId: formId,
    initialOgImageUrl: activeEditLocale.isSourceLocale ? initialOgImageUrl : activeEditLocale.displayOgImageUrl,
    locale: activeEditLocale.hasLiveRow ? activeEditLocale.activeLocale : null,
    provider,
  });
  useOgGenerationLookupSignal(activeEditLocale.ogGenerationRun, activeEditLocale.activeLocale, ogImage.trackLatest);
  useOgGenerationLookupSignal(ogGenerationLookup, activeEditLocale.activeLocale, ogImage.trackLatest);
  const { upload, isUploading } = useUpload(UploadType.FORM_FEATURED_IMAGE);

  const saveSettings = useMutation({
    mutationFn: (input: UpdateFormInput) => updateFormAction(formId, input),
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({ message: result.error, color: 'red' });
      }
    },
    onError: (error) => {
      notifications.show({
        message: error instanceof Error ? error.message : tCommonNotifications('updateFailed'),
        color: 'red',
      });
    },
  });

  const slugMgmt = useSlugManagement({
    entityType: 'form',
    entityId: formId,
    slug,
    onSlugChange: setSlug,
    onSave: (nextSlug) => saveSettings.mutateAsync({ slug: nextSlug || null, isPublic: nextSlug ? isPublic : false }),
  });
  const {
    error: slugError,
    handleBlur: handleSlugBlur,
    handleChange: updateSlug,
    isChecking: isSlugChecking,
  } = slugMgmt;

  const handleSlugChange = useCallback(
    (value: string) => {
      updateSlug(value);
      if (!value.trim()) {
        setIsPublic(false);
      }
    },
    [updateSlug],
  );

  const roleOptions: { value: UserRole; label: string }[] = [
    { value: 'admin', label: tCommon('roles.admin') },
    { value: 'author', label: tCommon('roles.author') },
    { value: 'user', label: tCommon('roles.user') },
  ];
  const isUserRole = (value: string): value is UserRole => ['admin', 'author', 'user'].includes(value);

  const setFeaturedImage = useMutation({
    mutationFn: (fileId: string) => setFormFeaturedImageAction(formId, fileId),
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({ message: result.error, color: 'red' });
        return;
      }
      setFeaturedImageUrl(result.imageUrl ?? null);
      if (result.ogGenerationRunId) {
        void ogImage.trackLatest();
      }
      notifications.show({ message: tCommonNotifications('featuredImageUpdated'), color: 'green' });
    },
  });

  const removeFeaturedImage = useMutation({
    mutationFn: () => removeFormFeaturedImageAction(formId),
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({ message: result.error, color: 'red' });
        return;
      }
      setFeaturedImageUrl(null);
      if (result.ogGenerationRunId) {
        void ogImage.trackLatest();
      }
      notifications.show({ message: tCommonNotifications('featuredImageRemoved'), color: 'yellow' });
    },
  });

  const regenerateOgImage = useMutation({
    mutationFn: (request: { locale: string; targetKey: string }) => regenerateFormOgImageAction(formId, request.locale),
    onSuccess: (result, request) => {
      if (result.error) {
        notifications.show({ message: result.error, color: 'red' });
        return;
      }
      ogImage.trackRequestedGeneration(result.generationId, request.targetKey);
      notifications.show({ message: tCommonNotifications('ogGenerationRequested'), color: 'blue' });
    },
  });

  const handleFeaturedImageUpload = async (croppedBlob: Blob) => {
    setUploadProgress(0);
    try {
      const { fileId } = await upload(croppedBlob, {
        entityId: formId,
        fileName: 'featured',
        onProgress: (progress) => setUploadProgress(progress.percentage),
      });
      await setFeaturedImage.mutateAsync(fileId);
    } catch (error) {
      notifications.show({
        message: error instanceof Error ? error.message : tCommonNotifications('uploadFailed'),
        color: 'red',
      });
    } finally {
      setUploadProgress(0);
    }
  };

  return (
    <Stack>
      <SectionCard p="lg">
        <Stack gap="md">
          <Title order={4}>{t('settings.urlPublic.title')}</Title>
          <UrlSection
            baseUrl={baseUrl}
            entityType="form"
            entityId={formId}
            slug={slug}
            error={slugError}
            saving={isSlugChecking || saveSettings.isPending}
            onChange={handleSlugChange}
            onBlur={handleSlugBlur}
          />
          <Group gap="sm">
            <Switch
              checked={isPublic}
              onChange={(event) => {
                const next = event.currentTarget.checked;
                setIsPublic(next);
                saveSettings.mutate({ isPublic: next });
              }}
              label={t('settings.urlPublic.allowPublic')}
              disabled={!slug}
            />
            <Text size="xs" c="dimmed">
              {!slug
                ? t('settings.urlPublic.setSlugFirst')
                : isPublic
                  ? t('settings.urlPublic.directUrlEnabled')
                  : t('settings.urlPublic.embedOnly')}
            </Text>
          </Group>
        </Stack>
      </SectionCard>

      <SectionCard p="lg">
        <Stack gap="md">
          <Title order={4}>{t('settings.media.title')}</Title>
          <MediaPreviewGrid>
            <OgImagePreview
              src={ogImage.src}
              canRegenerate={activeEditLocale.hasLiveRow && Boolean(activeEditLocale.activeLocale)}
              isRegenerating={regenerateOgImage.isPending || ogImage.isRegenerating}
              generationStatus={ogImage.status}
              generationError={ogImage.error}
              onRegenerate={() => {
                if (activeEditLocale.activeLocale) {
                  regenerateOgImage.mutate({ locale: activeEditLocale.activeLocale, targetKey: ogImage.targetKey });
                }
              }}
            />
            <ImageUploadCropController
              imageUrl={featuredImageUrl}
              canEdit
              isUploading={isUploading}
              uploadProgress={uploadProgress}
              isRemoving={removeFeaturedImage.isPending}
              onUpload={handleFeaturedImageUpload}
              onRemove={() => removeFeaturedImage.mutate()}
              label={tFeaturedImage('label')}
              acceptMimeTypes={getUploadSelectionMimeTypes(UploadType.FORM_FEATURED_IMAGE)}
              maxSize={formFeaturedImageConfig.maxSize}
            />
          </MediaPreviewGrid>
        </Stack>
      </SectionCard>

      <ShareLinkSection
        entityType="form"
        entityId={formId}
        title={t('settings.previewLinks.title')}
        description={t('settings.previewLinks.description')}
        disabled={!slug}
      />
      <ShareLinkSection
        entityType="form-dashboard"
        entityId={formId}
        title={t('settings.dashboardLinks.title')}
        description={t('settings.dashboardLinks.description')}
        disabled={!slug}
      />

      <SectionCard p="lg">
        <Stack gap="md">
          <Title order={4}>{t('settings.access.title')}</Title>
          <PasswordInput
            label={t('settings.access.passwordLabel')}
            description={t('settings.access.passwordDescription')}
            placeholder={initialHasPassword ? '••••••••' : tCommonPlaceholders('password')}
            value={password}
            onChange={(event) => {
              setPassword(event.currentTarget.value);
              setPasswordDirty(true);
            }}
            onBlur={() => {
              if (!passwordDirty) {
                return;
              }
              saveSettings.mutate({ password });
              setPasswordDirty(false);
            }}
          />
          <DateInput
            label={t('settings.access.opensAtLabel')}
            description={t('settings.access.opensAtDescription')}
            placeholder={t('settings.access.selectDatePlaceholder')}
            value={opensAt}
            onChange={(value) => {
              const next = value ? new Date(value) : null;
              setOpensAt(next);
              saveSettings.mutate({ opensAt: next });
            }}
            clearable
          />
          <DateInput
            label={t('settings.access.closesAtLabel')}
            description={t('settings.access.closesAtDescription')}
            placeholder={t('settings.access.selectDatePlaceholder')}
            value={closesAt}
            onChange={(value) => {
              const next = value ? new Date(value) : null;
              setClosesAt(next);
              saveSettings.mutate({ closesAt: next });
            }}
            clearable
          />
          <NumberInput
            label={t('settings.access.maxSubmissionsLabel')}
            description={t('settings.access.maxSubmissionsDescription')}
            placeholder={t('settings.access.noLimit')}
            value={maxSubmissions ?? ''}
            onChange={(value) => {
              const next = value === '' ? null : Number(value);
              setMaxSubmissions(next);
              saveSettings.mutate({ maxSubmissions: next });
            }}
            min={1}
          />
          <Divider my="sm" />
          <Title order={5}>{t('settings.authRules.title')}</Title>
          <Switch
            label={t('settings.authRules.requireAuthLabel')}
            description={t('settings.authRules.requireAuthDescription')}
            checked={requireAuth}
            onChange={(event) => {
              const next = event.currentTarget.checked;
              setRequireAuth(next);
              if (!next) {
                setAllowedRoles([]);
                setAllowDuplicateSubmission(true);
                saveSettings.mutate({ requireAuth: false, allowedRoles: [], allowDuplicateSubmission: true });
              } else {
                saveSettings.mutate({ requireAuth: true });
              }
            }}
          />
          {requireAuth ? (
            <>
              <MultiSelect
                label={t('settings.authRules.allowedRolesLabel')}
                description={t('settings.authRules.allowedRolesDescription')}
                placeholder={tCommonPlaceholders('selectRoles')}
                data={roleOptions}
                value={allowedRoles}
                onChange={(values) => {
                  const next = values.filter(isUserRole);
                  setAllowedRoles(next);
                  saveSettings.mutate({ allowedRoles: next });
                }}
                clearable
              />
              <Switch
                label={t('settings.authRules.allowDuplicateLabel')}
                description={t('settings.authRules.allowDuplicateDescription')}
                checked={allowDuplicateSubmission}
                onChange={(event) => {
                  const next = event.currentTarget.checked;
                  setAllowDuplicateSubmission(next);
                  saveSettings.mutate({ allowDuplicateSubmission: next });
                }}
              />
            </>
          ) : null}
        </Stack>
      </SectionCard>
    </Stack>
  );
}
