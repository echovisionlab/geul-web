import type { Meta, StoryObj } from '@storybook/nextjs';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CancelDeletionPageView } from '@/features/account/CancelDeletionPageView';
import { ConfirmDeletionPageView } from '@/features/account/ConfirmDeletionPageView';
import { ConfirmRecoveryPageView } from '@/features/account/ConfirmRecoveryPageView';
import { RecoverAccountContent } from '@/features/account/RecoverAccountContent';
import { UnsubscribeContent } from '@/features/newsletter/UnsubscribeContent';
import { expect, userEvent, waitFor, within } from 'storybook/test';
export function AccountLifecyclePagePreview({
  domain = 'recovery',
  state = 'success',
}: {
  domain?: 'recovery' | 'recovery-confirm' | 'deletion-confirm' | 'deletion-cancel' | 'unsubscribe';
  state?: 'success' | 'error' | 'invalid' | 'pending';
}) {
  const t = useTranslations('common');
  const [client] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } }),
  );
  const result = {
    success: state === 'success',
    message: t(state === 'success' ? 'statuses.applied' : 'messages.failedToLoad'),
    scheduledAt: new Date('2026-11-09T10:00:00Z'),
  };
  return (
    <QueryClientProvider client={client}>
      {domain === 'recovery' ? (
        <RecoverAccountContent
          requestAction={async (_previous, form) =>
            state === 'pending'
              ? new Promise(() => {})
              : {
                  success: state !== 'error',
                  message: state === 'error' ? t('messages.failedToLoad') : '',
                  submitted: true,
                  email: String(form.get('email') ?? ''),
                }
          }
        />
      ) : domain === 'unsubscribe' ? (
        <UnsubscribeContent
          token={state === 'invalid' ? null : 'local-token'}
          unsubscribeAction={async () =>
            state === 'pending'
              ? new Promise(() => {})
              : { success: state === 'success', message: t('statuses.applied') }
          }
        />
      ) : domain === 'deletion-confirm' ? (
        <ConfirmDeletionPageView hasToken={state !== 'invalid'} result={result} />
      ) : domain === 'deletion-cancel' ? (
        <CancelDeletionPageView hasToken={state !== 'invalid'} result={result} />
      ) : (
        <ConfirmRecoveryPageView hasToken={state !== 'invalid'} result={result} />
      )}
    </QueryClientProvider>
  );
}
const meta = {
  title: 'Pages/Account/Lifecycle',
  excludeStories: ['AccountLifecyclePagePreview'],
  component: AccountLifecyclePagePreview,
  args: { domain: 'recovery', state: 'success' },
  render: (args) => <AccountLifecyclePagePreview key={`${args.domain}-${args.state}`} {...args} />,
  parameters: {
    layout: 'fullscreen',
    nextjs: { appDirectory: true, navigation: { pathname: '/account/recover' } },
    docs: {
      description: {
        component:
          'Actual RecoverAccountContent and UnsubscribeContent controllers with local typed actions, plus exact confirmation/cancellation render trees extracted into production PageViews. Request/submitted/error/pending and token-invalid/success/failure displays. Tokens are fixture markers: backend token validation, delivery, actual account deletion/recovery/subscription persistence, metadata and route redirects are outside the preview.',
      },
    },
  },
} satisfies Meta<typeof AccountLifecyclePagePreview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const RecoveryRequest: Story = {};
export const RecoveryFailed: Story = { args: { state: 'error' } };
export const RecoveryPending: Story = { args: { state: 'pending' } };
export const RecoveryConfirmed: Story = { args: { domain: 'recovery-confirm' } };
export const RecoveryInvalid: Story = { args: { domain: 'recovery-confirm', state: 'invalid' } };
export const RecoveryConfirmFailed: Story = { args: { domain: 'recovery-confirm', state: 'error' } };
export const DeletionConfirmed: Story = { args: { domain: 'deletion-confirm' } };
export const DeletionInvalid: Story = { args: { domain: 'deletion-confirm', state: 'invalid' } };
export const DeletionConfirmFailed: Story = { args: { domain: 'deletion-confirm', state: 'error' } };
export const DeletionCancelled: Story = { args: { domain: 'deletion-cancel' } };
export const DeletionCancelInvalid: Story = { args: { domain: 'deletion-cancel', state: 'invalid' } };
export const DeletionCancelFailed: Story = { args: { domain: 'deletion-cancel', state: 'error' } };
export const Unsubscribed: Story = { args: { domain: 'unsubscribe' } };
export const UnsubscribeInvalid: Story = { args: { domain: 'unsubscribe', state: 'invalid' } };
export const UnsubscribeFailed: Story = { args: { domain: 'unsubscribe', state: 'error' } };
export const UnsubscribePending: Story = { args: { domain: 'unsubscribe', state: 'pending' } };
export const Phone: Story = { globals: { viewport: { value: 'phone', isRotated: false } } };
export const KeyboardRecoveryRequest: Story = {
  tags: ['a11y-account'],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const email = canvas.getByRole('textbox');
    await expect(email).toHaveAccessibleName();
    await expect(email).toHaveAccessibleDescription();
    email.focus();
    await userEvent.keyboard('reader@example.com{Enter}');
    await waitFor(() => expect(canvas.queryByRole('textbox')).toBeNull());
    await expect(canvas.getByRole('heading', { level: 1 })).toHaveFocus();
    await expect(canvas.getByRole('status')).toBeVisible();
    await expect(canvasElement).not.toHaveTextContent('reader@example.com');
  },
};
