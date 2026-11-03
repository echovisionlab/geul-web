import type { Meta, StoryObj } from '@storybook/nextjs';
import { useTranslations } from 'next-intl';
import { PageLoader } from '@/features/site/PageLoader';
import { EmailLayoutPreviewView } from './EmailLayoutPreviewView';

const meta: Meta<typeof EmailLayoutPreviewView> = {
  title: 'Feature/Admin/Email Layout Preview',
  component: EmailLayoutPreviewView,
  render: function Preview(args) {
    const tStates = useTranslations('common.states');
    return (
      <EmailLayoutPreviewView
        {...args}
        loadingSurface={<PageLoader placement="flow" message={tStates('loadingPreview')} />}
      />
    );
  },
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Production preview view. Initial requests use the site loader in document flow; updates retain the last iframe. Server rendering is represented by supplied HTML and validation errors.',
      },
    },
  },
  args: { previewHtml: '', isLoading: false, loadingSurface: <PageLoader placement="flow" /> },
};
export default meta;
type Story = StoryObj<typeof EmailLayoutPreviewView>;
export const InitialWait: Story = { args: { isLoading: true } };
export const Updating: Story = {
  args: {
    isLoading: true,
    previewHtml: '<html><body><h1>Preview</h1><p>Previously rendered email remains visible.</p></body></html>',
  },
};
export const Empty: Story = {};
export const Failed: Story = { args: { errors: [{ code: 'UNKNOWN_ERROR', message: '' }] } };
