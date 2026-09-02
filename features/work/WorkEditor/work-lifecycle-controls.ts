import type { StatusOption } from '@/features/editor/EditorHeader';

export type WorkEditorStatus = 'draft' | 'published' | 'archived';

interface WorkLifecycleLabels {
  draft: string;
  published: string;
  archived: string;
  publish: string;
  unpublish: string;
}

export function resolveWorkLifecycleControls(
  status: WorkEditorStatus,
  isAdmin: boolean,
  labels: WorkLifecycleLabels,
): {
  statusOptions: StatusOption<WorkEditorStatus>[];
  canDelete: boolean;
} {
  if (status === 'archived') {
    return {
      statusOptions: [
        {
          value: 'archived',
          label: labels.archived,
          actionLabel: labels.archived,
          tone: 'warning',
        },
        {
          value: 'published',
          label: labels.published,
          actionLabel: labels.publish,
          tone: 'positive',
        },
      ],
      canDelete: false,
    };
  }

  return {
    statusOptions: [
      {
        value: 'draft',
        label: labels.draft,
        actionLabel: labels.unpublish,
        tone: 'neutral',
      },
      {
        value: 'published',
        label: labels.published,
        actionLabel: labels.publish,
        tone: 'positive',
      },
    ],
    canDelete: isAdmin,
  };
}
