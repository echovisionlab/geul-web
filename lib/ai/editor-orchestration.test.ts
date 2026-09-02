import { create } from '@bufbuild/protobuf';
import {
  AIDocumentMetadataSchema,
  AIDocumentMutationSchema,
  AIEditorDocumentToolApprovalRequiredSchema,
  AIEditorToolCallDecision,
  AIEditorTurnEventSchema,
  AIEditorTurnPhase,
  AIEditorTurnPhaseUpdateSchema,
} from '@echovisionlab/geul-proto/secure/ai_pb.ts';
import { describe, expect, it, vi } from 'vitest';
import { DCDP_PROTOCOL_VERSION } from './document-client';
import { createAIEditorAssistantClient } from './editor-orchestration';

const target = { type: 'post' as const, id: 'post-1', locale: 'en' };

describe('first-party AI editor orchestration', () => {
  it('starts the generated stream with exact target, locale, revision, and stable Block handles', async () => {
    const metadata = create(AIDocumentMetadataSchema, {
      protocolVersion: DCDP_PROTOCOL_VERSION,
      documentRevision: 'document-rev-1',
      targetRevision: 'target-rev-1',
    });
    const approval = create(AIEditorDocumentToolApprovalRequiredSchema, {
      toolCallId: 'tool-1',
      mutation: create(AIDocumentMutationSchema, {
        protocolVersion: DCDP_PROTOCOL_VERSION,
        expectedDocumentRevision: 'document-rev-1',
        expectedTargetRevision: 'target-rev-1',
      }),
    });
    const source = async function* () {
      yield create(AIEditorTurnEventSchema, {
        turnId: 'turn-1',
        event: {
          case: 'phase',
          value: create(AIEditorTurnPhaseUpdateSchema, {
            phase: AIEditorTurnPhase.AI_EDITOR_TURN_PHASE_AWAITING_TOOL_APPROVAL,
          }),
        },
      });
      yield create(AIEditorTurnEventSchema, {
        turnId: 'turn-1',
        event: { case: 'approvalRequired', value: approval },
      });
    };
    const documents = { open: vi.fn().mockResolvedValue(metadata) };
    const orchestration = {
      startAIEditorTurn: vi.fn(() => source()),
      resolveAIEditorToolCall: vi.fn().mockResolvedValue({}),
      cancelAIEditorTurn: vi.fn().mockResolvedValue({}),
    };
    const client = createAIEditorAssistantClient(documents, orchestration);

    const turn = await client.start({
      target,
      selection: { mode: 'modify', blockHandles: ['paragraph-1', 'paragraph-1'] },
      action: 'improve-writing',
    });
    const iterator = turn.events[Symbol.asyncIterator]();
    await iterator.next();
    expect((await iterator.next()).value?.event.case).toBe('approvalRequired');

    expect(documents.open).toHaveBeenCalledWith(target, undefined);
    expect(orchestration.startAIEditorTurn).toHaveBeenCalledWith(
      expect.objectContaining({
        document: expect.objectContaining({ reference: 'post-1' }),
        locale: expect.objectContaining({ code: 'en' }),
        expectedDocumentRevision: 'document-rev-1',
        expectedTargetRevision: 'target-rev-1',
        blockHandles: ['paragraph-1'],
        action: 'improve-writing',
      }),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );

    await turn.resolve('tool-1', 'approve');
    expect(orchestration.resolveAIEditorToolCall).toHaveBeenCalledWith(
      {
        turnId: 'turn-1',
        toolCallId: 'tool-1',
        decision: AIEditorToolCallDecision.AI_EDITOR_TOOL_CALL_DECISION_APPROVE,
      },
      undefined,
    );
  });

  it('uses generated cancel for an identified live turn and never applies AIDocument directly', async () => {
    let holdStream: () => void = () => undefined;
    let startedRequest: unknown;
    const source = async function* () {
      yield create(AIEditorTurnEventSchema, {
        turnId: 'turn-2',
        event: {
          case: 'phase',
          value: create(AIEditorTurnPhaseUpdateSchema, {
            phase: AIEditorTurnPhase.AI_EDITOR_TURN_PHASE_PROVIDER_RUNNING,
          }),
        },
      });
      await new Promise<void>((resolve) => {
        holdStream = resolve;
      });
    };
    const documents = {
      open: vi.fn().mockResolvedValue(
        create(AIDocumentMetadataSchema, {
          protocolVersion: DCDP_PROTOCOL_VERSION,
          documentRevision: 'document-rev-2',
        }),
      ),
      apply: vi.fn(),
    };
    const orchestration = {
      startAIEditorTurn: vi.fn((request: unknown) => {
        startedRequest = request;
        return source();
      }),
      resolveAIEditorToolCall: vi.fn(),
      cancelAIEditorTurn: vi.fn().mockResolvedValue({}),
    };
    const turn = await createAIEditorAssistantClient(documents, orchestration).start({
      target,
      selection: { mode: 'generate', blockHandles: [] },
      action: 'brainstorm',
    });
    const iterator = turn.events[Symbol.asyncIterator]();
    await iterator.next();

    expect(orchestration.startAIEditorTurn).toHaveBeenCalledWith(
      expect.objectContaining({
        expectedDocumentRevision: 'document-rev-2',
      }),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(startedRequest).not.toHaveProperty('expectedTargetRevision');

    await turn.cancel();

    expect(orchestration.cancelAIEditorTurn).toHaveBeenCalledWith({ turnId: 'turn-2' }, undefined);
    expect(documents.apply).not.toHaveBeenCalled();
    holdStream();
    await iterator.return?.();
  });
});
