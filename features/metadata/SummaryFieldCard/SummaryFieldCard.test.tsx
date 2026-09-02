// @vitest-environment jsdom

import { act } from 'react';
import { create } from '@bufbuild/protobuf';
import type { MetadataAiSharedState } from '@echovisionlab/geul-common/collaboration/metadata-ai';
import {
  AIDocumentAcceptedMutationSchema,
  AIDocumentMutationSchema,
  AIDocumentOperationSchema,
  AIDocumentValueSchema,
  AIEditorDocumentToolApprovalRequiredSchema,
  AIEditorDocumentToolResultSchema,
  AIEditorTurnEventSchema,
  AIEditorTurnTerminalOutcomeSchema,
  AIEditorTurnTerminalStatus,
} from '@echovisionlab/geul-proto/secure/ai_pb.ts';
import { NextIntlClientProvider } from 'next-intl';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';
import { MantineProvider } from '@mantine/core';
import type { AIEditorAssistantClient } from '@/lib/ai/editor-orchestration';
import { createAIDocumentRequestIdentity, DCDP_PROTOCOL_VERSION } from '@/lib/ai/document-client';
import { useCollaborativeMetadataAiState } from '@/lib/hooks/useCollaborativeMetadataAiState';
import enMessages from '@/messages/en.json';
import { SummaryFieldCard } from './SummaryFieldCard';

vi.mock('@/lib/ai/editor-orchestration', () => ({
  createBrowserAIEditorAssistantClient: () => ({ start: vi.fn() }),
}));

vi.mock('@/lib/hooks/useCollaborativeMetadataAiState', () => ({
  useCollaborativeMetadataAiState: vi.fn(),
}));

vi.mock('@/components/core/Button', () => ({
  Button: ({ children, onClick, disabled, id }: React.ComponentProps<'button'>) => (
    <button id={id} type="button" onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/core/IconButton', () => ({
  IconButton: ({ children, onClick, disabled, id, 'aria-label': ariaLabel }: React.ComponentProps<'button'>) => (
    <button id={id} type="button" aria-label={ariaLabel} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/core/Input', () => ({
  Textarea: ({ id, value, onChange, readOnly, placeholder }: React.ComponentProps<'textarea'>) => (
    <textarea id={id} value={value} readOnly={readOnly} placeholder={placeholder} onChange={onChange} />
  ),
}));

vi.mock('@/components/core/Section', () => ({
  SectionCard: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SectionHeader: ({
    title,
    description,
    actions,
  }: {
    title: React.ReactNode;
    description?: React.ReactNode;
    actions?: React.ReactNode;
  }) => (
    <div>
      <div>{title}</div>
      {description ? <div>{description}</div> : null}
      {actions}
    </div>
  ),
}));

vi.mock('@/components/core/Badge', () => ({
  StatusBadge: ({ children, id }: { children: React.ReactNode; id?: string }) => <span id={id}>{children}</span>,
}));

vi.mock('@mantine/notifications', () => ({ notifications: { show: vi.fn() } }));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement | null = null;
let root: Root | null = null;
const target = { type: 'post' as const, id: 'post-1', locale: 'en' };
const mockUseCollaborativeMetadataAiState = vi.mocked(useCollaborativeMetadataAiState);

function sharedState(overrides: Partial<MetadataAiSharedState> = {}): MetadataAiSharedState {
  return {
    status: 'idle',
    generationId: null,
    jobId: null,
    requesterMemberId: null,
    requesterNickname: null,
    requestedFields: [],
    allMetadata: false,
    startedAt: null,
    updatedAt: null,
    orphanedAt: null,
    autoClearAt: null,
    ...overrides,
  };
}

function setCollaborativeState(overrides: Partial<MetadataAiSharedState> = {}) {
  const state = {
    sharedState: sharedState(overrides),
    isRequester: true,
    requesterConnected: true,
    setJobId: vi.fn(() => true),
    startGeneration: vi.fn(() => 'generation-1'),
    markApplying: vi.fn(() => true),
    markReady: vi.fn(() => true),
    updateReadyFields: vi.fn(() => true),
    clearState: vi.fn(() => true),
  };
  mockUseCollaborativeMetadataAiState.mockReturnValue(state);
  return state;
}

function render(node: React.ReactNode) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root?.render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <MantineProvider>{node}</MantineProvider>
      </NextIntlClientProvider>,
    );
  });
}

async function flushUpdates() {
  await act(async () => {
    await Promise.resolve();
  });
}

async function click(id: string) {
  const button = document.querySelector<HTMLButtonElement>(`#${id}`);
  expect(button).not.toBeNull();
  await act(async () => {
    button?.click();
    await Promise.resolve();
  });
}

function exactApproval(fieldHandle = 'summary') {
  const mutation = create(AIDocumentMutationSchema, {
    protocolVersion: DCDP_PROTOCOL_VERSION,
    ...createAIDocumentRequestIdentity(target),
    expectedDocumentRevision: 'document-revision-1',
    expectedTargetRevision: 'target-revision-1',
    operations: [
      create(AIDocumentOperationSchema, {
        operation: {
          case: 'setField',
          value: {
            target: { owner: { case: 'blockHandle', value: 'document' }, fieldHandle },
            value: create(AIDocumentValueSchema, { value: { case: 'text', value: 'Generated English summary' } }),
          },
        },
      }),
    ],
  });
  return create(AIEditorDocumentToolApprovalRequiredSchema, { toolCallId: 'tool-1', mutation });
}

function assistantClient(approval = exactApproval()) {
  let continueAfterApproval: () => void = () => undefined;
  const resolve = vi.fn(async () => continueAfterApproval());
  const cancel = vi.fn(async () => continueAfterApproval());
  const events = async function* () {
    yield create(AIEditorTurnEventSchema, {
      turnId: 'turn-1',
      event: { case: 'approvalRequired', value: approval },
    });
    await new Promise<void>((resolveEvent) => {
      continueAfterApproval = resolveEvent;
    });
    yield create(AIEditorTurnEventSchema, {
      turnId: 'turn-1',
      event: {
        case: 'documentResult',
        value: create(AIEditorDocumentToolResultSchema, {
          toolCallId: 'tool-1',
          result: {
            case: 'accepted',
            value: create(AIDocumentAcceptedMutationSchema, {
              documentRevision: 'document-revision-1',
              targetRevision: 'target-revision-2',
            }),
          },
        }),
      },
    });
    yield create(AIEditorTurnEventSchema, {
      turnId: 'turn-1',
      event: {
        case: 'terminal',
        value: create(AIEditorTurnTerminalOutcomeSchema, {
          status: AIEditorTurnTerminalStatus.AI_EDITOR_TURN_TERMINAL_STATUS_COMPLETED,
        }),
      },
    });
  };
  return {
    client: { start: vi.fn(async () => ({ events: events(), resolve, cancel })) } satisfies AIEditorAssistantClient,
    resolve,
  };
}

beforeEach(() => {
  mockUseCollaborativeMetadataAiState.mockReset();
  setCollaborativeState();
});

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
});

describe('SummaryFieldCard exact-locale AI', () => {
  it('keeps manual summary editing independent from AI visibility', () => {
    render(<SummaryFieldCard entityType="post" entityId="post-1" title="Title" summary="Summary" hideAiActions />);
    expect(document.querySelector('textarea')?.hasAttribute('readonly')).toBe(false);
    expect(document.querySelector('#post-post-1-generate-all-metadata')).toBeNull();
  });

  it('forbids AI mutation for a read-only viewer even if a target is passed accidentally', async () => {
    const runtime = assistantClient();
    render(
      <SummaryFieldCard
        entityType="post"
        entityId="post-1"
        title="Title"
        summary="Summary"
        summaryReadOnly
        aiTarget={target}
        aiClient={runtime.client}
        provider={{} as never}
        doc={new Y.Doc()}
        currentMemberId="member-1"
        currentMemberDisplayName="Author"
      />,
    );
    await click('post-post-1-generate-all-metadata');
    expect(runtime.client.start).not.toHaveBeenCalled();
  });

  it('starts the Summary action with the exact locale target and approves only its typed mutation', async () => {
    const collaborative = setCollaborativeState();
    const runtime = assistantClient();
    render(
      <SummaryFieldCard
        entityType="post"
        entityId="post-1"
        title="Title"
        summary="Summary"
        aiTarget={target}
        aiClient={runtime.client}
        provider={{} as never}
        doc={new Y.Doc()}
        currentMemberId="member-1"
        currentMemberDisplayName="Author"
      />,
    );

    await click('post-post-1-generate-all-metadata');
    await flushUpdates();

    expect(runtime.client.start).toHaveBeenCalledWith({
      target,
      selection: { mode: 'modify', blockHandles: [] },
      action: 'generate-summary',
      prompt: undefined,
    });
    expect(document.body.textContent).toContain('Generated English summary');
    expect(collaborative.markReady).toHaveBeenCalledWith('generation-1', ['summary'], true);

    await click('post-post-1-apply-ai-metadata');
    expect(runtime.resolve).toHaveBeenCalledWith('tool-1', 'approve');
    expect(collaborative.markApplying).toHaveBeenCalledWith('generation-1');
  });

  it('rejects an AI proposal that targets another field', async () => {
    const runtime = assistantClient(exactApproval('title'));
    render(
      <SummaryFieldCard
        entityType="post"
        entityId="post-1"
        title="Title"
        summary="Summary"
        aiTarget={target}
        aiClient={runtime.client}
        provider={{} as never}
        doc={new Y.Doc()}
        currentMemberId="member-1"
        currentMemberDisplayName="Author"
      />,
    );

    await click('post-post-1-generate-all-metadata');
    await flushUpdates();
    expect(document.body.textContent).toContain('not an exact locale-owned summary mutation');
    expect(document.querySelector('#post-post-1-apply-ai-metadata')).toBeNull();
  });
});
