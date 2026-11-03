'use client';

import { useEditorAccessLevel } from '@/features/editor/useEditorAccessLevel';

import { AuthoringExtension } from '@/features/authoring/AuthoringExtensionsContext';

import { LayoutStack as DsLayoutStack, LayoutInline as DsLayoutInline } from '@/components/core/Layout';
import { Heading as DsHeading, Text as DsText, VisuallyHidden } from '@/components/core/Typography';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useIsMutating, useMutation } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';

import { DateInput, MultiSelect, NumberInput, PasswordInput, Switch } from '@/components/core/Input';
import { notifications } from '@/components/core/Notification';

import { MediaPreviewGrid } from '@/components/core/MediaPreviewGrid';
import { StatusBadge } from '@/components/core/Badge';
import { Alert } from '@/components/core/Alert';
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
import { useOgImage, type OgImageReadBindings } from '@/lib/hooks/useOgImage';
import { useSlugManagement } from '@/lib/hooks/useSlugManagement';
import { useUpload } from '@/lib/hooks/useUpload';
import type { UserRole } from '@/lib/types/user/model';
import { UploadType } from '@/lib/types/upload/model';

export interface FormSettingsBindings {
  update?: typeof updateFormAction;
  setFeaturedImage?: typeof setFormFeaturedImageAction;
  removeFeaturedImage?: typeof removeFormFeaturedImageAction;
  regenerateOgImage?: typeof regenerateFormOgImageAction;
  ogRead?: OgImageReadBindings;
  checkSlug?: Parameters<typeof useSlugManagement>[0]['checkAvailability'];
  upload?: ReturnType<typeof useUpload>['upload'];
}
interface FormSettingsContentProps {
  bindings?: FormSettingsBindings;
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
type SettingsSaveRequest = { input: UpdateFormInput; sequence: number };

export function FormSettingsContent(props: FormSettingsContentProps) {
  return <FormSettingsTarget key={props.formId} {...props} />;
}

function FormSettingsTarget({
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
  bindings,
}: FormSettingsContentProps) {
  const t = useTranslations('formAdmin');
  const tCommon = useTranslations('common');
  const tFeaturedImage = useTranslations('featuredImage');
  const tCommonPlaceholders = useTranslations('common.placeholders');
  const tCommonNotifications = useTranslations('common.notifications');
  const { fields, isSynced, provider, ogGenerationLookup } = useFormEditorContext();
  const { activeEditLocale } = useFormTranslationContext();
  const canEdit = useEditorAccessLevel(provider) === 'edit';
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
  const [uploadPending, setUploadPending] = useState(false);
  const [saveAnnouncement, setSaveAnnouncement] = useState('');
  const [saveError, setSaveError] = useState('');
  const mounted = useRef(false);
  const saveSequence = useRef(0);
  const failedFields = useRef(new Map<keyof UpdateFormInput, { sequence: number; message: string }>());
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const settingsPending = useIsMutating({ mutationKey: ['form-settings', formId] }) > 0;
  const ogImage = useOgImage({
    entityType: 'form',
    entityId: formId,
    readBindings: bindings?.ogRead,
    initialOgImageUrl: activeEditLocale.isSourceLocale ? initialOgImageUrl : activeEditLocale.displayOgImageUrl,
    locale: activeEditLocale.hasLiveRow ? activeEditLocale.activeLocale : null,
    provider,
  });
  useOgGenerationLookupSignal(activeEditLocale.ogGenerationRun, activeEditLocale.activeLocale, ogImage.trackLatest);
  useOgGenerationLookupSignal(ogGenerationLookup, activeEditLocale.activeLocale, ogImage.trackLatest);
  const uploadController = useUpload(UploadType.FORM_FEATURED_IMAGE);
  const upload = bindings?.upload ?? uploadController.upload;
  const isUploading = uploadPending || uploadController.isUploading;

  const updateSaveFailures = (request: SettingsSaveRequest, message?: string) => {
    for (const field of Object.keys(request.input) as (keyof UpdateFormInput)[]) {
      const failure = failedFields.current.get(field);
      if (failure && failure.sequence > request.sequence) {
        continue;
      }
      if (message) {
        failedFields.current.set(field, { sequence: request.sequence, message });
      } else {
        failedFields.current.delete(field);
      }
    }
    setSaveError([...new Set([...failedFields.current.values()].map((failure) => failure.message))].join('\n'));
  };

  const saveMutation = useMutation({
    mutationKey: ['form-settings', formId],
    scope: { id: `form-settings:${formId}` },
    mutationFn: ({ input }: SettingsSaveRequest) => (bindings?.update ?? updateFormAction)(formId, input),
    onSuccess: (result, request) => {
      if (!mounted.current) {
        return;
      }
      if (result.error) {
        updateSaveFailures(request, result.error);
        notifications.show({ message: result.error, tone: 'danger' });
        return;
      }
      updateSaveFailures(request);
      if (request.sequence === saveSequence.current && failedFields.current.size === 0) {
        setSaveAnnouncement(tCommonNotifications('saveSuccess'));
      }
    },
    onMutate: () => {
      if (!mounted.current) {
        return;
      }
      setSaveAnnouncement('');
    },
    onError: (error, request) => {
      if (!mounted.current) {
        return;
      }
      const message = error instanceof Error ? error.message : tCommonNotifications('updateFailed');
      updateSaveFailures(request, message);
      notifications.show({ message, tone: 'danger' });
    },
  });
  const saveSettings = {
    mutate: (input: UpdateFormInput) => saveMutation.mutate({ input, sequence: ++saveSequence.current }),
    mutateAsync: (input: UpdateFormInput) => saveMutation.mutateAsync({ input, sequence: ++saveSequence.current }),
  };

  const slugMgmt = useSlugManagement({
    entityType: 'form',
    entityId: formId,
    slug,
    checkAvailability: bindings?.checkSlug,
    onSlugChange: setSlug,
    onSave: (nextSlug) => saveSettings.mutateAsync({ slug: nextSlug || null, isPublic: nextSlug ? isPublic : false }),
  });
  const { updateFromTitle } = slugMgmt;
  useEffect(() => {
    if (canEdit && isSynced && activeEditLocale.isSourceLocale && activeEditLocale.canEditActiveLocale) {
      updateFromTitle(fields.title);
    }
  }, [
    canEdit,
    activeEditLocale.canEditActiveLocale,
    activeEditLocale.isSourceLocale,
    fields.title,
    isSynced,
    updateFromTitle,
  ]);

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
    mutationFn: (fileId: string) => (bindings?.setFeaturedImage ?? setFormFeaturedImageAction)(formId, fileId),
    onSuccess: (result) => {
      if (!mounted.current) {
        return;
      }
      if (result.error) {
        notifications.show({ message: result.error, tone: 'danger' });
        return;
      }
      setFeaturedImageUrl(result.imageUrl ?? null);
      if (result.ogGenerationRunId) {
        void ogImage.trackLatest();
      }
      notifications.show({ message: tCommonNotifications('featuredImageUpdated'), tone: 'positive' });
    },
  });

  const removeFeaturedImage = useMutation({
    mutationFn: () => (bindings?.removeFeaturedImage ?? removeFormFeaturedImageAction)(formId),
    onSuccess: (result) => {
      if (!mounted.current) {
        return;
      }
      if (result.error) {
        notifications.show({ message: result.error, tone: 'danger' });
        return;
      }
      setFeaturedImageUrl(null);
      if (result.ogGenerationRunId) {
        void ogImage.trackLatest();
      }
      notifications.show({ message: tCommonNotifications('featuredImageRemoved'), tone: 'warning' });
    },
  });

  const regenerateOgImage = useMutation({
    mutationFn: (request: { locale: string; targetKey: string }) =>
      (bindings?.regenerateOgImage ?? regenerateFormOgImageAction)(formId, request.locale),
    onSuccess: (result, request) => {
      if (!mounted.current) {
        return;
      }
      if (result.error) {
        notifications.show({ message: result.error, tone: 'danger' });
        return;
      }
      ogImage.trackRequestedGeneration(result.generationId, request.targetKey);
      notifications.show({ message: tCommonNotifications('ogGenerationRequested'), tone: 'neutral' });
    },
  });

  const handleFeaturedImageUpload = async (croppedBlob: Blob) => {
    setUploadProgress(0);
    setUploadPending(true);
    try {
      const { fileId } = await upload(croppedBlob, {
        entityId: formId,
        fileName: 'featured',
        onProgress: (progress) => setUploadProgress(progress.percentage),
      });
      if (!mounted.current) {
        return;
      }
      await setFeaturedImage.mutateAsync(fileId);
    } catch (error) {
      if (!mounted.current) {
        return;
      }
      notifications.show({
        message: error instanceof Error ? error.message : tCommonNotifications('uploadFailed'),
        tone: 'danger',
      });
    } finally {
      if (mounted.current) {
        setUploadPending(false);
        setUploadProgress(0);
      }
    }
  };

  return (
    <DsLayoutStack role="group" aria-label={t('settings.access.title')} aria-busy={settingsPending}>
      {settingsPending ? (
        <StatusBadge role="status" tone="neutral">
          {tCommon('states.syncing')}
        </StatusBadge>
      ) : null}
      {!settingsPending && saveAnnouncement ? (
        <StatusBadge tone="positive">{tCommon('states.synced')}</StatusBadge>
      ) : null}
      {saveError ? (
        <Alert tone="danger" role="alert">
          {saveError}
        </Alert>
      ) : null}
      <VisuallyHidden role="status" aria-live="polite" aria-atomic="true">
        {saveAnnouncement}
      </VisuallyHidden>
      <SectionCard padding="lg">
        <DsLayoutStack gap="md">
          <DsHeading level={4}>{t('settings.urlPublic.title')}</DsHeading>
          <UrlSection
            baseUrl={baseUrl}
            entityType="form"
            entityId={formId}
            slug={slug}
            isAvailable={slugMgmt.isAvailable}
            error={slugError}
            saving={isSlugChecking || settingsPending}
            disabled={!canEdit}
            onChange={handleSlugChange}
            onBlur={handleSlugBlur}
          />
          <DsLayoutInline gap="sm">
            <Switch
              checked={isPublic}
              onChange={(event) => {
                const next = event.currentTarget.checked;
                setIsPublic(next);
                saveSettings.mutate({ isPublic: next });
              }}
              label={t('settings.urlPublic.allowPublic')}
              disabled={!canEdit || !slug}
            />
            <DsText size="xs" tone="secondary">
              {!slug
                ? t('settings.urlPublic.setSlugFirst')
                : isPublic
                  ? t('settings.urlPublic.directUrlEnabled')
                  : t('settings.urlPublic.embedOnly')}
            </DsText>
          </DsLayoutInline>
        </DsLayoutStack>
      </SectionCard>

      <SectionCard padding="lg">
        <DsLayoutStack gap="md">
          <DsHeading level={4}>{t('settings.media.title')}</DsHeading>
          <MediaPreviewGrid>
            <OgImagePreview
              src={ogImage.src}
              canRegenerate={canEdit && activeEditLocale.hasLiveRow && Boolean(activeEditLocale.activeLocale)}
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
              targetKey={formId}
              canEdit={canEdit}
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
        </DsLayoutStack>
      </SectionCard>

      <AuthoringExtension kind="sharing">
        <ShareLinkSection
          entityType="form"
          entityId={formId}
          title={t('settings.previewLinks.title')}
          description={t('settings.previewLinks.description')}
          disabled={!canEdit || !slug}
        />
      </AuthoringExtension>
      <AuthoringExtension kind="sharing">
        <ShareLinkSection
          entityType="form-dashboard"
          entityId={formId}
          title={t('settings.dashboardLinks.title')}
          description={t('settings.dashboardLinks.description')}
          disabled={!canEdit || !slug}
        />
      </AuthoringExtension>

      <SectionCard padding="lg">
        <DsLayoutStack gap="md">
          <DsHeading level={4}>{t('settings.access.title')}</DsHeading>
          <PasswordInput
            disabled={!canEdit}
            label={t('settings.access.passwordLabel')}
            description={t('settings.access.passwordDescription')}
            placeholder={initialHasPassword ? '••••••••' : tCommonPlaceholders('password')}
            value={password}
            onChange={(event) => {
              setPassword(event.currentTarget.value);
              setPasswordDirty(true);
            }}
            onBlur={() => {
              if (!canEdit || !passwordDirty) {
                return;
              }
              saveSettings.mutate({ password });
              setPasswordDirty(false);
            }}
          />
          <DateInput
            disabled={!canEdit}
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
            disabled={!canEdit}
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
            disabled={!canEdit}
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
        </DsLayoutStack>
      </SectionCard>

      <SectionCard padding="lg">
        <DsLayoutStack gap="md">
          <DsHeading level={4}>{t('settings.authRules.title')}</DsHeading>
          <Switch
            disabled={!canEdit}
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
                disabled={!canEdit}
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
                disabled={!canEdit}
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
        </DsLayoutStack>
      </SectionCard>
    </DsLayoutStack>
  );
}
