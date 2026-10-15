'use client';
import { SupportingText, Text as DsText } from '@/components/core/Typography';

import { LayoutStack as DsLayoutStack } from '@/components/core/Layout';

import { IconAlertCircle, IconSend } from '@tabler/icons-react';

import { Alert } from '@/components/core/Alert';
import { Button } from '@/components/core/Button';
import { TextInput, type DateTimeValue } from '@/components/core/Input';
import { ContentModal, DialogActions } from '@/components/core/Modal';
import { CampaignScheduleForm } from './CampaignScheduleForm';
import { TranslationLocaleControl } from '@/features/translation/TranslationLocaleControl';
import type { TranslationLocaleSelectOption } from '@/features/translation/locale-option-format';

interface CommonLabels {
  close: string;
  cancel: string;
  language: string;
}

interface TestDialogProps {
  opened: boolean;
  email: string;
  locale: string;
  localeOptions: readonly TranslationLocaleSelectOption[];
  sourceLocale: string | null;
  selectedLocale: string;
  pending: boolean;
  labels: {
    title: string;
    description: string;
    email: string;
    emailPlaceholder: string;
    send: string;
  };
  onClose: () => void;
  onEmailChange: (email: string) => void;
  onLocaleChange: (locale: string) => void;
  onSend: () => void;
}

interface SendDialogProps {
  opened: boolean;
  includesUnsubscribedUsers: boolean;
  pending: boolean;
  labels: {
    title: string;
    warning: string;
    subject: string;
    allMatchingUsersWarning: string;
    send: string;
  };
  onClose: () => void;
  onSend: () => void;
}

interface ScheduleDialogProps {
  opened: boolean;
  locale: string;
  value: DateTimeValue;
  minDate: DateTimeValue;
  audience: string;
  includesUnsubscribedUsers: boolean;
  pending: boolean;
  labels: {
    title: string;
    description: string;
    date: string;
    time: string;
    previousMonth: string;
    nextMonth: string;
    hours: string;
    minutes: string;
    audience: string;
    allMatchingUsersWarning: string;
    schedule: string;
  };
  onClose: () => void;
  onChange: (value: DateTimeValue) => void;
  onSchedule: () => void;
}

interface Props {
  readOnly?: boolean;
  commonLabels: CommonLabels;
  testDialog: TestDialogProps;
  sendDialog: SendDialogProps;
  scheduleDialog: ScheduleDialogProps;
}

export function CampaignDeliveryDialogs({
  commonLabels,
  testDialog,
  sendDialog,
  scheduleDialog,
  readOnly = false,
}: Props) {
  return (
    <>
      <ContentModal
        opened={testDialog.opened}
        onClose={testDialog.onClose}
        title={testDialog.labels.title}
        closeLabel={commonLabels.close}
        size="standard"
      >
        <DsLayoutStack>
          <SupportingText tone="secondary">{testDialog.labels.description}</SupportingText>
          <TextInput
            disabled={readOnly}
            label={testDialog.labels.email}
            placeholder={testDialog.labels.emailPlaceholder}
            value={testDialog.email}
            onChange={(event) => testDialog.onEmailChange(event.currentTarget.value)}
            type="email"
          />
          <TranslationLocaleControl
            disabled={readOnly}
            variant="select"
            label={commonLabels.language}
            value={testDialog.locale}
            options={testDialog.localeOptions}
            sourceLocale={testDialog.sourceLocale}
            onChange={(value) => testDialog.onLocaleChange(value ?? testDialog.selectedLocale)}
          />
          <DialogActions>
            <Button emphasis="low" onClick={testDialog.onClose}>
              {commonLabels.cancel}
            </Button>
            <Button
              emphasis="strong"
              onClick={testDialog.onSend}
              loading={testDialog.pending}
              disabled={readOnly || !testDialog.email}
            >
              {testDialog.labels.send}
            </Button>
          </DialogActions>
        </DsLayoutStack>
      </ContentModal>

      <ContentModal
        opened={sendDialog.opened}
        onClose={sendDialog.onClose}
        title={sendDialog.labels.title}
        closeLabel={commonLabels.close}
        size="standard"
      >
        <DsLayoutStack>
          <Alert icon={<IconAlertCircle size={16} />} tone="warning">
            {sendDialog.labels.warning}
          </Alert>
          <DsText>{sendDialog.labels.subject}</DsText>
          {sendDialog.includesUnsubscribedUsers ? (
            <Alert icon={<IconAlertCircle size={16} />} tone="warning">
              {sendDialog.labels.allMatchingUsersWarning}
            </Alert>
          ) : null}
          <DialogActions>
            <Button emphasis="low" onClick={sendDialog.onClose}>
              {commonLabels.cancel}
            </Button>
            <Button
              emphasis="strong"
              tone="positive"
              disabled={readOnly}
              onClick={sendDialog.onSend}
              loading={sendDialog.pending}
              leftSection={<IconSend size={16} />}
            >
              {sendDialog.labels.send}
            </Button>
          </DialogActions>
        </DsLayoutStack>
      </ContentModal>

      <ContentModal
        opened={scheduleDialog.opened}
        onClose={scheduleDialog.onClose}
        title={scheduleDialog.labels.title}
        closeLabel={commonLabels.close}
        size="standard"
      >
        <CampaignScheduleForm
          locale={scheduleDialog.locale}
          value={scheduleDialog.value}
          minDate={scheduleDialog.minDate}
          audience={scheduleDialog.audience}
          includesUnsubscribedUsers={scheduleDialog.includesUnsubscribedUsers}
          labels={{
            description: scheduleDialog.labels.description,
            date: scheduleDialog.labels.date,
            time: scheduleDialog.labels.time,
            previousMonth: scheduleDialog.labels.previousMonth,
            nextMonth: scheduleDialog.labels.nextMonth,
            hours: scheduleDialog.labels.hours,
            minutes: scheduleDialog.labels.minutes,
            audience: scheduleDialog.labels.audience,
            allMatchingUsersWarning: scheduleDialog.labels.allMatchingUsersWarning,
            cancel: commonLabels.cancel,
            schedule: scheduleDialog.labels.schedule,
          }}
          disabled={readOnly}
          loading={scheduleDialog.pending}
          onChange={scheduleDialog.onChange}
          onCancel={scheduleDialog.onClose}
          onSchedule={scheduleDialog.onSchedule}
        />
      </ContentModal>
    </>
  );
}
