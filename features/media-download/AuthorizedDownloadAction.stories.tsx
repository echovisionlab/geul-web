import { useMemo } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs';
import { expect, fn, userEvent, within } from 'storybook/test';
import {
  FileDownloadAction,
  FileDownloadAvailability,
  PublicMediaEntityType,
} from '@echovisionlab/geul-proto/public/file_pb.ts';
import { AuthorizedDownloadAction, type AuthorizedDownloadActionProps } from './AuthorizedDownloadAction';

const available = {
  access: { availability: FileDownloadAvailability.AVAILABLE, action: FileDownloadAction.DOWNLOAD },
  download: { url: '/storybook-fixtures/media-control-preview.wav' },
};
const meta = {
  title: 'Feature/Media/Authorized Download',
  component: AuthorizedDownloadAction,
  parameters: { layout: 'padded' },
  args: {
    entityType: PublicMediaEntityType.POST,
    entityId: 'post-1',
    selector: { blockId: 'recording', referencePath: 'file' },
    fileName: 'field-recording.wav',
    title: 'Field recording',
    availability: FileDownloadAvailability.AVAILABLE,
    action: FileDownloadAction.DOWNLOAD,
    authorize: fn(async () => available),
    navigate: fn(),
  },
} satisfies Meta<typeof AuthorizedDownloadAction>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Available: Story = {};
export const SignIn: Story = { args: { action: FileDownloadAction.SIGN_IN, returnTo: '/posts/field-recording' } };
export const Unavailable: Story = {
  args: { availability: FileDownloadAvailability.UNAVAILABLE, action: FileDownloadAction.NONE },
};
function RetryPreview(props: AuthorizedDownloadActionProps) {
  const authorize = useMemo(() => {
    let attempts = 0;
    return async () => {
      attempts += 1;
      if (attempts === 1) {
        throw new Error('Fixture connection failure');
      }
      return available;
    };
  }, []);
  return <AuthorizedDownloadAction {...props} authorize={authorize} />;
}
export const KeyboardRetry: Story = {
  render: (args) => <RetryPreview {...args} />,
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button');
    const text = button.textContent;
    const name = button.getAttribute('aria-label');
    await step('Authorize and recover from failure through the same named control', async () => {
      button.focus();
      await userEvent.keyboard('{Enter}');
      const failure = await canvas.findByRole('alert');
      await expect(button).toHaveAttribute('aria-describedby', failure.id);
      await expect(button.textContent).toBe(text);
      await expect(button).toHaveAttribute('aria-label', name!);
      await userEvent.keyboard('{Enter}');
      await expect(canvas.queryByRole('alert')).not.toBeInTheDocument();
      await expect(button).toHaveFocus();
    });
  },
};
