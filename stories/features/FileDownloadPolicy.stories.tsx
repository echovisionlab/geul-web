import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs';
import { LayoutContainer } from '@/components/core/Layout';
import {
  FileDownloadPolicyEditor,
  type FileDownloadPolicyEditorAdapter,
} from '@/features/media-download/FileDownloadPolicyEditor';
import { TranscodeEntityType } from '@echovisionlab/geul-proto/secure/events_pb.ts';
import { SegmentType } from '@echovisionlab/geul-proto/secure/audience_pb.ts';
import type { FileDownloadPolicyModel } from '@/lib/types/file-download-access';
function DownloadPolicyPreview({
  state = 'ready',
  compact = false,
}: {
  state?: 'ready' | 'restricted' | 'pending' | 'error' | 'save-error';
  compact?: boolean;
}) {
  const target = {
    entityType: TranscodeEntityType.POST,
    entityId: 'preview-download',
    blockId: 'block-preview',
    expectedFileId: 'file-preview',
  };
  const [adapter] = useState<FileDownloadPolicyEditorAdapter>(() => {
    const segment = {
      id: 'audience-preview',
      name: 'Listening room',
      description: '',
      segmentType: SegmentType.MEMBERS_BY_FILTER,
    };
    let policy: FileDownloadPolicyModel = {
      ...target,
      fileId: target.expectedFileId,
      audience: state === 'restricted' ? 'restricted' : 'public',
      audienceSegments: state === 'restricted' ? [segment] : [],
    };
    return {
      loadPolicy: async () =>
        state === 'pending'
          ? new Promise(() => {})
          : state === 'error'
            ? { errorCode: 'loadFailed' }
            : { data: policy },
      loadSegments: async ({ search = '' }) => ({
        data: {
          items: segment.name.toLowerCase().includes(search.toLowerCase()) ? [segment] : [],
          page: 1,
          pageSize: 50,
          total: 1,
          totalPages: 1,
          hasMore: false,
        },
      }),
      savePolicy: async (_, audience, ids) => {
        if (state === 'save-error') {
          return { errorCode: 'saveFailed' };
        }
        policy = { ...policy, audience, audienceSegments: ids.includes(segment.id) ? [segment] : [] };
        return { data: policy };
      },
    };
  });
  return (
    <LayoutContainer size="compact" inset="md">
      <FileDownloadPolicyEditor {...target} adapter={adapter} compact={compact} />
    </LayoutContainer>
  );
}
const meta = {
  title: 'Feature/Media Download/Access Policy',
  component: DownloadPolicyPreview,
  args: { state: 'ready', compact: false },
  parameters: {
    docs: {
      description: {
        component:
          'Actual production download policy editor with typed in-memory reads and autosave. Audience/segment selection, loading, read/write failure states; no backend access permissions or asset persistence.',
      },
    },
  },
  decorators: [(Story, context) => <Story key={`${context.args.state}:${context.args.compact}`} />],
} satisfies Meta<typeof DownloadPolicyPreview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Public: Story = {};
export const Restricted: Story = { args: { state: 'restricted' } };
export const Loading: Story = { args: { state: 'pending' } };
export const Failed: Story = { args: { state: 'error' } };
export const SaveFailed: Story = { args: { state: 'save-error' } };
export const Compact: Story = { args: { compact: true } };
