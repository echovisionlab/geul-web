import type { Meta, StoryObj } from '@storybook/nextjs';
import { useTranslations } from 'next-intl';
import { SupportingText } from './SupportingText';
import { LayoutStack } from '../Layout';
function DescriptionPreview() {
  const t = useTranslations('settings.newsletter');
  return <SupportingText>{t('footer')}</SupportingText>;
}
function StatesPreview() {
  const t = useTranslations('common');
  return (
    <LayoutStack gap="xs">
      <SupportingText>{t('messages.noPostsFound')}</SupportingText>
      <SupportingText role="status" aria-live="polite">
        {t('states.loading')}
      </SupportingText>
      <SupportingText role="status" tone="positive">
        {t('notifications.saveSuccess')}
      </SupportingText>
      <SupportingText role="alert" tone="danger">
        {t('errors.generic')}
      </SupportingText>
    </LayoutStack>
  );
}
const meta = {
  title: 'Core/Typography/SupportingText',
  component: SupportingText,
  render: () => <DescriptionPreview />,
} satisfies Meta<typeof SupportingText>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Description: Story = {};
export const States: Story = { render: () => <StatesPreview /> };
