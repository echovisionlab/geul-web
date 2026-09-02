import { create, type MessageInitShape } from '@bufbuild/protobuf';
import { createClient, type CallOptions } from '@connectrpc/connect';
import { createConnectTransport } from '@connectrpc/connect-web';
import {
  AIEditorOrchestrationService,
  AIEditorToolCallDecision,
  StartAIEditorTurnRequestSchema,
  type AIDocumentMetadata,
  type AIDocumentMutation,
  type AIDocumentOperation,
  type AIEditorTurnEvent,
  type CancelAIEditorTurnResponse,
  type ResolveAIEditorToolCallResponse,
} from '@echovisionlab/geul-proto/secure/ai_pb.ts';
import { authenticatedBrowserFetch } from '@/lib/auth/session-events';
import {
  createAIDocumentRequestIdentity,
  createBrowserAIDocumentClient,
  type AIDocumentTarget,
} from './document-client';

const BROWSER_RPC_BASE_URL = '/api/rpc';

export type AIEditorContextMode = 'generate' | 'modify';

export interface AIEditorSelection {
  mode: AIEditorContextMode;
  blockHandles: readonly string[];
}

export interface StartAIEditorTurnInput {
  target: AIDocumentTarget;
  selection: AIEditorSelection;
  action: string;
  prompt?: string;
  signal?: AbortSignal;
}

export type AIEditorToolDecision = 'approve' | 'deny';

/** One transient Browser Session turn. Its event stream has exactly one consumer. */
export interface AIEditorTurn {
  readonly events: AsyncIterable<AIEditorTurnEvent>;
  resolve: (toolCallId: string, decision: AIEditorToolDecision, signal?: AbortSignal) => Promise<void>;
  cancel: (signal?: AbortSignal) => Promise<void>;
}

export interface AIEditorAssistantClient {
  start: (input: StartAIEditorTurnInput) => Promise<AIEditorTurn>;
}

interface AIEditorOrchestrationRPC {
  startAIEditorTurn: (
    request: MessageInitShape<typeof StartAIEditorTurnRequestSchema>,
    options?: CallOptions,
  ) => AsyncIterable<AIEditorTurnEvent>;
  resolveAIEditorToolCall: (
    request: { turnId: string; toolCallId: string; decision: AIEditorToolCallDecision },
    options?: CallOptions,
  ) => Promise<ResolveAIEditorToolCallResponse>;
  cancelAIEditorTurn: (request: { turnId: string }, options?: CallOptions) => Promise<CancelAIEditorTurnResponse>;
}

interface AIEditorDocumentMetadataClient {
  open: (target: AIDocumentTarget, signal?: AbortSignal) => Promise<AIDocumentMetadata>;
}

function decisionValue(decision: AIEditorToolDecision): AIEditorToolCallDecision {
  return decision === 'approve'
    ? AIEditorToolCallDecision.AI_EDITOR_TOOL_CALL_DECISION_APPROVE
    : AIEditorToolCallDecision.AI_EDITOR_TOOL_CALL_DECISION_DENY;
}

function throwIfBlank(value: string, name: string): void {
  if (!value.trim()) {
    throw new Error(`${name} is required for an AI editor turn`);
  }
}

function attachAbortSignal(source: AbortSignal | undefined, controller: AbortController): () => void {
  if (!source) {
    return () => undefined;
  }
  const abort = () => controller.abort(source.reason);
  if (source.aborted) {
    abort();
    return () => undefined;
  }
  source.addEventListener('abort', abort, { once: true });
  return () => source.removeEventListener('abort', abort);
}

/**
 * Adapts generated Start/Resolve/Cancel RPCs to one transient editor turn.
 * AIDocument is read only to capture the exact document and optional target
 * revision; mutation is exclusively performed by ResolveAIEditorToolCall on
 * the server.
 */
export function createAIEditorAssistantClient(
  documents: AIEditorDocumentMetadataClient,
  orchestration: AIEditorOrchestrationRPC,
): AIEditorAssistantClient {
  return {
    async start(input) {
      throwIfBlank(input.target.id, 'AI document target ID');
      throwIfBlank(input.target.locale, 'AI document locale');
      throwIfBlank(input.action, 'AI editor action');

      const metadata = await documents.open(input.target, input.signal);
      throwIfBlank(metadata.documentRevision, 'AI document revision');
      if (metadata.targetRevision !== undefined) {
        throwIfBlank(metadata.targetRevision, 'AI document target revision');
      }

      const streamController = new AbortController();
      const detachInputSignal = attachAbortSignal(input.signal, streamController);
      const request = create(StartAIEditorTurnRequestSchema, {
        ...createAIDocumentRequestIdentity(input.target),
        expectedDocumentRevision: metadata.documentRevision,
        expectedTargetRevision: metadata.targetRevision,
        blockHandles: [...new Set(input.selection.blockHandles)],
        action: input.action,
        prompt: input.prompt,
      });
      const source = orchestration.startAIEditorTurn(request, { signal: streamController.signal });
      let turnId: string | null = null;
      let terminal = false;

      const events = (async function* () {
        try {
          for await (const event of source) {
            throwIfBlank(event.turnId, 'AI editor turn ID');
            if (turnId && event.turnId !== turnId) {
              throw new Error('AI editor stream changed turn identity');
            }
            turnId = event.turnId;
            if (event.event.case === 'terminal') {
              terminal = true;
            }
            yield event;
          }
        } finally {
          terminal = true;
          detachInputSignal();
        }
      })();

      return {
        events,
        async resolve(toolCallId, decision, signal) {
          throwIfBlank(toolCallId, 'AI editor tool call ID');
          if (!turnId || terminal) {
            throw new Error('AI editor turn is not awaiting a tool decision');
          }
          await orchestration.resolveAIEditorToolCall(
            { turnId, toolCallId, decision: decisionValue(decision) },
            signal ? { signal } : undefined,
          );
        },
        async cancel(signal) {
          if (terminal) {
            return;
          }
          try {
            if (turnId) {
              await orchestration.cancelAIEditorTurn({ turnId }, signal ? { signal } : undefined);
            }
          } finally {
            streamController.abort();
            detachInputSignal();
          }
        },
      };
    },
  };
}

export function createBrowserAIEditorAssistantClient(): AIEditorAssistantClient {
  const transport = createConnectTransport({
    baseUrl: BROWSER_RPC_BASE_URL,
    fetch: authenticatedBrowserFetch,
  });
  const orchestration = createClient(AIEditorOrchestrationService, transport);
  return createAIEditorAssistantClient(createBrowserAIDocumentClient(), orchestration);
}

export function describeAIDocumentOperation(operation: AIDocumentOperation): string {
  switch (operation.operation.case) {
    case 'setField':
      return `Set ${operation.operation.value.target?.fieldHandle || 'field'}`;
    case 'unsetField':
      return `Unset ${operation.operation.value.target?.fieldHandle || 'field'}`;
    case 'insertBlock':
      return `Insert ${operation.operation.value.kind || 'block'}`;
    case 'deleteBlock':
      return `Delete ${operation.operation.value.blockHandle}`;
    case 'moveBlock':
      return `Move ${operation.operation.value.blockHandle}`;
    case 'replaceBlockKind':
      return `Change ${operation.operation.value.blockHandle} to ${operation.operation.value.kind}`;
    case 'attachFile':
      return `Attach File ${operation.operation.value.fileHandle}`;
    case 'detachFile':
      return `Detach ${operation.operation.value.target?.fieldHandle || 'File'}`;
    case 'createTranslation':
      return 'Create translation';
    case 'deleteTranslation':
      return 'Delete translation';
    case 'insertRelationItem':
      return `Insert ${operation.operation.value.itemKind || 'relation item'}`;
    case 'deleteRelationItem':
      return `Delete ${operation.operation.value.item?.itemHandle || 'relation item'}`;
    case 'moveRelationItem':
      return `Move ${operation.operation.value.item?.itemHandle || 'relation item'}`;
    default:
      return 'Unknown document operation';
  }
}

export function proposalOperations(mutation: AIDocumentMutation | undefined): readonly AIDocumentOperation[] {
  return mutation?.operations ?? [];
}
