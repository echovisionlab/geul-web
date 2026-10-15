import type { Meta, StoryObj } from '@storybook/nextjs';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { LayoutContainer, LayoutStack } from '@/components/core/Layout';
import { Alert } from '@/components/core/Alert';
import { NicknameOnboarding } from '@/features/member/onboarding/NicknameOnboarding';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { accountAccessibilityLabels } from './AccountAccessibility';
export function OnboardingPagePreview({
  state = 'ready',
}: {
  state?: 'ready' | 'taken' | 'check-error' | 'submit-error' | 'pending';
}) {
  const t = useTranslations('common');
  const [complete, setComplete] = useState(false);
  const [logout, setLogout] = useState(false);
  return (
    <LayoutContainer size="compact">
      <LayoutStack gap="md" align="center">
        {complete || logout ? (
          <Alert tone="positive">{complete ? t('statuses.applied') : t('actions.logOut')}</Alert>
        ) : (
          <NicknameOnboarding
            initialNickname={state === 'taken' ? 'taken' : 'June Han'}
            checkAvailability={async (nickname) =>
              state === 'pending'
                ? new Promise(() => {})
                : state === 'check-error'
                  ? { error: 'local check failure' }
                  : { available: nickname.toLowerCase() !== 'taken' }
            }
            completeOnboarding={async (nickname) =>
              state === 'submit-error'
                ? { error: 'local submission failure' }
                : { onboarded: true, member: { id: 'local-member', nickname, avatarUrl: null, deleted: false } }
            }
            onCompleted={() => setComplete(true)}
            onLogout={() => setLogout(true)}
          />
        )}
      </LayoutStack>
    </LayoutContainer>
  );
}
const meta = {
  title: 'Pages/Auth/Nickname Onboarding',
  excludeStories: ['OnboardingPagePreview'],
  component: OnboardingPagePreview,
  args: { state: 'ready' },
  render: (args) => <OnboardingPagePreview key={args.state} {...args} />,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Actual NicknameOnboarding production controller and form. Debounced validation, unavailable/error/pending states, local completion and logout callbacks. Session lookup, server uniqueness, onboarding persistence and redirect are outside this adapter. Type taken to inspect the unavailable state.',
      },
    },
  },
} satisfies Meta<typeof OnboardingPagePreview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Ready: Story = {};
export const Taken: Story = { args: { state: 'taken' } };
export const CheckFailed: Story = { args: { state: 'check-error' } };
export const SubmitFailed: Story = { args: { state: 'submit-error' } };
export const Checking: Story = { args: { state: 'pending' } };
export const Phone: Story = { globals: { viewport: { value: 'phone', isRotated: false } } };
export const KeyboardValidation: Story = {
  tags: ['a11y-account'],
  play: async ({ canvasElement, globals }) => {
    const { common, nickname: nicknameLabels } = await accountAccessibilityLabels(globals);
    const canvas = within(canvasElement);
    const nickname = canvas.getByRole('textbox', { name: nicknameLabels('label') });
    nickname.focus();
    await userEvent.clear(nickname);
    await userEvent.keyboard('taken');
    await waitFor(() => expect(nickname).toHaveAttribute('aria-invalid', 'true'));
    await expect(nickname).toHaveAccessibleDescription(expect.stringContaining(nicknameLabels('unavailable')));
    await expect(canvas.getByRole('status')).toHaveAccessibleName(nicknameLabels('unavailable'));
    await expect(canvas.getByRole('button', { name: common('actions.continue') })).toBeDisabled();
    await userEvent.clear(nickname);
    await userEvent.keyboard('ReaderTest');
    await waitFor(() => expect(canvas.getByRole('button', { name: common('actions.continue') })).toBeEnabled());
    await expect(canvas.getByRole('status')).toHaveAccessibleName(nicknameLabels('available'));
    await userEvent.keyboard('{Enter}');
    await waitFor(() => expect(canvas.queryByRole('textbox')).toBeNull());
  },
};
