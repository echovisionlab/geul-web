import { publicAccessibilityLabels } from '@/stories/shared/public-accessibility';
import { useArgs } from 'storybook/preview-api';
import { withFeatureLabels } from '@/stories/feature-localization';
import type { Meta, StoryObj } from '@storybook/nextjs';
import { expect, userEvent, waitFor, within } from 'storybook/test';

import { PageLoader } from '@/features/site/PageLoader';
import { Alert } from '@/components/core/Alert';
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
  copied: 'Copied',
  openInNewTab: 'Open in new tab',
  delete: 'Delete',
  copyAria: 'Copy share link',
  openAria: 'Open share link',
  deleteAria: 'Delete share link',
};

const meta = {
  title: 'Feature/Share/ShareLinkSectionView',
  component: ShareLinkSectionView,
  render: function InteractiveStory(args) {
    const [, updateArgs] = useArgs();
    return (
      <ShareLinkSectionView
        {...args}
        onToggleForm={() => updateArgs({ formOpened: !args.formOpened })}
        onCloseForm={() => updateArgs({ formOpened: false })}
        onLabelChange={(label) => updateArgs({ label })}
        onPresetChange={(preset) => updateArgs({ preset })}
        onCustomDateChange={(customDateTimestamp) => updateArgs({ customDateTimestamp })}
        onPasswordChange={(password) => updateArgs({ password })}
        onToggleShowAll={() => updateArgs({ showAll: !args.showAll })}
        onDelete={(id) =>
          updateArgs({ links: args.links.filter((link) => link.id !== id), totalLinkCount: args.totalLinkCount - 1 })
        }
        onCreate={() => {
          const id = crypto.randomUUID();
          const url = `${window.location.origin}/?path=/story/feature-share-sharepasswordview--interactive`;
          updateArgs({
            formOpened: false,
            label: '',
            password: '',
            links: [
              ...args.links,
              { id, label: args.label, displayUrl: url, openUrl: url, expired: false, badges: [] },
            ],
            totalLinkCount: args.totalLinkCount + 1,
          });
        }}
      />
    );
  },
  decorators: [
    withFeatureLabels({
      labels: {
        title: 'shareLinks.title',
        newLink: 'shareLinks.newLink',
        labelOptional: 'shareLinks.labelOptional',
        labelPlaceholder: 'shareLinks.labelPlaceholder',
        expiration: 'shareLinks.expiration',
        expiresAt: 'shareLinks.expiresAt',
        selectDateAndTime: 'common.placeholders.selectDateAndTime',
        passwordOptional: 'shareLinks.passwordOptional',
        passwordPlaceholder: 'shareLinks.passwordPlaceholder',
        passwordProtected: 'shareLinks.policies.passwordProtected',
        noPassword: 'shareLinks.policies.noPassword',
        maximumExpiration: 'shareLinks.maximumExpiration',
        cancel: 'common.actions.cancel',
        create: 'common.actions.create',
        noLinks: 'shareLinks.noLinks',
        showLess: 'shareLinks.showLess',
        showMore: { key: 'shareLinks.showMore', values: { count: 1 } },
        copied: 'common.actions.copied',
        openInNewTab: 'common.actions.openInNewTab',
        delete: 'common.actions.delete',
        copyAria: 'shareLinks.copyAria',
        openAria: 'shareLinks.openAria',
        deleteAria: 'shareLinks.deleteAria',
      },
      project: (args, t) => ({
        expirationOptions: (args.expirationOptions as { value: string; label: string }[]).map((option) => ({
          ...option,
          label: t(`shareLinks.presets.${option.value}`),
        })),
        links: (args.links as { badges: unknown[] }[]).map((link) => ({
          ...link,
          badges: [{ label: t('shareLinks.expirationBadge.daysLeft', { count: 7 }), tone: 'accent' }],
        })),
      }),
    }),
  ],
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
    expirationOptions: [
      { value: '7d', label: '7 days' },
      { value: 'custom', label: 'Custom' },
    ],
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
    loadingSurface: <PageLoader placement="flow" minHeight={140} size="sm" />,
    isCreating: false,
    deletingLinkId: null,
    onToggleForm: () => {},
    onCloseForm: () => {},
    onLabelChange: () => {},
    onPresetChange: () => {},
    onCustomDateChange: () => {},
    onPasswordChange: () => {},
    onCreate: () => {},
    onDelete: () => {},
    onToggleShowAll: () => {},
  },
} satisfies Meta<typeof ShareLinkSectionView>;

export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};

export const CreateLink: Story = { args: { formOpened: true } };
export const CreateLinkPending: Story = { args: { formOpened: true, isCreating: true } };
export const CreateLinkCustomDate: Story = {
  args: { formOpened: true, preset: 'custom', customDateTimestamp: Date.now() + 24 * 60 * 60 * 1000 },
};
export const Disabled: Story = { args: { disabled: true } };

export const CreateLinkNarrowViewport: Story = {
  args: { formOpened: true },
  globals: { viewport: { value: 'phone', isRotated: false } },
};

export const Empty: Story = { args: { links: [], totalLinkCount: 0 } };
export const EmptyPhone: Story = { ...Empty, globals: { viewport: { value: 'phone', isRotated: false } } };

export const KeyboardLinkManagement: Story = {
  tags: ['a11y-public'],
  play: async ({ canvasElement, globals }) => {
    const t = await publicAccessibilityLabels(globals);
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button', { name: t('shareLinks.newLink') });
    await userEvent.click(trigger);
    const label = await canvas.findByRole('textbox', { name: t('shareLinks.labelOptional') });
    await waitFor(() => expect(label).toHaveFocus());
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await expect(document.getElementById(trigger.getAttribute('aria-controls')!)).toHaveAttribute('role', 'group');
    await userEvent.type(label, 'Review copy');
    await userEvent.click(canvas.getByRole('button', { name: t('common.actions.cancel') }));
    await waitFor(() => expect(trigger).toHaveFocus());
    await waitFor(() => expect(trigger).toHaveAttribute('aria-expanded', 'false'));
    const copy = canvas.getByTestId('share-link-copy-one');
    await expect(document.getElementById(copy.getAttribute('aria-describedby')!)).toHaveTextContent(
      'https://studio.example.com/share/one',
    );
  },
};

export const InitialLoading: Story = { args: { isLoading: true, links: [], totalLinkCount: 0 } };
export const ListFailed: Story = {
  args: {
    links: [],
    totalLinkCount: 0,
    errorContent: (
      <Alert role="alert" tone="danger">
        Failed to load share links.
      </Alert>
    ),
  },
};
