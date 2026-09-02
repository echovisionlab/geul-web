import type { Meta, StoryObj } from '@storybook/nextjs';
import { Box, Stack, Text } from '@mantine/core';
import { LabelBadge } from '@/components/core/Badge';
import { ProfileAvatarControl } from './ProfileAvatarControl';

const demoAvatar =
  'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"%3E%3Crect width="256" height="256" fill="%23547985"/%3E%3Ccircle cx="128" cy="91" r="51" fill="%23d9b59a"/%3E%3C/svg%3E';
const labels = {
  alt: 'johndoe',
  upload: 'Upload profile image',
  change: 'Change profile image',
  remove: 'Remove profile image',
  cropTitle: 'Crop profile image',
  cropPreview: 'Profile image crop preview',
  cancel: 'Cancel',
  confirm: 'Confirm',
  preparing: 'Preparing image',
};

const meta = {
  title: 'Feature/User/ProfileAvatarControl',
  component: ProfileAvatarControl,
  parameters: { layout: 'centered' },
  decorators: [
    (Story) => (
      <Box w={420} p="xl">
        <Stack align="center" gap="md">
          <Story />
          <Stack gap={4} align="center">
            <Text size="lg" fw={500}>
              johndoe
            </Text>
            <LabelBadge tone="danger">Admin</LabelBadge>
          </Stack>
        </Stack>
      </Box>
    ),
  ],
  args: {
    imageUrl: null,
    size: 80,
    accept: ['image/jpeg', 'image/png', 'image/webp', 'image/avif'],
    maxSize: 20 * 1024 * 1024,
    labels,
    onSave: async () => true,
    onRemove: async () => true,
  },
} satisfies Meta<typeof ProfileAvatarControl>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Empty: Story = {};
export const WithImage: Story = { args: { imageUrl: demoAvatar } };
