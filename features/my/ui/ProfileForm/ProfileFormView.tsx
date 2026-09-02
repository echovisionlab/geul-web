'use client';

import { useRef, useState, type DragEvent, type KeyboardEvent } from 'react';
import { IconCheck, IconCopy, IconGripVertical, IconPlus, IconTrash } from '@tabler/icons-react';
import { Group, Stack, Text } from '@mantine/core';
import { useForm } from '@mantine/form';
import { Button } from '@/components/core/Button';
import { Field } from '@/components/core/Field';
import { IconButton } from '@/components/core/IconButton';
import { Select, Textarea, TextInput, ValidatingTextInput, type TextValidationStatus } from '@/components/core/Input';
import { Tooltip } from '@/components/core/Tooltip';
import classes from './ProfileFormView.module.css';

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
  onCopyUid: () => void;
  onNicknameChange: (value: string) => void;
  onNormalizeSocialLink: (platform: string, value: string) => string;
  onSubmit: (values: ProfileFormValues) => void;
}

export interface ProfileFormViewProps {
  initialValues: ProfileFormInitialValues;
  labels: ProfileFormViewLabels;
  platformOptions: ProfileSocialPlatformOption[];
  showExtendedFields: boolean;
  pending?: boolean;
  disabled?: boolean;
  copied?: boolean;
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
  disabled = false,
  copied = false,
  errors = {},
  nicknameValidation = { status: 'idle' },
  events,
  maxSocialLinks = DEFAULT_MAX_SOCIAL_LINKS,
}: ProfileFormViewProps) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const newLinkIdRef = useRef(0);
  const formDisabled = disabled || pending;
  const form = useForm<ProfileFormValues>({
    initialValues: {
      nickname: initialValues.nickname,
      bio: initialValues.bio,
      website: initialValues.website,
      socialLinks: initialValues.socialLinks,
    },
  });

  const setSocialLinks = (socialLinks: ProfileSocialLinkValue[]) => {
    form.setFieldValue('socialLinks', socialLinks);
  };

  const addSocialLink = () => {
    if (form.values.socialLinks.length >= maxSocialLinks) {
      return;
    }

    const key = `new-${newLinkIdRef.current}`;
    newLinkIdRef.current += 1;
    setSocialLinks([...form.values.socialLinks, { key, platform: '', value: '' }]);
  };

  const removeSocialLink = (index: number) => {
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

  const handleDragOver = (event: DragEvent<HTMLDivElement>, targetIndex: number) => {
    event.preventDefault();
    if (draggedIndex === null || draggedIndex === targetIndex) {
      return;
    }

    moveSocialLink(draggedIndex, targetIndex);
    setDraggedIndex(targetIndex);
  };

  const handleReorderKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') {
      return;
    }

    event.preventDefault();
    moveSocialLink(index, event.key === 'ArrowUp' ? index - 1 : index + 1);
  };

  return (
    <Stack gap="md">
      <TextInput
        id="profile-uid"
        label={labels.uid}
        value={initialValues.uid}
        disabled
        rightSectionPointerEvents="all"
        rightSection={
          <Tooltip label={copied ? labels.copiedUid : labels.copyUid} withArrow position="right">
            <IconButton
              type="button"
              tone={copied ? 'positive' : 'neutral'}
              emphasis="low"
              aria-label={copied ? labels.copiedUid : labels.copyUid}
              onClick={events.onCopyUid}
              disabled={disabled}
            >
              {copied ? <IconCheck size={16} aria-hidden /> : <IconCopy size={16} aria-hidden />}
            </IconButton>
          </Tooltip>
        }
      />

      <form onSubmit={form.onSubmit((values) => events.onSubmit(values))}>
        <Stack>
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
                  <Text size="xs" c="dimmed">
                    {form.values.bio.length}/{BIO_MAX_LENGTH}
                  </Text>
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
                  {...form.getInputProps('bio')}
                  disabled={formDisabled}
                />
              </Field>

              <Field label={labels.website} htmlFor="profile-website" error={errors.website}>
                <TextInput
                  id="profile-website"
                  aria-label={labels.website}
                  placeholder={labels.websitePlaceholder}
                  {...form.getInputProps('website')}
                  disabled={formDisabled}
                />
              </Field>

              <Stack gap="xs">
                <Group justify="space-between" align="center" wrap="nowrap">
                  <Text size="sm" fw={500}>
                    {labels.socialLinks}
                  </Text>
                  <Button
                    type="button"
                    size="xs"
                    tone="accent"
                    emphasis="medium"
                    leftSection={<IconPlus size={14} aria-hidden />}
                    onClick={addSocialLink}
                    disabled={formDisabled || form.values.socialLinks.length >= maxSocialLinks}
                  >
                    {labels.addSocialLink}
                  </Button>
                </Group>

                {form.values.socialLinks.map((link, index) => {
                  const platformOption = platformOptions.find((option) => option.value === link.platform);

                  return (
                    <div
                      key={link.key}
                      className={classes.socialLinkRow}
                      data-social-link-row={link.key}
                      data-dragging={draggedIndex === index || undefined}
                      onDragOver={(event) => handleDragOver(event, index)}
                    >
                      <IconButton
                        type="button"
                        className={classes.dragHandle}
                        tone="neutral"
                        emphasis="low"
                        aria-label={labels.reorderSocialLink(index + 1)}
                        draggable={!formDisabled}
                        disabled={formDisabled}
                        onDragStart={(event) => {
                          event.dataTransfer.effectAllowed = 'move';
                          setDraggedIndex(index);
                        }}
                        onDragEnd={() => setDraggedIndex(null)}
                        onKeyDown={(event) => handleReorderKeyDown(event, index)}
                      >
                        <IconGripVertical size={16} aria-hidden />
                      </IconButton>

                      <Select
                        className={classes.platformInput}
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
                        className={classes.valueInput}
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

                      <IconButton
                        type="button"
                        className={classes.removeButton}
                        tone="danger"
                        emphasis="low"
                        aria-label={labels.removeSocialLink(index + 1)}
                        onClick={() => removeSocialLink(index)}
                        disabled={formDisabled}
                      >
                        <IconTrash size={16} aria-hidden />
                      </IconButton>
                    </div>
                  );
                })}

                {errors.socialLinks ? (
                  <Text size="xs" c="red" role="alert">
                    {errors.socialLinks}
                  </Text>
                ) : null}
              </Stack>
            </>
          ) : null}

          {errors.form ? (
            <Text size="sm" c="red" role="alert" aria-live="polite">
              {errors.form}
            </Text>
          ) : null}

          <Button type="submit" tone="accent" emphasis="strong" loading={pending} disabled={disabled}>
            {labels.submit}
          </Button>
        </Stack>
      </form>
    </Stack>
  );
}
