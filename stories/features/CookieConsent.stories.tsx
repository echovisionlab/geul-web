import { useEffect, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs';
import { expect, userEvent, within } from 'storybook/test';
import { useTranslations } from 'next-intl';
import { Text } from '@/components/core/Typography';
import { CookieConsentBannerView } from '@/features/cookie-consent/ui/CookieConsentBannerView';

function ConsentPreview({
  renewal = false,
  initialAnalytics = false,
}: {
  renewal?: boolean;
  initialAnalytics?: boolean;
}) {
  const t = useTranslations('cookieConsentBanner');
  const labels = useTranslations('cookieConsentCommon');
  const actions = useTranslations('common.actions');
  const entities = useTranslations('common.entities');
  const [isOpen, setOpen] = useState(true);
  const [savedAnalytics, setSavedAnalytics] = useState<boolean | null>(null);

  useEffect(() => {
    setOpen(true);
    setSavedAnalytics(null);
  }, [renewal, initialAnalytics]);

  const saveFixtureChoice = (analytics: boolean) => {
    setSavedAnalytics(analytics);
    setOpen(false);
  };

  return (
    <>
      {savedAnalytics !== null && (
        <Text role="status" data-testid="cookie-consent-fixture-result" data-analytics-consent={savedAnalytics}>
          {`Local fixture choice: analytics ${savedAnalytics ? 'enabled' : 'disabled'}. No browser cookie or account request was written.`}
        </Text>
      )}
      <CookieConsentBannerView
        model={{
          isOpen,
          requiresRenewal: renewal,
          labels: {
            renewalNotice: t('renewalNotice'),
            intro: t('intro'),
            rejectNonEssential: actions('rejectNonEssential'),
            analytics: labels('analyticsLabel'),
            acceptAll: actions('acceptAll'),
          },
          learnMore: [
            { text: entities('privacy'), href: '/privacy' },
            { text: ' · ' },
            { text: entities('terms'), href: '/terms' },
          ],
        }}
        onRejectNonEssential={() => saveFixtureChoice(false)}
        onAcceptAll={() => saveFixtureChoice(true)}
      />
    </>
  );
}

const meta = {
  title: 'Feature/Cookie Consent/Banner',
  component: ConsentPreview,
  args: { renewal: false, initialAnalytics: false },
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Production banner View with one disclosed optional Google Analytics category and two compact text-button decisions. Reject saves analytics=false; Accept all saves analytics=true. Both choices are equally available on the first layer with shared xs control targets. No analytics is enabled before an explicit decision. Renewal requires a fresh decision. Local fixture callbacks only: no cookie/account persistence or analytics loading. See the cookie consent contract in the Handbook for integration and failure boundaries.',
      },
    },
  },
} satisfies Meta<typeof ConsentPreview>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Initial: Story = {};
export const Preferences: Story = {
  args: { initialAnalytics: true },
  parameters: {
    docs: {
      description: {
        story: 'Explicitly reopened consent prompt; both acceptance and rejection remain directly available.',
      },
    },
  },
};
export const Renewal: Story = { args: { renewal: true, initialAnalytics: true } };
export const Phone: Story = { globals: { viewport: { value: 'phone', isRotated: false } } };

export const RejectAnalytics: Story = {
  tags: ['a11y-cookie'],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByRole('switch')).toBeNull();
    await expect(canvas.queryByTestId('cookie-consent-fixture-result')).toBeNull();
    await userEvent.click(canvasElement.querySelector<HTMLButtonElement>('#cookie-consent-reject-non-essential')!);
    await expect(canvas.getByTestId('cookie-consent-fixture-result')).toHaveAttribute(
      'data-analytics-consent',
      'false',
    );
  },
};

export const AcceptAnalytics: Story = {
  tags: ['a11y-cookie'],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByTestId('cookie-consent-fixture-result')).toBeNull();
    await userEvent.click(canvas.getByTestId('cookie-consent-accept-all'));
    await expect(canvas.getByTestId('cookie-consent-fixture-result')).toHaveAttribute('data-analytics-consent', 'true');
  },
};

export const RejectPreviousConsent: Story = {
  args: { initialAnalytics: true, renewal: true },
  tags: ['a11y-cookie'],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId('cookie-consent-renewal-notice')).toBeVisible();
    await userEvent.click(canvasElement.querySelector<HTMLButtonElement>('#cookie-consent-reject-non-essential')!);
    await expect(canvas.getByTestId('cookie-consent-fixture-result')).toHaveAttribute(
      'data-analytics-consent',
      'false',
    );
  },
};
