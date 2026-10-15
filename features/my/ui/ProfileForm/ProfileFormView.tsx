'use client';

import { fieldBindings } from '@/components/core/bindings';
import { LayoutStack as DsLayoutStack, LayoutInline as DsLayoutInline } from '@/components/core/Layout';
import { Text as DsText, VisuallyHidden } from '@/components/core/Typography';
import { useEffect, useId, useRef, useState, type DragEvent, type KeyboardEvent } from 'react';
import { IconGripVertical, IconPlus, IconTrash } from '@tabler/icons-react';
import { CopyButton } from '@/components/core/CopyButton';

import { useForm } from '@mantine/form';
import { Button } from '@/components/core/Button';
import { Field } from '@/components/core/Field';
import { IconButton } from '@/components/core/IconButton';
import { Select, Textarea, TextInput, ValidatingTextInput, type TextValidationStatus } from '@/components/core/Input';
import { ReorderRow } from '@/components/core/Sortable';

const BIO_MAX_LENGTH = 500;
const DEFAULT_MAX_SOCIAL_LINKS = 20;

export interface ProfileSocialLinkValue {
  key: string;
  platform: string;
  value: string;
}

export interface ProfileFormValues {
  nickname: string;
  bio: string;
  website: string;
  socialLinks: ProfileSocialLinkValue[];
}

export interface ProfileFormChangedFields {
  nickname: boolean;
  bio: boolean;
  website: boolean;
  socialLinks: boolean;
}

export interface ProfileFormInitialValues extends ProfileFormValues {
  uid: string;
}

export interface ProfileSocialPlatformOption {
  value: string;
  label: string;
  placeholder: string;
}

export interface ProfileFormViewLabels {
  uid: string;
  copyUid: string;
  copiedUid: string;
  nickname: string;
  nicknamePlaceholder: string;
  bio: string;
  bioPlaceholder: string;
  website: string;
  websitePlaceholder: string;
  socialLinks: string;
  addSocialLink: string;
  socialPlatform: string;
  socialValue: string;
  removeSocialLink: (position: number) => string;
  reorderSocialLink: (position: number) => string;
  reorderInstructions: string;
  positionChanged: (position: number, count: number) => string;
  submit: string;
}

export interface ProfileFormViewErrors {
  form?: string;
  nickname?: string;
  bio?: string;
  website?: string;
  socialLinks?: string;
}

export interface ProfileFormViewEvents {
  onNicknameChange: (value: string) => void;
  onNormalizeSocialLink: (platform: string, value: string) => string;
  onSubmit: (values: ProfileFormValues, changedFields: ProfileFormChangedFields) => void;
}

export interface ProfileFormViewProps {
  initialValues: ProfileFormInitialValues;
  labels: ProfileFormViewLabels;
  platformOptions: ProfileSocialPlatformOption[];
  showExtendedFields: boolean;
  pending?: boolean;
  savedRevision?: number;
  disabled?: boolean;
  errors?: ProfileFormViewErrors;
  nicknameValidation?: { status: TextValidationStatus; message?: string | null };
  events: ProfileFormViewEvents;
  maxSocialLinks?: number;
}

/** Pure profile editor. Service state, localized copy, and commands arrive through props. */
export function ProfileFormView({
  initialValues,
  labels,
  platformOptions,
  showExtendedFields,
  pending = false,
  savedRevision = 0,
  disabled = false,
  errors = {},
  nicknameValidation = { status: 'idle' },
  events,
  maxSocialLinks = DEFAULT_MAX_SOCIAL_LINKS,
}: ProfileFormViewProps) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [reorderAnnouncement, setReorderAnnouncement] = useState('');
  const viewRef = useRef<HTMLElement>(null);
  const pendingFocus = useRef<{ key: string; control: 'input' | 'handle' | 'remove' } | 'add' | null>(null);
  const socialHeadingId = useId();
  const reorderInstructionsId = useId();
  const submitId = useId();
  const newLinkIdRef = useRef(0);
  const savedRevisionRef = useRef(savedRevision);
  const savedInitialValuesRef = useRef<ProfileFormInitialValues | null>(null);
  const formDisabled = disabled || pending;
  const form = useForm<ProfileFormValues>({
    initialValues: {
      nickname: initialValues.nickname,
      bio: initialValues.bio,
      website: initialValues.website,
      socialLinks: initialValues.socialLinks,
    },
  });
  const formRef = useRef(form);
  formRef.current = form;
  const onNicknameChangeRef = useRef(events.onNicknameChange);
  onNicknameChangeRef.current = events.onNicknameChange;
  useEffect(() => {
    const target = pendingFocus.current;
    if (!target) {
      return;
    }
    pendingFocus.current = null;
    if (target === 'add') {
      viewRef.current?.querySelector<HTMLElement>('[data-social-link-add]')?.focus();
      return;
    }
    const row = [...(viewRef.current?.querySelectorAll<HTMLElement>('[data-social-link-row]') ?? [])].find(
      (element) => element.dataset.socialLinkRow === target.key,
    );
    row
      ?.querySelector<HTMLElement>(target.control === 'input' ? 'input' : `[data-social-link-${target.control}]`)
      ?.focus();
  }, [form.values.socialLinks]);

  useEffect(() => {
    const currentForm = formRef.current;
    if (savedRevisionRef.current !== savedRevision) {
      savedRevisionRef.current = savedRevision;
      savedInitialValuesRef.current = initialValues;
      const savedValues = currentForm.getValues();
      currentForm.setInitialValues(savedValues);
      currentForm.resetDirty(savedValues);
      return;
    }

    if (savedInitialValuesRef.current === initialValues) {
      return;
    }

    if (disabled || pending || currentForm.isDirty()) {
      return;
    }
    savedInitialValuesRef.current = null;

    const nextValues = {
      nickname: initialValues.nickname,
      bio: initialValues.bio,
      website: initialValues.website,
      socialLinks: initialValues.socialLinks,
    };
    currentForm.setInitialValues(nextValues);
    currentForm.setValues(nextValues);
    currentForm.resetDirty(nextValues);
    onNicknameChangeRef.current(nextValues.nickname);
  }, [disabled, initialValues, pending, savedRevision]);

  const setSocialLinks = (socialLinks: ProfileSocialLinkValue[]) => {
    form.setFieldValue('socialLinks', socialLinks);
  };

  const addSocialLink = () => {
    if (form.values.socialLinks.length >= maxSocialLinks) {
      return;
    }

    const key = `new-${newLinkIdRef.current}`;
    newLinkIdRef.current += 1;
    pendingFocus.current = { key, control: 'input' };
    setSocialLinks([...form.values.socialLinks, { key, platform: '', value: '' }]);
  };

  const removeSocialLink = (index: number) => {
    const next = form.values.socialLinks[index + 1] ?? form.values.socialLinks[index - 1];
    pendingFocus.current = next ? { key: next.key, control: 'remove' } : 'add';
    setSocialLinks(form.values.socialLinks.filter((_, itemIndex) => itemIndex !== index));
  };

  const updateSocialLink = (index: number, field: 'platform' | 'value', value: string) => {
    setSocialLinks(
      form.values.socialLinks.map((link, itemIndex) => (itemIndex === index ? { ...link, [field]: value } : link)),
    );
  };

  const moveSocialLink = (fromIndex: number, toIndex: number) => {
    if (
      fromIndex === toIndex ||
      fromIndex < 0 ||
      toIndex < 0 ||
      fromIndex >= form.values.socialLinks.length ||
      toIndex >= form.values.socialLinks.length
    ) {
      return;
    }

    const links = [...form.values.socialLinks];
    const [movedLink] = links.splice(fromIndex, 1);
    if (!movedLink) {
      return;
    }

    links.splice(toIndex, 0, movedLink);
    setSocialLinks(links);
  };

  const handleDragOver = (event: DragEvent<HTMLElement>, targetIndex: number) => {
    event.preventDefault();
    if (draggedIndex === null || draggedIndex === targetIndex) {
      return;
    }

    moveSocialLink(draggedIndex, targetIndex);
    setDraggedIndex(targetIndex);
  };

  const handleReorderKeyDown = (event: KeyboardEvent<HTMLElement>, index: number) => {
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') {
      return;
    }

    event.preventDefault();
    const targetIndex = event.key === 'ArrowUp' ? index - 1 : index + 1;
    const link = form.values.socialLinks[index];
    if (link && targetIndex >= 0 && targetIndex < form.values.socialLinks.length) {
      pendingFocus.current = { key: link.key, control: 'handle' };
      setReorderAnnouncement(labels.positionChanged(targetIndex + 1, form.values.socialLinks.length));
      moveSocialLink(index, targetIndex);
    }
  };

  return (
    <DsLayoutStack ref={viewRef} gap="md">
      <TextInput
        id="profile-uid"
        label={labels.uid}
        value={initialValues.uid}
        disabled
        rightSection={
          <CopyButton
            value={initialValues.uid}
            label={labels.copyUid}
            copiedLabel={labels.copiedUid}
            disabled={disabled}
          />
        }
      />

      <form
        aria-busy={pending}
        aria-labelledby={submitId}
        onSubmit={form.onSubmit((values) =>
          events.onSubmit(values, {
            nickname: form.isDirty('nickname'),
            bio: showExtendedFields && form.isDirty('bio'),
            website: showExtendedFields && form.isDirty('website'),
            socialLinks: showExtendedFields && form.isDirty('socialLinks'),
          }),
        )}
      >
        <DsLayoutStack>
          <ValidatingTextInput
            id="profile-nickname"
            label={labels.nickname}
            placeholder={labels.nicknamePlaceholder}
            autoComplete="nickname"
            value={form.values.nickname}
            onChange={(event) => {
              form.setFieldValue('nickname', event.currentTarget.value);
              events.onNicknameChange(event.currentTarget.value);
            }}
            required
            disabled={formDisabled}
            status={nicknameValidation.status}
            statusLabel={nicknameValidation.message || undefined}
            description={
              nicknameValidation.status === 'checking' || nicknameValidation.status === 'valid'
                ? nicknameValidation.message || undefined
                : undefined
            }
            error={
              errors.nickname ||
              (nicknameValidation.status === 'invalid' || nicknameValidation.status === 'error'
                ? nicknameValidation.message || undefined
                : undefined)
            }
          />

          {showExtendedFields ? (
            <>
              <Field
                label={labels.bio}
                htmlFor="profile-bio"
                error={errors.bio}
                actions={
                  <DsText size="xs" tone="secondary">
                    {form.values.bio.length}/{BIO_MAX_LENGTH}
                  </DsText>
                }
              >
                <Textarea
                  id="profile-bio"
                  aria-label={labels.bio}
                  placeholder={labels.bioPlaceholder}
                  minRows={3}
                  maxRows={6}
                  maxLength={BIO_MAX_LENGTH}
                  autosize
                  {...fieldBindings(form.getInputProps('bio'))}
                  disabled={formDisabled}
                />
              </Field>

              <Field label={labels.website} htmlFor="profile-website" error={errors.website}>
                <TextInput
                  id="profile-website"
                  aria-label={labels.website}
                  placeholder={labels.websitePlaceholder}
                  {...fieldBindings(form.getInputProps('website'))}
                  disabled={formDisabled}
                />
              </Field>

              <DsLayoutStack gap="xs" role="group" aria-labelledby={socialHeadingId}>
                <DsLayoutInline justify="between" align="center" wrap="nowrap">
                  <DsText id={socialHeadingId} size="sm" weight="medium">
                    {labels.socialLinks}
                  </DsText>
                  <Button
                    type="button"
                    size="xs"
                    tone="neutral"
                    emphasis="medium"
                    leftSection={<IconPlus size={14} aria-hidden />}
                    onClick={addSocialLink}
                    data-social-link-add
                    disabled={formDisabled || form.values.socialLinks.length >= maxSocialLinks}
                  >
                    {labels.addSocialLink}
                  </Button>
                </DsLayoutInline>

                {form.values.socialLinks.map((link, index) => {
                  const platformOption = platformOptions.find((option) => option.value === link.platform);

                  return (
                    <ReorderRow
                      role="group"
                      aria-label={`${labels.socialLinks} ${index + 1}`}
                      key={link.key}
                      data-social-link-row={link.key}
                      data-dragging={draggedIndex === index || undefined}
                      onDragOver={(event) => handleDragOver(event, index)}

                      handle={
                        <IconButton
                          type="button"
                          interaction="drag-handle"
                          tone="neutral"
                          emphasis="low"
                          aria-label={labels.reorderSocialLink(index + 1)}
                          aria-describedby={reorderInstructionsId}
                          aria-keyshortcuts="ArrowUp ArrowDown"
                          data-social-link-handle
                          draggable={!formDisabled}
                          disabled={formDisabled}
                          onDragStart={(event) => {
                            event.dataTransfer.effectAllowed = 'move';
                            setDraggedIndex(index);
                          }}
                          onDragEnd={() => setDraggedIndex(null)}
                          onKeyDown={(event) => handleReorderKeyDown(event, index)}
                        >
                          <IconGripVertical aria-hidden />
                        </IconButton>
                      }
                      actions={
                        <IconButton
                          type="button"
                          tone="danger"
                          emphasis="low"
                          aria-label={labels.removeSocialLink(index + 1)}
                          data-social-link-remove
                          onClick={() => removeSocialLink(index)}
                          disabled={formDisabled}
                        >
                          <IconTrash size={16} aria-hidden />
                        </IconButton>
                      }
                    >
                      <DsLayoutInline gap="xxs" direction={{ base: 'column', sm: 'row' }} align="stretch" wrap="nowrap">
                        <Select
                          size="xs"
                          id={`profile-social-platform-${index}`}
                          aria-label={labels.socialPlatform}
                          placeholder={labels.socialPlatform}
                          data={platformOptions.map(({ value, label }) => ({ value, label }))}
                          value={link.platform || null}
                          onChange={(value) => updateSocialLink(index, 'platform', value ?? '')}
                          searchable
                          disabled={formDisabled}
                        />

                        <TextInput
                          size="xs"
                          id={`profile-social-value-${index}`}
                          aria-label={labels.socialValue}
                          placeholder={platformOption?.placeholder ?? labels.socialValue}
                          value={link.value}
                          onChange={(event) => updateSocialLink(index, 'value', event.currentTarget.value)}
                          onBlur={() => {
                            const normalizedValue = events.onNormalizeSocialLink(link.platform, link.value);
                            if (normalizedValue !== link.value) {
                              updateSocialLink(index, 'value', normalizedValue);
                            }
                          }}
                          disabled={formDisabled}
                        />
                      </DsLayoutInline>
                    </ReorderRow>
                  );
                })}

                {errors.socialLinks ? (
                  <DsText size="xs" tone="danger" role="alert">
                    {errors.socialLinks}
                  </DsText>
                ) : null}
                <VisuallyHidden id={reorderInstructionsId}>{labels.reorderInstructions}</VisuallyHidden>
                <VisuallyHidden role="status" aria-live="polite" aria-atomic="true">
                  {reorderAnnouncement}
                </VisuallyHidden>
              </DsLayoutStack>
            </>
          ) : null}

          {errors.form ? (
            <DsText size="sm" tone="danger" role="alert" aria-live="polite">
              {errors.form}
            </DsText>
          ) : null}

          <Button
            id={submitId}
            type="submit"
            tone="neutral"
            emphasis="medium"
            loading={pending}
            disabled={formDisabled}
          >
            {labels.submit}
          </Button>
        </DsLayoutStack>
      </form>
    </DsLayoutStack>
  );
}
