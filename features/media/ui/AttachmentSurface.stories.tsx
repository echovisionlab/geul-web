import type { Meta, StoryObj } from '@storybook/nextjs';
import { localizedRender, useStorybookText } from '@/.storybook/fixture-i18n';
import { Button } from '@/components/core/Button';
import { LayoutContainer } from '@/components/core/Layout';
import { AttachmentSurface } from './AttachmentSurface';
import { MediaBlockCaption } from './MediaBlockShell';

function AttachmentPreview({ longName = false, caption = false }: { longName?: boolean; caption?: boolean }) {
  const text = useStorybookText();
  return (
    <LayoutContainer size="compact">
      <AttachmentSurface
        title={
          <span className="attachment-title">
            {longName
              ? 'Studio-session-field-recording-notes-with-a-long-descriptive-file-name.txt'
              : 'Session notes.txt'}
          </span>
        }
        meta="2.4 KB · TXT"
        action={
          <Button size="xs" href="data:text/plain,Studio%20session%20notes" download="session-notes.txt">
            {text('Download')}
          </Button>
        }
        belowHeader={
          caption ? <MediaBlockCaption>Recorded at the quiet studio, October 2026.</MediaBlockCaption> : undefined
        }
      />
    </LayoutContainer>
  );
}

const meta = {
  title: 'Feature/Media/Attachment Surface',
  component: AttachmentSurface,
  args: { title: 'Session notes.txt', meta: '2.4 KB · TXT' },
  parameters: {
    docs: {
      description: {
        component:
          'Production attachment chrome with Core title, surface, actions and caption spacing. The download is a local text fixture; signed media transport and authored media geometry are outside this preview.',
      },
    },
  },
} satisfies Meta<typeof AttachmentSurface>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { render: localizedRender(() => <AttachmentPreview />) };
export const LongNameWithCaption: Story = {
  render: localizedRender(() => <AttachmentPreview longName caption />),
};
export const Phone: Story = {
  globals: { viewport: { value: 'phone', isRotated: false } },
  render: localizedRender(() => <AttachmentPreview longName caption />),
};
