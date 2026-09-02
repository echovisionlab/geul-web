'use server';

import { isConnectError, isConnectErrorCode } from '@/lib/api/connect-error';
import { Code } from '@connectrpc/connect';
import { OgGenerationRunStatus } from '@echovisionlab/geul-proto/secure/admin_pb.ts';
import { OgEntityType, OgGenerationStatus } from '@echovisionlab/geul-proto/secure/events_pb.ts';
import { createAdminClient } from '@/lib/api/server-client';
import { getFixedOgTargetId } from '@/lib/og-generation-targets';
import type {
  OgGenerationEntityType,
  OgGenerationRunState,
  OgGenerationSelection,
  OgGenerationState,
  OgGenerationUiStatus,
} from '@/lib/types/og-generation';

const OG_ENTITY_TYPES: Record<OgGenerationEntityType, OgEntityType> = {
  post: OgEntityType.POST,
  page: OgEntityType.PAGE,
  work: OgEntityType.WORK,
  artist: OgEntityType.ARTIST,
  label: OgEntityType.LABEL,
  release: OgEntityType.RELEASE,
  series: OgEntityType.SERIES,
  form: OgEntityType.FORM,
  site: OgEntityType.SITE,
  privacy: OgEntityType.PRIVACY,
  terms: OgEntityType.TERMS,
};

const LOCALE_SCOPED_ENTITIES = new Set<OgGenerationEntityType>([
  'post',
  'page',
  'work',
  'artist',
  'series',
  'form',
  'privacy',
  'terms',
]);

function actionError(error: unknown, fallback: string): string {
  if (isConnectError(error)) {
    if (error.code === Code.Unauthenticated) {
      return 'Unauthorized';
    }
    if (error.code === Code.PermissionDenied) {
      return 'Forbidden';
    }
    return fallback;
  }
  if (error instanceof Error && ['Locale is required to regenerate this OG image'].includes(error.message)) {
    return error.message;
  }
  return fallback;
}

function normalizeEntityId(entityType: OgGenerationEntityType, entityId?: string): string | undefined {
  const fixed = getFixedOgTargetId(entityType);
  if (fixed) {
    return fixed;
  }
  const normalized = entityId?.trim();
  return normalized || undefined;
}

function selectionToProto(selection: OgGenerationSelection) {
  switch (selection.type) {
    case 'primary':
      return { target: { case: 'primary' as const, value: {} } };
    case 'locale': {
      const locale = selection.locale.trim();
      if (!locale) {
        throw new Error('Locale is required to regenerate this OG image');
      }
      return { target: { case: 'locale' as const, value: locale } };
    }
    case 'all_locales':
      return { target: { case: 'allLocales' as const, value: {} } };
  }
}

function generationStatusToUi(status: OgGenerationStatus): OgGenerationUiStatus {
  switch (status) {
    case OgGenerationStatus.QUEUED:
      return 'queued';
    case OgGenerationStatus.PROCESSING:
      return 'processing';
    case OgGenerationStatus.READY:
      return 'ready';
    case OgGenerationStatus.FAILED:
      return 'failed';
    case OgGenerationStatus.SUPERSEDED:
      return 'superseded';
    case OgGenerationStatus.CANCELLED:
      return 'cancelled';
    default:
      throw new Error(`Unsupported OG generation status: ${String(status)}`);
  }
}

function entityTypeFromProto(entityType: OgEntityType): OgGenerationEntityType | undefined {
  switch (entityType) {
    case OgEntityType.POST:
      return 'post';
    case OgEntityType.PAGE:
      return 'page';
    case OgEntityType.WORK:
      return 'work';
    case OgEntityType.ARTIST:
      return 'artist';
    case OgEntityType.LABEL:
      return 'label';
    case OgEntityType.RELEASE:
      return 'release';
    case OgEntityType.SERIES:
      return 'series';
    case OgEntityType.FORM:
      return 'form';
    case OgEntityType.SITE:
      return 'site';
    case OgEntityType.PRIVACY:
      return 'privacy';
    case OgEntityType.TERMS:
      return 'terms';
    default:
      return undefined;
  }
}

function runStatusToUi(status: OgGenerationRunStatus): OgGenerationRunState['status'] {
  switch (status) {
    case OgGenerationRunStatus.QUEUED:
      return 'queued';
    case OgGenerationRunStatus.PROCESSING:
      return 'processing';
    case OgGenerationRunStatus.READY:
      return 'ready';
    case OgGenerationRunStatus.PARTIALLY_FAILED:
      return 'partially_failed';
    case OgGenerationRunStatus.FAILED:
      return 'failed';
    case OgGenerationRunStatus.CANCELLED:
      return 'cancelled';
    default:
      throw new Error(`Unsupported OG generation run status: ${String(status)}`);
  }
}

function toGenerationState(generation: {
  generationId: string;
  runId: string;
  status: OgGenerationStatus;
  asset?: { assetId: string; url: string };
  errorCode?: string;
  error?: string;
  replacementGenerationId?: string;
}): OgGenerationState {
  return {
    generationId: generation.generationId,
    runId: generation.runId,
    status: generationStatusToUi(generation.status),
    assetId: generation.asset?.assetId,
    assetUrl: generation.asset?.url,
    errorCode: generation.errorCode,
    replacementGenerationId: generation.replacementGenerationId,
  };
}

export async function regenerateOgImageAction(input: {
  entityType: OgGenerationEntityType;
  entityId?: string;
  selection: OgGenerationSelection;
}): Promise<{ runId?: string; generationIds?: string[]; error?: string }> {
  try {
    const entityId = normalizeEntityId(input.entityType, input.entityId);
    const fixedEntityId = getFixedOgTargetId(input.entityType);
    if (!fixedEntityId && !entityId) {
      return { error: 'Entity ID is required to regenerate this OG image' };
    }
    const client = await createAdminClient();
    const response = await client.regenerateOgImage({
      entityType: OG_ENTITY_TYPES[input.entityType],
      entityId: fixedEntityId ? undefined : entityId,
      selection: selectionToProto(input.selection),
    });
    return { runId: response.runId, generationIds: [...response.generationIds] };
  } catch (error) {
    return { error: actionError(error, 'Failed to regenerate OG image') };
  }
}

export async function getOgGenerationAction(
  generationId: string,
): Promise<{ generation?: OgGenerationState; error?: string }> {
  try {
    const client = await createAdminClient();
    const response = await client.getOgGeneration({ generationId: generationId.trim() });
    if (!response.generation) {
      return { error: 'OG generation was not found' };
    }
    return { generation: toGenerationState(response.generation) };
  } catch (error) {
    return { error: actionError(error, 'Failed to load OG generation') };
  }
}

export async function getLatestOgGenerationAction(input: {
  entityType: OgGenerationEntityType;
  entityId?: string;
  locale?: string | null;
}): Promise<{ generation?: OgGenerationState; error?: string }> {
  try {
    const entityId = normalizeEntityId(input.entityType, input.entityId);
    if (!entityId) {
      return { error: 'Entity ID is required to load the latest OG generation' };
    }
    const locale = input.locale?.trim();
    const localeScoped = LOCALE_SCOPED_ENTITIES.has(input.entityType);
    if (localeScoped && !locale) {
      return { error: 'Locale is required to load the latest OG generation' };
    }
    if (!localeScoped && locale) {
      return { error: 'This OG target does not accept a locale' };
    }
    const client = await createAdminClient();
    const response = await client.getLatestOgGeneration({
      target: {
        entityType: OG_ENTITY_TYPES[input.entityType],
        entityId,
        scope: localeScoped ? { case: 'locale', value: { locale: locale as string } } : { case: 'entity', value: {} },
      },
    });
    if (!response.generation) {
      return {};
    }
    return { generation: toGenerationState(response.generation) };
  } catch (error) {
    if (isConnectErrorCode(error, Code.NotFound)) {
      return {};
    }
    return { error: actionError(error, 'Failed to load the latest OG generation') };
  }
}

export async function getOgGenerationRunAction(runId: string): Promise<{ run?: OgGenerationRunState; error?: string }> {
  try {
    const client = await createAdminClient();
    const response = await client.getOgGenerationRun({ runId: runId.trim() });
    if (!response.run) {
      return { error: 'OG generation run was not found' };
    }
    const run = response.run;
    return {
      run: {
        runId: run.runId,
        status: runStatusToUi(run.status),
        generationCount: run.generationCount,
        queuedCount: run.queuedCount,
        processingCount: run.processingCount,
        readyCount: run.readyCount,
        failedCount: run.failedCount,
        supersededCount: run.supersededCount,
        cancelledCount: run.cancelledCount,
        failures: run.failures.map((failure) => {
          const entityType = failure.target ? entityTypeFromProto(failure.target.entityType) : undefined;
          return {
            generationId: failure.generationId,
            target:
              failure.target && entityType
                ? {
                    entityType,
                    entityId: failure.target.entityId,
                    ...(failure.target.scope.case === 'locale' ? { locale: failure.target.scope.value.locale } : {}),
                  }
                : undefined,
            errorCode: failure.errorCode,
            error: failure.errorCode,
          };
        }),
      },
    };
  } catch (error) {
    return { error: actionError(error, 'Failed to load OG generation run') };
  }
}
