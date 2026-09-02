import type { Meta, StoryObj } from '@storybook/nextjs';
import { Box } from '@mantine/core';

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

const meta: Meta<typeof ProfileFormView> = {
  title: 'Feature/My/ProfileForm',
  component: ProfileFormView,
  parameters: { layout: 'centered' },
  decorators: [
    (Story) => (
      <Box w={640} maw="calc(100vw - 2rem)" p="md">
        <Story />
      </Box>
    ),
  ],
  args: {
    initialValues: populatedValues,
    labels,
    platformOptions,
    showExtendedFields: true,
    pending: false,
    disabled: false,
    copied: false,
    errors: {},
    events: {
      onCopyUid: () => {},
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
