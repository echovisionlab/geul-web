// @vitest-environment jsdom

import { render, screen, userEvent, act } from '@/test/render';
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
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';

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

vi.mock('@/components/core/Notification', () => ({ notifications: { show: vi.fn() } }));

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

async function click(id: string) {
  const labels: Record<string, string> = {
    'post-post-1-generate-all-metadata': enMessages.summaryField.actions.generate,
    'post-post-1-apply-ai-metadata': enMessages.summaryField.actions.apply,
    'post-post-1-dismiss-ai-metadata': enMessages.common.actions.dismiss,
  };
  await userEvent.click(await screen.findByRole('button', { name: labels[id] }));
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
    complete: () => continueAfterApproval(),
  };
}

beforeEach(() => {
  mockUseCollaborativeMetadataAiState.mockReset();
  setCollaborativeState();
});

describe('SummaryFieldCard exact-locale AI', () => {
  it('keeps manual summary editing independent from AI visibility', () => {
    render(<SummaryFieldCard entityType="post" entityId="post-1" title="Title" summary="Summary" hideAiActions />);
    expect(screen.getByRole('textbox')).not.toHaveAttribute('readonly');
    expect(screen.queryByRole('button', { name: enMessages.summaryField.actions.generate })).not.toBeInTheDocument();
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

    expect(runtime.client.start).toHaveBeenCalledWith({
      target,
      selection: { mode: 'modify', blockHandles: [] },
      action: 'generate-summary',
      prompt: undefined,
    });
    expect(await screen.findByText('Generated English summary')).toBeVisible();
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
    expect(await screen.findByText(/not an exact locale-owned summary mutation/)).toBeVisible();
    expect(screen.queryByRole('button', { name: enMessages.summaryField.actions.apply })).not.toBeInTheDocument();
  });
  it.each(['apply', 'dismiss'] as const)(
    'shows pending for %s and ignores completion after locale replacement',
    async (decision) => {
      const runtime = assistantClient();
      let reject!: (error: Error) => void;
      runtime.resolve.mockImplementationOnce(
        () =>
          new Promise<void>((_resolve, fail) => {
            reject = fail;
          }),
      );
      const doc = new Y.Doc();
      const props = {
        entityType: 'post' as const,
        entityId: 'post-1',
        title: 'Title',
        summary: 'Summary',
        aiTarget: target,
        aiClient: runtime.client,
        provider: {} as never,
        doc,
        currentMemberId: 'member-1',
        currentMemberDisplayName: 'Author',
      };
      const { user, rerender, unmount } = render(<SummaryFieldCard {...props} />);
      await user.click(screen.getByRole('button', { name: enMessages.summaryField.actions.generate }));
      expect(await screen.findByText('Generated English summary')).toBeVisible();
      const label = decision === 'apply' ? enMessages.summaryField.actions.apply : enMessages.common.actions.dismiss;
      const command = screen.getByRole('button', { name: label });
      await user.click(command);
      expect(command).toHaveAttribute('aria-busy', 'true');
      await user.click(command);
      expect(runtime.resolve).toHaveBeenCalledTimes(1);
      rerender(<SummaryFieldCard {...props} aiTarget={{ ...target, locale: 'ko' }} />);
      await act(async () => reject(new Error('obsolete resolution')));
      expect(screen.queryByText('obsolete resolution')).not.toBeInTheDocument();
      expect(screen.queryByText('Generated English summary')).not.toBeInTheDocument();
      unmount();
      doc.destroy();
    },
  );
  it('keeps an accepted summary when its approval transport later rejects', async () => {
    const collaborative = setCollaborativeState();
    const runtime = assistantClient();
    let fail!: (error: Error) => void;
    runtime.resolve.mockImplementationOnce(
      () =>
        new Promise<void>((_resolve, reject) => {
          fail = reject;
        }),
    );
    const doc = new Y.Doc();
    const { user, unmount } = render(
      <SummaryFieldCard
        entityType="post"
        entityId="post-1"
        title="Title"
        summary="Summary"
        aiTarget={target}
        aiClient={runtime.client}
        provider={{} as never}
        doc={doc}
        currentMemberId="member-1"
        currentMemberDisplayName="Author"
      />,
    );
    await user.click(screen.getByRole('button', { name: enMessages.summaryField.actions.generate }));
    expect(await screen.findByText('Generated English summary')).toBeVisible();
    await user.click(screen.getByRole('button', { name: enMessages.summaryField.actions.apply }));
    await act(async () => runtime.complete());
    expect(await screen.findByText(enMessages.summaryField.feedback.applied)).toBeVisible();
    await act(async () => fail(new Error('obsolete approval failure')));
    expect(screen.queryByText('obsolete approval failure')).not.toBeInTheDocument();
    expect(screen.getByText(enMessages.summaryField.feedback.applied)).toBeVisible();
    expect(collaborative.updateReadyFields).not.toHaveBeenCalled();
    unmount();
    doc.destroy();
  });
});
