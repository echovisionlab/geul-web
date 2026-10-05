import type { Meta, StoryObj } from '@storybook/nextjs';
import { Container, Text } from '@mantine/core';
import { useTranslations } from 'next-intl';
import { PageLoaderView } from '@/components/core/LoadingSurface';
import { HwpEditorView, type HwpEditorLabels, type HwpEditorViewProps } from './ui/HwpEditorView';

function LocalizedView(props: HwpEditorViewProps) {
  const t = useTranslations('tools.hwp');
  const labels = { ...props.labels };
  for (const key of Object.keys(labels) as (keyof HwpEditorLabels)[]) {
    labels[key] = t(key === 'label' ? 'title' : key);
  }
  return (
    <HwpEditorView
      {...props}
      labels={labels}
      loadingContent={<PageLoaderView imageAlt={labels.loading} message={labels.loading} />}
    />
  );
}

const meta = {
  title: 'Feature/HWP Editor',
  component: HwpEditorView,
  render: (args) => <LocalizedView {...args} />,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <Container size="100%" py="xl">
        <Story />
      </Container>
    ),
  ],
  args: {
    labels: {
      label: 'HWP editor',
      loading: 'Loading editor…',
      error: 'The editor could not be loaded. Try again.',
      retry: 'Try again',
    },
    status: 'loading',
    contentHeight: 0,
    loadingContent: null,
    editor: null,
    onRetry: () => {},
  },
} satisfies Meta<typeof HwpEditorView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Loading: Story = {};
export const StartupError: Story = { args: { status: 'error' } };
export const ReadyFrame: Story = {
  args: {
    status: 'ready',
    // Visual fixture only. Runtime editing and native toolbar are exercised in the app.
    editor: (
      <Text p="lg" size="sm" c="dimmed">
        HWP / HWPX
      </Text>
    ),
  },
};
