import { useArgs, useState } from 'storybook/preview-api';
import { useTranslations } from 'next-intl';
import { Text } from '@/components/core/Typography';
import { withFeatureLabels } from '@/stories/feature-localization';
import type { Meta, StoryObj } from '@storybook/nextjs';

import {
  ProfileFormView,
  type ProfileFormInitialValues,
  type ProfileFormViewLabels,
  type ProfileSocialPlatformOption,
} from './ProfileFormView';

const labels: ProfileFormViewLabels = {
  uid: 'UID',
  copyUid: 'Copy UID',
  copiedUid: 'UID copied',
  nickname: 'Nickname',
  nicknamePlaceholder: 'Choose a nickname',
  bio: 'Bio',
  bioPlaceholder: 'Tell us about yourself',
  website: 'Website',
  websitePlaceholder: 'https://example.com',
  socialLinks: 'Social links',
  addSocialLink: 'Add link',
  socialPlatform: 'Platform',
  socialValue: 'URL or username',
  removeSocialLink: (position) => `Remove social link ${position}`,
  reorderSocialLink: (position) => `Reorder social link ${position}`,
  reorderInstructions: 'Use the Up and Down arrow keys to change this link’s position.',
  positionChanged: (position, count) => `Link moved to position ${position} of ${count}.`,
  submit: 'Update profile',
};

const platformOptions: ProfileSocialPlatformOption[] = [
  {
    value: 'instagram',
    label: 'Instagram',
    placeholder: 'https://instagram.com/username',
  },
  {
    value: 'github',
    label: 'GitHub',
    placeholder: 'https://github.com/username',
  },
  {
    value: 'bandcamp',
    label: 'Bandcamp',
    placeholder: 'https://artist.bandcamp.com',
  },
  {
    value: 'youtube',
    label: 'YouTube',
    placeholder: 'https://youtube.com/@channel',
  },
];

const populatedValues: ProfileFormInitialValues = {
  uid: '22222222-2222-4222-8222-222222222222',
  nickname: 'June Han',
  bio: 'Sound artist and independent curator working across performance and installation.',
  website: 'https://june.example.com',
  socialLinks: [
    { key: '0', platform: 'instagram', value: 'https://instagram.com/june' },
    { key: '1', platform: 'bandcamp', value: 'https://june.bandcamp.com' },
  ],
};

const longBio =
  'I build long-form audiovisual works, field recordings, installations, and collaborative performances across independent venues and public spaces. '
    .repeat(4)
    .trim()
    .slice(0, 500);

function SavedStatus() {
  const t = useTranslations('common.notifications');
  return <Text role="status">{t('saveSuccess')}</Text>;
}

const meta: Meta<typeof ProfileFormView> = {
  title: 'Feature/My/ProfileForm',
  component: ProfileFormView,
  render: function InteractiveStory(args) {
    const [, updateArgs] = useArgs();
    const [saved, setSaved] = useState(false);
    return (
      <>
        <ProfileFormView
          {...args}
          events={{
            ...args.events,
            onNicknameChange: () => {
              setSaved(false);
            },
            onSubmit: (values) => {
              updateArgs({
                initialValues: { uid: args.initialValues.uid, ...values },
                errors: {},
                savedRevision: (args.savedRevision ?? 0) + 1,
              });
              setSaved(true);
            },
          }}
        />
        {saved && <SavedStatus />}
      </>
    );
  },
  parameters: { layout: 'centered' },
  decorators: [
    withFeatureLabels({
      labels: {
        uid: 'profile.fields.uid',
        copyUid: 'common.actions.copy',
        copiedUid: 'common.actions.copied',
        nickname: 'nicknameField.label',
        nicknamePlaceholder: 'nicknameField.placeholder',
        bio: 'profile.fields.bio',
        bioPlaceholder: 'profile.placeholders.bio',
        website: 'common.labels.website',
        websitePlaceholder: 'common.placeholders.exampleUrl',
        socialLinks: 'socialLinks.label',
        addSocialLink: 'socialLinks.addLink',
        socialPlatform: 'socialLinks.platformPlaceholder',
        socialValue: 'socialLinks.valuePlaceholder',
        removeSocialLink: (t) => (position: number) =>
          `${t('common.actions.remove')} ${t('socialLinks.label')} ${position}`,
        reorderSocialLink: (t) => (position: number) =>
          `${t('common.actions.change')} ${t('socialLinks.label')} ${position}`,
        reorderInstructions: 'socialLinks.reorderInstructions',
        positionChanged: (t) => (position: number, count: number) =>
          t('socialLinks.positionChanged', { position, count }),
        submit: 'profile.actions.update',
      },
      project: (args, t) => ({
        errors: Object.fromEntries(
          Object.keys((args.errors as Record<string, string>) ?? {}).map((field) => [
            field,
            t(field === 'nickname' ? 'nicknameField.unavailable' : 'common.messages.failedToLoad'),
          ]),
        ),
      }),
    }),
    (Story) => (
      <div style={{ width: 640, maxWidth: '100%', padding: 'var(--geul-spacing-md)' }}>
        <Story />
      </div>
    ),
  ],
  args: {
    initialValues: populatedValues,
    labels,
    platformOptions,
    showExtendedFields: true,
    pending: false,
    disabled: false,
    errors: {},
    events: {
      onNicknameChange: () => {},
      onNormalizeSocialLink: (_platform, value) => value,
      onSubmit: () => {},
    },
  },
};

export default meta;
type Story = StoryObj<typeof ProfileFormView>;

export const Populated: Story = {};

export const LongValues: Story = {
  args: {
    initialValues: {
      uid: '22222222-2222-4222-8222-222222222222',
      nickname: 'Christopher Anderson',
      bio: longBio,
      website: 'https://archive.example.com/people/christopher-anderson/projects/long-running-collaborative-practice',
      socialLinks: [
        {
          key: '0',
          platform: 'instagram',
          value: 'https://instagram.com/christopher.anderson.long.profile.name',
        },
        {
          key: '1',
          platform: 'github',
          value: 'https://github.com/christopher-anderson-collective-and-research-archive',
        },
        {
          key: '2',
          platform: 'youtube',
          value: 'https://youtube.com/@christopher-anderson-audiovisual-archive',
        },
      ],
    },
  },
};

export const Submitting: Story = {
  args: {
    pending: true,
  },
};

export const ValidationError: Story = {
  args: {
    initialValues: {
      uid: '22222222-2222-4222-8222-222222222222',
      nickname: '',
      bio: 'Profile copy awaiting review.',
      website: 'not-a-valid-url',
      socialLinks: [{ key: '0', platform: '', value: 'missing-platform' }],
    },
    errors: {
      form: 'The profile could not be updated. Review the highlighted fields.',
      nickname: 'Nickname is required.',
      website: 'Enter a valid website URL.',
      socialLinks: 'Choose a platform for each social link.',
    },
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
  },
};
