import type { Meta, StoryObj } from '@storybook/nextjs';

import { ShareLinkSectionView } from './ShareLinkSectionView';

const labels = {
  title: 'Share links',
  newLink: 'New link',
  labelOptional: 'Label (optional)',
  labelPlaceholder: 'Preview link',
  expiration: 'Expiration',
  expiresAt: 'Expires at',
  selectDateAndTime: 'Select date and time',
  passwordOptional: 'Password (optional)',
  passwordPlaceholder: 'Set a password',
  passwordProtected: 'Password protected',
  noPassword: 'No password',
  maximumExpiration: 'Links expire within one year.',
  cancel: 'Cancel',
  create: 'Create',
  noLinks: 'No links',
  showLess: 'Show less',
  showMore: 'Show more',
  copy: 'Copy',
  openInNewTab: 'Open in new tab',
  delete: 'Delete',
  copyAria: 'Copy share link',
  openAria: 'Open share link',
  deleteAria: 'Delete share link',
};

const meta = {
  title: 'Feature/Share/ShareLinkSectionView',
  component: ShareLinkSectionView,
  args: {
    labels,
    links: [
      {
        id: 'one',
        label: 'Review',
        displayUrl: 'https://studio.example.com/share/one',
        openUrl: 'https://studio.example.com/share/one',
        expired: false,
        badges: [{ label: '7d left', tone: 'accent' }],
      },
    ],
    totalLinkCount: 1,
    expirationOptions: [{ value: '7d', label: '7 days' }],
    formOpened: false,
    hydrated: true,
    label: '',
    preset: '7d',
    customDateTimestamp: null,
    maxDateTimestamp: Date.now() + 365 * 24 * 60 * 60 * 1000,
    password: '',
    hasMore: false,
    showAll: false,
    isLoading: false,
    isCreating: false,
    deletingLinkId: null,
    onToggleForm: () => {},
    onCloseForm: () => {},
    onLabelChange: () => {},
    onPresetChange: () => {},
    onCustomDateChange: () => {},
    onPasswordChange: () => {},
    onCreate: () => {},
    onCopy: () => {},
    onDelete: () => {},
    onToggleShowAll: () => {},
  },
} satisfies Meta<typeof ShareLinkSectionView>;

export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
