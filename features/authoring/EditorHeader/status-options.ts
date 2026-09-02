import type { ControlTone } from '@/components/core/Button';
import type { StatusOption } from './EditorHeader';

type DraftPublishedStatusMessageKey = 'draft' | 'published';
type DraftPublishedActionMessageKey = 'publish' | 'unpublish';

export interface DraftPublishedStatusValues<TStatus extends string> {
  draft: TStatus;
  published: TStatus;
}

export interface DraftPublishedStatusTones {
  draft?: ControlTone;
  published?: ControlTone;
}

export function createDraftPublishedStatusOptions<TStatus extends string>(
  values: DraftPublishedStatusValues<TStatus>,
  tStatuses: (key: DraftPublishedStatusMessageKey) => string,
  tActions: (key: DraftPublishedActionMessageKey) => string,
  tones: DraftPublishedStatusTones = {},
): StatusOption<TStatus>[] {
  return [
    {
      value: values.draft,
      label: tStatuses('draft'),
      actionLabel: tActions('unpublish'),
      tone: tones.draft ?? 'neutral',
    },
    {
      value: values.published,
      label: tStatuses('published'),
      actionLabel: tActions('publish'),
      tone: tones.published ?? 'positive',
    },
  ];
}
