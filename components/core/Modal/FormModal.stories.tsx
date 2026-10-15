import { useState } from 'react';
import { Button } from '../Button';
import { ModalPreview } from '@/stories/shared/ControlPreviews';
import { previewStateControl } from '@/stories/shared/PreviewFrame';
import { Text as DsText } from '@/components/core/Typography';
import { localizedRender } from '@/.storybook/fixture-i18n';
import type { Meta, StoryObj } from '@storybook/nextjs';
import { TextInput } from '../Input';
import { FormModal } from './FormModal';
interface PreviewArgs {
  onClose: () => void;
  onSubmit: () => void;
  loading?: boolean;
  submitDisabled?: boolean;
}
const meta: Meta<PreviewArgs> = {
  title: 'Core/Overlays/FormModal',
  parameters: { layout: 'centered' },
  args: { onClose: () => {}, onSubmit: () => {} },
};
export default meta;
type Story = StoryObj<PreviewArgs>;

export const Form: Story = {
  render: localizedRender(({ loading, submitDisabled }) => {
    const [opened, setOpened] = useState(true);
    const [title, setTitle] = useState('Field recordings');
    const [savedTitle, setSavedTitle] = useState('Field recordings');
    return (
      <>
        {!opened && (
          <Button
            onClick={() => {
              setTitle(savedTitle);
              setOpened(true);
            }}
          >
            {savedTitle}
          </Button>
        )}
        <FormModal
          opened={opened}
          onClose={() => setOpened(false)}
          onSubmit={() => {
            setSavedTitle(title);
            setOpened(false);
          }}
          title="Edit release"
          submitLabel="Save"
          cancelLabel="Cancel"
          closeLabel="Close dialog"
          size="large"
          loading={loading}
          submitDisabled={submitDisabled || !title.trim()}
        >
          <DsText size="sm">Update the display title.</DsText>
          <TextInput label="Release title" value={title} onChange={(event) => setTitle(event.currentTarget.value)} />
        </FormModal>
      </>
    );
  }),
};

export const Loading: Story = { ...Form, args: { loading: true } };
export const Disabled: Story = { ...Form, args: { submitDisabled: true } };

// Stateful examples share this component's catalog entry with its fixed states.
type PlaygroundStory = StoryObj<typeof ModalPreview>;
export const Playground: PlaygroundStory = {
  render: (args) => <ModalPreview {...args} />,
  args: { state: 'ready' },
  argTypes: { state: previewStateControl },
  parameters: { layout: 'fullscreen', canvasInset: 'none' },
};
export const PlaygroundPending: PlaygroundStory = { ...Playground, args: { ...Playground.args, state: 'pending' } };
export const PlaygroundError: PlaygroundStory = { ...Playground, args: { ...Playground.args, state: 'error' } };
