import { publicAccessibilityLabels } from '@/stories/shared/public-accessibility';
import { useTranslations } from 'next-intl';
import { useArgs } from 'storybook/preview-api';
import { navigatePreview } from '@/stories/shared/preview-navigation';
import { withFeatureLabels } from '@/stories/feature-localization';
import type { Meta, StoryObj } from '@storybook/nextjs';
import { expect, userEvent, waitFor, within } from 'storybook/test';

import { SharePasswordView, type SharePasswordViewProps } from './SharePasswordView';

function PasswordFormFixture({
  args,
  updateArgs,
  destination,
}: {
  args: SharePasswordViewProps;
  updateArgs: (args: Partial<SharePasswordViewProps>) => void;
  destination: string;
}) {
  const t = useTranslations('pageShareAccess.errors');
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (args.password !== 'preview') {
          updateArgs({ error: t('incorrect_password') });
          return;
        }
        navigatePreview(destination);
      }}
    >
      <SharePasswordView {...args} onPasswordChange={(password) => updateArgs({ password, error: undefined })} />
    </form>
  );
}

const meta = {
  title: 'Feature/Share/SharePasswordView',
  component: SharePasswordView,
  render: function PasswordForm(args, { id }) {
    const [, updateArgs] = useArgs();
    return (
      <PasswordFormFixture
        args={args}
        updateArgs={updateArgs}
        destination={id.endsWith('--release') ? '/releases/sample' : '/'}
      />
    );
  },
  decorators: [
    withFeatureLabels({
      labels: {
        title: 'pageShareAccess.title',
        description: 'pageShareAccess.description',
        password: 'pageShareAccess.password',
        submit: 'pageShareAccess.submit',
      },
      project: (args, t) => ({
        error: args.error ? t('pageShareAccess.errors.incorrect_password') : args.error,
        labels: {
          ...(args.labels as Record<string, unknown>),
          title: t('pageShareAccess.title'),
          description: t('pageShareAccess.description'),
          password: t('pageShareAccess.password'),
          submit: t(
            (args.labels as { submit?: string })?.submit === 'Open release'
              ? 'releaseShareAccess.submit'
              : 'pageShareAccess.submit',
          ),
        },
      }),
    }),
  ],
  args: {
    pending: false,
    labels: {
      title: 'Password required',
      description: 'Enter the password supplied with this share link.',
      password: 'Password',
      submit: 'Open page',
    },
  },
} satisfies Meta<typeof SharePasswordView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Interactive: Story = {
  args: { password: '', onPasswordChange: () => {} },
};

export const IncorrectPassword: Story = {
  args: {
    password: 'wrong',
    onPasswordChange: () => {},
    error: 'Incorrect password.',
  },
};

export const Release: Story = {
  args: {
    password: '',
    onPasswordChange: () => {},
    labels: {
      ...meta.args.labels,
      submit: 'Open release',
    },
  },
};

export const KeyboardErrorRecovery: Story = {
  tags: ['a11y-public'],
  args: { password: '', onPasswordChange: () => {} },
  play: async ({ canvasElement, globals }) => {
    const t = await publicAccessibilityLabels(globals);
    const canvas = within(canvasElement);
    const input = canvasElement.querySelector<HTMLInputElement>('input[name="password"]')!;
    await expect(input).toHaveAccessibleName(t('pageShareAccess.password'));
    await userEvent.type(input, 'wrong');
    await userEvent.keyboard('{Enter}');
    await waitFor(() => expect(input).toHaveAttribute('aria-invalid', 'true'));
    await waitFor(() => expect(input).toHaveFocus());
    await expect(canvas.getByRole('button', { name: t('pageShareAccess.submit') })).toBeEnabled();
    await userEvent.clear(input);
    await userEvent.type(input, 'preview');
    await waitFor(() => expect(input).not.toHaveAttribute('aria-invalid', 'true'));
  },
};
