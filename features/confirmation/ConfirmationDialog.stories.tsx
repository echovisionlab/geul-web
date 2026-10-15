import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { localizedRender } from '@/.storybook/fixture-i18n';
import type { Meta, StoryObj } from '@storybook/nextjs';
import { Button } from '@/components/core/Button';
import { LayoutStack } from '@/components/core/Layout';
import { Text } from '@/components/core/Typography';
import { ConfirmationDialog, type ConfirmationDialogProps } from './ui/ConfirmationDialog';

const meta: Meta<typeof ConfirmationDialog> = {
  title: 'Feature/Confirmation/Dialog',
  component: ConfirmationDialog,
  parameters: { layout: 'centered' },
  render: localizedRender((args) => {
    const [opened, setOpened] = useState(args.opened);
    useEffect(() => setOpened(args.opened), [args.opened]);
    return (
      <>
        {!opened && <Button onClick={() => setOpened(true)}>{args.title}</Button>}
        <ConfirmationDialog
          {...args}
          opened={opened}
          onClose={() => setOpened(false)}
          onConfirm={() => setOpened(false)}
        />
      </>
    );
  }),
  args: {
    intent: 'delete',
    opened: true,
    title: 'Delete release',
    message: 'This action removes the release and its related links.',
    confirmLabel: 'Delete',
    cancelLabel: 'Cancel',
    closeLabel: 'Close',
    onClose: () => {},
    onConfirm: () => {},
  },
};
export default meta;
type Story = StoryObj<typeof ConfirmationDialog>;

export const Delete: Story = {};
export const Discard: Story = { args: { intent: 'discard', title: 'Discard changes', confirmLabel: 'Discard' } };
export const Revoke: Story = { args: { intent: 'revoke', title: 'Revoke access', confirmLabel: 'Revoke' } };
export const Archive: Story = { args: { intent: 'archive', title: 'Archive segment', confirmLabel: 'Archive' } };
export const Restore: Story = { args: { intent: 'restore', title: 'Restore version', confirmLabel: 'Restore' } };
export const Regenerate: Story = {
  args: {
    intent: 'regenerate',
    title: 'Regenerate token',
    message: 'The existing token will stop working.',
    confirmLabel: 'Regenerate',
  },
};
export const Neutral: Story = { args: { intent: 'confirm', title: 'Change source locale', confirmLabel: 'Confirm' } };
export const Loading: Story = { args: { loading: true } };
export const Blocked: Story = {
  args: { confirmDisabled: true, message: 'This file is still used by a published page. Remove its references first.' },
};

function InteractivePreview(args: ConfirmationDialogProps) {
  const actions = useTranslations('common.actions');
  const messages = useTranslations('common.messages');
  const [opened, setOpened] = useState(true);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState('');
  return (
    <LayoutStack>
      <Button
        onClick={() => {
          setResult('');
          setOpened(true);
        }}
      >
        {actions('delete')}
      </Button>
      {result ? <Text role="status">{result}</Text> : null}
      <ConfirmationDialog
        {...args}
        opened={opened}
        loading={pending}
        title={actions('delete')}
        confirmLabel={actions('delete')}
        cancelLabel={actions('cancel')}
        closeLabel={actions('close')}
        message={messages('deleteNamedItemConfirm', { name: 'Sample release' })}
        onClose={() => setOpened(false)}
        onConfirm={async () => {
          setPending(true);
          await new Promise((resolve) => setTimeout(resolve, 800));
          setPending(false);
          setOpened(false);
          setResult(messages('itemDeleted', { item: 'Sample release' }));
        }}
      />
    </LayoutStack>
  );
}
export const Interactive: Story = { render: (args) => <InteractivePreview {...args} /> };

/** The controlled caller owns its deferred result, failure message and pending lifecycle. */
function RetryPreview(args: ConfirmationDialogProps) {
  const [opened, setOpened] = useState(true);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const attempt = useRef(0);
  const inFlight = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  return (
    <>
      {!opened && (
        <Button
          onClick={() => {
            setOpened(true);
            setFailed(false);
            attempt.current = 0;
          }}
        >
          {args.title}
        </Button>
      )}
      <ConfirmationDialog
        {...args}
        opened={opened}
        loading={pending}
        message={
          <LayoutStack gap="xs">
            {args.message}
            {failed && <Text role="alert">The operation failed. Try again.</Text>}
          </LayoutStack>
        }
        onClose={() => setOpened(false)}
        onConfirm={() => {
          if (inFlight.current) {
            return;
          }
          inFlight.current = true;
          setPending(true);
          setFailed(false);
          timer.current = setTimeout(() => {
            inFlight.current = false;
            setPending(false);
            attempt.current += 1;
            if (attempt.current === 1) {
              setFailed(true);
            } else {
              setOpened(false);
            }
          }, 500);
        }}
      />
    </>
  );
}
export const FailureAndRetry: Story = { render: localizedRender((args) => <RetryPreview {...args} />) };
