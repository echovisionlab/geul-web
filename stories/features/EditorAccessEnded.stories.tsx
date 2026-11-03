import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { Meta, StoryObj } from '@storybook/nextjs';
import { expect, within } from 'storybook/test';
import { Button } from '@/components/core/Button';
import { ConfirmDialogHost } from '@/components/core/Modal/confirm-dialogs';
import { endProviderAccess, setProviderAccessLevel } from '@/lib/collab/provider-control-state';
import { AppNotificationRegion } from '@/lib/providers/AppNotificationRegion';
import { EditorNavigationProvider } from '@/lib/providers/EditorNavigationProvider';
import { confirmationDialogs } from '@/features/confirmation/confirmation-dialogs';

/** An editor room without its own interruption dialog loses access: the app-wide dialog blocks it. */
function AccessEndedPreview({ reason }: { reason: 'session_expired' | 'permission_revoked' }) {
  const [provider] = useState(() => ({}));
  useEffect(() => {
    endProviderAccess(provider, reason);
  }, [provider, reason]);
  return (
    <EditorNavigationProvider>
      <Button>Menu editor</Button>
    </EditorNavigationProvider>
  );
}

const meta: Meta<typeof AccessEndedPreview> = {
  title: 'Feature/Editor/Access Ended',
  component: AccessEndedPreview,
  parameters: { layout: 'fullscreen', nextjs: { appDirectory: true } },
};
export default meta;
type Story = StoryObj<typeof meta>;

export const SessionExpired: Story = {
  args: { reason: 'session_expired' },
  play: async ({ canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);
    await expect(await page.findByRole('alertdialog')).toBeInTheDocument();
  },
};

export const PermissionRevoked: Story = {
  args: { reason: 'permission_revoked' },
  play: async ({ canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);
    await expect(await page.findByRole('alertdialog')).toBeInTheDocument();
  },
};

/** Signing out would delete unsaved edits from this device: the shell asks first. */
function SignOutWithUnsavedEdits() {
  const t = useTranslations('common');
  useEffect(() => {
    confirmationDialogs.open({
      intent: 'discard',
      title: 'Sign out with unsaved edits?',
      message: 'Some edits have not been saved to the server. Signing out deletes them from this device.',
      confirmLabel: 'Sign out and discard',
      cancelLabel: 'Cancel',
      closeLabel: 'Close',
      onConfirm: () => undefined,
    });
  }, []);
  return (
    <ConfirmDialogHost
      loading="eager"
      loadError={{ message: t('errors.generic'), retryLabel: t('actions.tryAgain') }}
    />
  );
}

export const SignOutUnsaved: StoryObj<typeof SignOutWithUnsavedEdits> = {
  render: () => <SignOutWithUnsavedEdits />,
  play: async ({ canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);
    await expect(await page.findByRole('dialog')).toBeInTheDocument();
  },
};

/** Downgraded to view while open: the page stays readable, editing stops, a notice explains why. */
function DowngradedPreview() {
  const [provider] = useState(() => ({}));
  useEffect(() => {
    setProviderAccessLevel(provider, 'view');
  }, [provider]);
  return (
    <EditorNavigationProvider>
      <Button>Post editor (read-only)</Button>
      <AppNotificationRegion />
    </EditorNavigationProvider>
  );
}

export const DowngradedToView: StoryObj<typeof DowngradedPreview> = {
  render: () => <DowngradedPreview />,
  parameters: { nextjs: { appDirectory: true } },
  play: async ({ canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);
    await expect(await page.findByText(/view only|보기 전용/iu)).toBeInTheDocument();
    // A notice, not a blocking dialog: nothing obscures the page.
    await expect(canvasElement.ownerDocument.body.querySelector('[data-backdrop]')).toBeNull();
  },
};
