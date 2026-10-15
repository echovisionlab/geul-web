import { useRef, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs';
import { useTranslations } from 'next-intl';
import { withFeatureLabels } from '@/stories/feature-localization';
import { LayoutStack } from '../Layout';
import { Text } from '../Typography';
import { ScrollArea } from './Display';
import { NearEndLoader, type NearEndLoaderLabels } from './NearEndLoader';

function CollectionExample({ labels, failOnce = false }: { labels: NearEndLoaderLabels; failOnce?: boolean }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const failedRef = useRef(false);
  const [page, setPage] = useState(1);
  const t = useTranslations('fileManager');
  return (
    <LayoutStack gap="sm">
      <Text size="sm" lang="en">
        Scroll near the end to append a local page. Tab to the continuation command for keyboard loading. This fixture
        uses three delayed pages and performs no server request.
      </Text>
      <ScrollArea ref={rootRef} size="compact" scrollbars="y" role="region" aria-label={t('title')}>
        <LayoutStack gap="sm">
          {Array.from({ length: page * 12 }, (_, index) => (
            <Text key={index}>Fixture item {index + 1}</Text>
          ))}
          <NearEndLoader
            pageKey={page < 3 ? String(page + 1) : null}
            resetKey="collection-example"
            rootRef={rootRef}
            labels={labels}
            onLoad={async () => {
              await new Promise<void>((resolve) => window.setTimeout(resolve, 300));
              if (failOnce && !failedRef.current) {
                failedRef.current = true;
                throw new Error('Local pagination fixture failure');
              }
              setPage((current) => current + 1);
            }}
          />
        </LayoutStack>
      </ScrollArea>
    </LayoutStack>
  );
}

const meta = {
  title: 'Core/Data Display/NearEndLoader',
  component: NearEndLoader,
  decorators: [
    withFeatureLabels({
      labels: {
        load: 'fileManager.actions.loadMore',
        loading: 'common.states.loading',
        end: 'fileManager.pagination.end',
        retry: 'common.actions.tryAgain',
        failed: 'fileManager.errors.load',
      },
    }),
  ],
  args: {
    pageKey: 'page-2',
    resetKey: 'state-example',
    onLoad: async () => {},
    labels: { load: 'Load more', loading: 'Loading', end: 'End of results', retry: 'Try again', failed: 'Load failed' },
  },
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Requests the next page when its sentinel enters a 240px prefetch margin. Supply an awaited transport callback, next cursor, result-set reset key and the actual scroll root. Null cursor marks the end. Each cursor is attempted automatically once; pending requests are serialized and failures require an explicit compact retry. The keyboard command remains discoverable through Tab and visible while focused. Missing IntersectionObserver exposes the same command. Request generations, data replacement and stale response handling remain with the controller.',
      },
    },
  },
} satisfies Meta<typeof NearEndLoader>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {
  render: (args) => <CollectionExample labels={args.labels} />,
  parameters: {
    controls: { include: [] },
    docs: {
      description: {
        story:
          'The local collection owns cursor, pending and response state; those values are not Controls for this fixture.',
      },
    },
  },
};
export const Retry: Story = {
  render: (args) => <CollectionExample labels={args.labels} failOnce />,
  parameters: {
    controls: { include: [] },
    docs: {
      description: {
        story:
          'The first local page request fails once. Retry continues the same cursor without an automatic error loop.',
      },
    },
  },
};
export const Loading: Story = { args: { loading: true } };
export const End: Story = { args: { pageKey: null } };
