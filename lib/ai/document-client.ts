import { create } from '@bufbuild/protobuf';
import {
  AIDocumentDomain,
  AIDocumentLocaleRole,
  AIDocumentLocaleSchema,
  AIDocumentMutationSchema,
  AIDocumentOperationSchema,
  AIDocumentReferenceSchema,
  type AIDocumentAcceptedMutation,
  type AIDocumentMetadata,
  type AIDocumentMutation,
  type AIDocumentOperation,
  type AIDocumentValidation,
} from '@echovisionlab/geul-proto/secure/ai_pb.ts';
import { createAIDocumentClient as createGeneratedAIDocumentClient } from '@/lib/api/browser-client';

export const DCDP_PROTOCOL_VERSION = 'dcdp/1' as const;

export type AIDocumentTargetType =
  | 'post'
  | 'page'
  | 'work'
  | 'program-event'
  | 'release'
  | 'artist'
  | 'label'
  | 'menu'
  | 'email-template'
  | 'email-layout'
  | 'campaign'
  | 'form'
  | 'privacy'
  | 'terms'
  | 'post-series';

export interface AIDocumentTarget {
  type: AIDocumentTargetType;
  id: string;
  locale: string;
}

export interface AIDocumentApplyResult {
  accepted?: AIDocumentAcceptedMutation;
  rejected?: AIDocumentValidation;
}

export interface AIDocumentRevisionTokens {
  documentRevision: string;
  targetRevision?: string;
}

export interface AIDocumentClient {
  open: (target: AIDocumentTarget, signal?: AbortSignal) => Promise<AIDocumentMetadata>;
  apply: (mutation: AIDocumentMutation, signal?: AbortSignal) => Promise<AIDocumentApplyResult>;
}

export type AIDocumentTargetLifecycleAction = 'create' | 'delete';

const documentDomainByTargetType: Record<AIDocumentTargetType, AIDocumentDomain> = {
  post: AIDocumentDomain.AI_DOCUMENT_DOMAIN_POST,
  page: AIDocumentDomain.AI_DOCUMENT_DOMAIN_PAGE,
  work: AIDocumentDomain.AI_DOCUMENT_DOMAIN_WORK,
  'program-event': AIDocumentDomain.AI_DOCUMENT_DOMAIN_PROGRAM_EVENT,
  release: AIDocumentDomain.AI_DOCUMENT_DOMAIN_RELEASE,
  artist: AIDocumentDomain.AI_DOCUMENT_DOMAIN_ARTIST,
  label: AIDocumentDomain.AI_DOCUMENT_DOMAIN_LABEL,
  menu: AIDocumentDomain.AI_DOCUMENT_DOMAIN_MENU,
  'email-template': AIDocumentDomain.AI_DOCUMENT_DOMAIN_EMAIL_TEMPLATE,
  'email-layout': AIDocumentDomain.AI_DOCUMENT_DOMAIN_EMAIL_LAYOUT,
  campaign: AIDocumentDomain.AI_DOCUMENT_DOMAIN_CAMPAIGN,
  form: AIDocumentDomain.AI_DOCUMENT_DOMAIN_FORM,
  privacy: AIDocumentDomain.AI_DOCUMENT_DOMAIN_PRIVACY,
  terms: AIDocumentDomain.AI_DOCUMENT_DOMAIN_TERMS,
  'post-series': AIDocumentDomain.AI_DOCUMENT_DOMAIN_POST_SERIES,
};

function targetLifecycleError(target: AIDocumentTarget, action: AIDocumentTargetLifecycleAction): Error {
  return new Error(`${target.type} target translation ${action} failed.`);
}

function assertExactTargetMetadata(
  metadata: AIDocumentMetadata,
  target: AIDocumentTarget,
  action: AIDocumentTargetLifecycleAction,
): AIDocumentRevisionTokens & { localeExists: boolean } {
  const error = () => {
    throw targetLifecycleError(target, action);
  };
  if (
    !target.id ||
    !target.locale ||
    metadata.protocolVersion !== DCDP_PROTOCOL_VERSION ||
    metadata.document?.domain !== documentDomainByTargetType[target.type] ||
    metadata.document.reference !== target.id ||
    metadata.requestedLocale?.code !== target.locale ||
    !metadata.sourceLocale?.code ||
    metadata.sourceLocale.code === target.locale ||
    metadata.localeRole !== AIDocumentLocaleRole.AI_DOCUMENT_LOCALE_ROLE_NON_SOURCE ||
    !metadata.documentRevision.trim()
  ) {
    return error();
  }

  const targetRevision = metadata.targetRevision?.trim() || undefined;
  if (metadata.localeExists !== (targetRevision !== undefined)) {
    return error();
  }
  return { documentRevision: metadata.documentRevision, targetRevision, localeExists: metadata.localeExists };
}

/**
 * Applies one explicit target-locale lifecycle mutation. The server seeds a
 * newly created target from the current source and owns both opaque revisions;
 * Web only proceeds after an exact target re-open proves the accepted state.
 */
export async function mutateAIDocumentTargetTranslation(input: {
  target: AIDocumentTarget;
  action: AIDocumentTargetLifecycleAction;
  client?: AIDocumentClient;
}): Promise<AIDocumentRevisionTokens & { localeExists: boolean }> {
  const { target, action, client = createBrowserAIDocumentClient() } = input;
  const before = assertExactTargetMetadata(await client.open(target), target, action);
  if (action === 'create' && before.localeExists && before.targetRevision) {
    return before;
  }
  if (action === 'delete' && !before.localeExists) {
    return before;
  }

  const operation = create(AIDocumentOperationSchema, {
    operation:
      action === 'create' ? { case: 'createTranslation', value: {} } : { case: 'deleteTranslation', value: {} },
  });
  const result = await client.apply(
    createAIDocumentMutation(
      target,
      {
        documentRevision: before.documentRevision,
        targetRevision: action === 'delete' ? before.targetRevision : undefined,
      },
      [operation],
    ),
  );
  if (!result.accepted || result.rejected) {
    throw targetLifecycleError(target, action);
  }

  const acceptedTargetRevision = result.accepted.targetRevision?.trim() || undefined;
  if (
    !result.accepted.documentRevision.trim() ||
    (action === 'create' && !acceptedTargetRevision) ||
    (action === 'delete' && acceptedTargetRevision !== undefined)
  ) {
    throw targetLifecycleError(target, action);
  }

  const reloaded = assertExactTargetMetadata(await client.open(target), target, action);
  if (
    reloaded.documentRevision !== result.accepted.documentRevision ||
    reloaded.targetRevision !== acceptedTargetRevision ||
    reloaded.localeExists !== (action === 'create')
  ) {
    throw targetLifecycleError(target, action);
  }
  return reloaded;
}

export function createAIDocumentRequestIdentity(target: AIDocumentTarget) {
  return {
    document: create(AIDocumentReferenceSchema, {
      domain: documentDomainByTargetType[target.type],
      reference: target.id,
    }),
    locale: create(AIDocumentLocaleSchema, { code: target.locale }),
  };
}

function assertMetadata(metadata: AIDocumentMetadata | undefined): AIDocumentMetadata {
  if (!metadata) {
    throw new Error('DCDP response is missing document metadata');
  }
  if (metadata.protocolVersion !== DCDP_PROTOCOL_VERSION) {
    throw new Error(`Unsupported AI document protocol: ${metadata.protocolVersion || 'missing'}`);
  }
  return metadata;
}

export function createAIDocumentMutation(
  target: AIDocumentTarget,
  revisions: AIDocumentRevisionTokens,
  operations: readonly AIDocumentOperation[],
): AIDocumentMutation {
  return create(AIDocumentMutationSchema, {
    protocolVersion: DCDP_PROTOCOL_VERSION,
    ...createAIDocumentRequestIdentity(target),
    expectedDocumentRevision: revisions.documentRevision,
    expectedTargetRevision: revisions.targetRevision,
    operations: [...operations],
  });
}

export function createBrowserAIDocumentClient(): AIDocumentClient {
  const client = createGeneratedAIDocumentClient();
  return {
    async open(target, signal) {
      const response = await client.openAIDocument(
        createAIDocumentRequestIdentity(target),
        signal ? { signal } : undefined,
      );
      return assertMetadata(response.metadata);
    },
    async apply(mutation, signal) {
      const response = await client.applyAIDocumentOperations({ mutation }, signal ? { signal } : undefined);
      if (response.result.case === 'accepted') {
        return { accepted: response.result.value };
      }
      if (response.result.case === 'rejected') {
        return { rejected: response.result.value };
      }
      throw new Error('DCDP apply response is missing a result');
    },
  };
}
