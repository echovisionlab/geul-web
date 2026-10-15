import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs';
import { useLocale, useTranslations } from 'next-intl';
import { LayoutContainer, LayoutStack } from '@/components/core/Layout';
import { Alert } from '@/components/core/Alert';
import { CampaignTargetMode } from '@echovisionlab/geul-proto/secure/campaign_pb.ts';
import type { CampaignRecipientScope } from '@echovisionlab/geul-common/collaboration/campaign';
import { CampaignScheduleForm } from '@/features/campaign/CampaignScheduleForm';
import { CampaignRecipientScopeControl } from '@/features/campaign/CampaignRecipientScopeControl';
import { CampaignTargetControl, type CampaignTargetSelection } from '@/features/campaign/CampaignTargetControl';
import type { DateTimeValue } from '@/components/core/Input';
function DeliveryPreview({
  surface = 'audience',
  state = 'ready',
}: {
  surface?: 'audience' | 'schedule';
  state?: 'ready' | 'all-matching' | 'unavailable' | 'error' | 'pending';
}) {
  const locale = useLocale();
  const t = useTranslations('campaignEditor');
  const labels = useTranslations('common.labels');
  const actions = useTranslations('common.actions');
  const messages = useTranslations('common.notifications');
  const [scope, setScope] = useState<CampaignRecipientScope>(
    state === 'all-matching' ? 'ALL_MATCHING_USERS' : 'SUBSCRIBED_USERS',
  );
  const [target, setTarget] = useState<CampaignTargetSelection>({
    targetMode: state === 'unavailable' ? CampaignTargetMode.SEGMENT : CampaignTargetMode.ALL,
    segmentId: state === 'unavailable' ? 'removed-audience' : null,
  });
  const [date, setDate] = useState<DateTimeValue>({ date: '2026-10-18', time: '09:00' });
  const [submitted, setSubmitted] = useState(false);
  return (
    <LayoutContainer size="compact" inset="md">
      <LayoutStack gap="sm">
        {surface === 'audience' ? (
          <>
            <CampaignTargetControl
              {...target}
              audiences={[{ id: 'room', name: 'Listening room', segmentTypeLabel: labels('members') }]}
              loadError={state === 'error'}
              disabled={state === 'pending'}
              onChange={setTarget}
            />
            <CampaignRecipientScopeControl
              value={scope}
              onChange={setScope}
              disabled={state === 'pending'}
              labels={{
                field: t('fields.recipientScope'),
                subscribedUsers: t('fields.recipientScopeSubscribedUsers'),
                allMatchingUsers: t('fields.recipientScopeAllMatchingUsers'),
                allMatchingUsersWarning: t('fields.recipientScopeAllMatchingUsersWarning'),
              }}
            />
          </>
        ) : (
          <CampaignScheduleForm
            locale={locale}
            value={date}
            minDate={{ date: '2026-10-11', time: '00:00' }}
            audience="Listening room"
            includesUnsubscribedUsers={state === 'all-matching'}
            loading={state === 'pending'}
            onChange={setDate}
            onCancel={() => setSubmitted(false)}
            onSchedule={() => setSubmitted(true)}
            labels={{
              description: t('scheduleModal.description'),
              date: t('scheduleModal.dateLabel'),
              time: labels('time'),
              previousMonth: t('scheduleModal.previousMonth'),
              nextMonth: t('scheduleModal.nextMonth'),
              hours: labels('hours'),
              minutes: labels('minutes'),
              audience: t('scheduleModal.audience', { audience: '{audience}' }),
              allMatchingUsersWarning: t('scheduleModal.allMatchingUsersWarning'),
              cancel: actions('cancel'),
              schedule: t('actions.scheduleCampaign'),
            }}
          />
        )}
        {submitted && (
          <Alert tone="positive" role="status">
            {messages('saveSuccess')}
          </Alert>
        )}
      </LayoutStack>
    </LayoutContainer>
  );
}
const meta = {
  title: 'Feature/Campaign/Delivery Controls',
  component: DeliveryPreview,
  args: { surface: 'audience', state: 'ready' },
  parameters: {
    docs: {
      description: {
        component:
          'Production campaign target, recipient scope and scheduling controls with local selections. Active/unavailable audiences, read error, pending and all-matching warning. Local scheduling feedback only; this is not a campaign page preview and never sends or schedules email.',
      },
    },
  },
  decorators: [(Story, context) => <Story key={`${context.args.surface}:${context.args.state}`} />],
} satisfies Meta<typeof DeliveryPreview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Audience: Story = {};
export const AllMatching: Story = { args: { state: 'all-matching' } };
export const Unavailable: Story = { args: { state: 'unavailable' } };
export const Failed: Story = { args: { state: 'error' } };
export const Pending: Story = { args: { state: 'pending' } };
export const Schedule: Story = { args: { surface: 'schedule' } };
export const ScheduleWarning: Story = { args: { surface: 'schedule', state: 'all-matching' } };
export const Phone: Story = {
  args: { surface: 'schedule' },
  globals: { viewport: { value: 'phone', isRotated: false } },
};
