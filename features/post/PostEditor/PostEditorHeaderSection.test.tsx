// @vitest-environment jsdom

import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MantineProvider } from '@mantine/core';
import type { EditorHeaderActionItem, EditorHeaderCollabAction } from '@/features/editor/EditorHeader';
import { PostEditorHeaderSection } from './PostEditorHeaderSection';

vi.mock('next-intl', () => ({
  useTranslations: (namespace: string) => {
    const translate = (key: string) => `${namespace}:${key}`;
    translate.rich = (key: string) => `${namespace}:${key}`;
    return translate;
  },
}));

vi.mock('@/features/editor/EditorHeader', () => ({
  EditorHeader: ({
    title,
    actionItems,
    collabActions,
    controls,
  }: {
    title: string;
    actionItems?: EditorHeaderActionItem[];
    collabActions?: EditorHeaderCollabAction[];
    controls?: ReactNode;
  }) => (
    <header>
      <h1>{title}</h1>
      {controls}
      {actionItems?.map((action) => (
        <button key={action.key} type="button" data-action={action.key} onClick={action.onClick}>
          {action.label}
        </button>
      ))}
      {collabActions?.map((action) => (
        <button key={action.label} type="button" data-collab-action={action.label} onClick={action.onClick}>
          {action.label}
        </button>
      ))}
    </header>
  ),
}));

const statusOptions = [
  {
    value: 'scheduled' as const,
    label: 'Scheduled',
    actionLabel: 'Schedule',
    tone: 'neutral' as const,
  },
];

const callbacks = {
  onTitleChange: vi.fn(),
  onBack: vi.fn(),
  onStatusChange: vi.fn(),
  onDelete: vi.fn(),
  onOpenVersionHistory: vi.fn(),
  onOpenParticipants: vi.fn(),
  onReschedule: vi.fn(),
  onExportMarkdown: vi.fn(),
  onToggleZenMode: vi.fn(),
};

let container: HTMLDivElement | null = null;
let root: Root | null = null;

function renderHeader(isZenMode: boolean) {
  act(() => {
    root?.render(
      <MantineProvider>
        <PostEditorHeaderSection
          postId="post-1"
          title="Post title"
          canEditTitle
          status="scheduled"
          statusOptions={statusOptions}
          isConnected
          isSynced
          isStatusChanging={false}
          isDeleting={false}
          isZenMode={isZenMode}
          controls={<span data-testid="locale-control" />}
          scheduledAt="2026-08-19T00:00:00.000Z"
          scheduledTimeZone="Asia/Seoul"
          {...callbacks}
        />
      </MantineProvider>,
    );
  });
}

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  vi.clearAllMocks();
});

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
});

describe('PostEditorHeaderSection', () => {
  it('composes scheduled post actions and collaboration actions', () => {
    renderHeader(false);

    expect(container?.querySelector('[data-action="zen-mode"]')).not.toBeNull();
    expect(container?.querySelector('[data-action="reschedule"]')).not.toBeNull();
    expect(container?.querySelector('[data-action="export-markdown"]')).not.toBeNull();
    expect(container?.querySelector('[data-collab-action="common.labels:versionHistory"]')).not.toBeNull();
    expect(container?.querySelector('[data-collab-action="postEditor:participantsAction"]')).not.toBeNull();
    expect(container?.textContent).toContain('postEditor:schedule.scheduledFor');
  });

  it('keeps only the zen toggle visible while zen mode is active', () => {
    renderHeader(true);

    expect(container?.querySelectorAll('[data-action]')).toHaveLength(1);
    expect(container?.querySelector('[data-action="zen-mode"]')).not.toBeNull();
    expect(container?.querySelector('[data-collab-action]')).toBeNull();
    expect(container?.textContent).not.toContain('postEditor:schedule.scheduledFor');
  });
});
