'use server';

import { logServerFailure } from '@/lib/logging/logger';

import { isConnectErrorCode } from '@/lib/api/connect-error';
import { Code } from '@connectrpc/connect';
import {
  MeshOptimizationCompressionMethod,
  MeshOptimizationProfile,
  TranscodeEntityType,
} from '@echovisionlab/geul-proto/secure/events_pb.ts';
import {
  MeshOptimizationCandidateStatus as ProtoMeshOptimizationCandidateStatus,
  type MeshOptimizationCandidate as ProtoMeshOptimizationCandidate,
} from '@echovisionlab/geul-proto/secure/file_pb.ts';
import { createFileClient } from '@/lib/api/server-client';
import {
  MESH_OPTIMIZATION_METHOD_DRACO,
  normalizeMeshOptimizationTargetRatioPercent,
  type MeshOptimizationCandidate,
  type MeshOptimizationCandidatesResult,
  type MeshOptimizationMethod,
  type MeshOptimizationStatus,
} from '@/lib/types/mesh-optimization';
import type { ActionResult } from '@/lib/actions/action-result';
import { actionFailureMessage, runAction, type ActionFailurePolicy } from '@/lib/actions/run-action';

interface MeshOptimizationRequestContext {
  sourceFileId: string;
  entityId: string;
  entityType: TranscodeEntityType;
  sectionId?: string;
  unitId?: string;
}

interface GenerateMeshOptimizationRequest extends MeshOptimizationRequestContext {
  method: MeshOptimizationMethod;
  targetRatioPercent: number;
}

interface UseMeshOptimizationRequest extends MeshOptimizationRequestContext {
  candidateId: string;
}

interface ClearMeshOptimizationRequest extends MeshOptimizationRequestContext {
  candidateId?: string;
}

const IMMERSIVE_SCENE_MESH_OPTIMIZATION_PROFILE = MeshOptimizationProfile.PARTICLE_MESH_V1;

function numberFrom(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'bigint') {
    return Number(value);
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function normalizeStatus(value: unknown): MeshOptimizationStatus | null {
  if (value === ProtoMeshOptimizationCandidateStatus.PENDING) {
    return 'pending';
  }
  if (value === ProtoMeshOptimizationCandidateStatus.PROCESSING) {
    return 'processing';
  }
  if (value === ProtoMeshOptimizationCandidateStatus.READY) {
    return 'completed';
  }
  if (value === ProtoMeshOptimizationCandidateStatus.FAILED) {
    return 'failed';
  }
  if (value === ProtoMeshOptimizationCandidateStatus.CANCELLED) {
    return 'cancelled';
  }
  const normalized = String(value || '').toLowerCase();
  if (normalized === 'completed' || normalized === 'ready' || normalized === 'succeeded') {
    return 'completed';
  }
  if (normalized === 'pending' || normalized === 'queued') {
    return 'pending';
  }
  if (normalized === 'processing' || normalized === 'running') {
    return 'processing';
  }
  if (normalized === 'failed' || normalized === 'error') {
    return 'failed';
  }
  if (normalized === 'cancelled' || normalized === 'canceled') {
    return 'cancelled';
  }
  return null;
}

function normalizeMethod(value: unknown): MeshOptimizationMethod | null {
  if (value === MeshOptimizationCompressionMethod.DRACO) {
    return MESH_OPTIMIZATION_METHOD_DRACO;
  }
  return String(value || '').toLowerCase() === MESH_OPTIMIZATION_METHOD_DRACO ? MESH_OPTIMIZATION_METHOD_DRACO : null;
}

function normalizeCandidate(candidate: ProtoMeshOptimizationCandidate | undefined): MeshOptimizationCandidate | null {
  if (!candidate) {
    return null;
  }
  const id = candidate.id || candidate.fileId || '';
  const sourceFileId = candidate.sourceFileId;
  const fileId = candidate.fileId || '';
  const delivery = candidate.delivery;
  const url = delivery?.asset?.url || delivery?.inline?.url || delivery?.download?.url || '';
  const fileSize = numberFrom(candidate.optimizedFileSize) ?? numberFrom(delivery?.fileSize);
  const originalFileSize = numberFrom(candidate.originalFileSize);
  const method = normalizeMethod(candidate.method);
  const targetRatioPercent = numberFrom(candidate.targetRatioPercent);
  const status = normalizeStatus(candidate.status);
  const fileName = status === 'completed' ? candidate.fileName || delivery?.fileName || '' : candidate.fileName || '';
  const errorMessage = candidate.errorMessage?.trim();

  if (!id || !sourceFileId || !method || !status) {
    return null;
  }
  if (status === 'completed' && (!fileId || !url || !fileName || !fileSize)) {
    return null;
  }

  return {
    id,
    sourceFileId,
    fileId,
    url,
    fileName,
    fileSize: fileSize ?? 0,
    originalFileSize,
    method,
    targetRatioPercent: normalizeMeshOptimizationTargetRatioPercent(targetRatioPercent ?? 70),
    status,
    triangleCount: numberFrom(candidate.optimizedTriangleCount),
    vertexCount: numberFrom(candidate.optimizedVertexCount),
    originalTriangleCount: numberFrom(candidate.originalTriangleCount),
    originalVertexCount: numberFrom(candidate.originalVertexCount),
    errorMessage: errorMessage || undefined,
    createdAt: undefined,
  };
}

function normalizeCandidateList(candidates: ProtoMeshOptimizationCandidate[]): MeshOptimizationCandidate[] {
  return candidates
    .map((candidate) => normalizeCandidate(candidate))
    .filter((candidate): candidate is MeshOptimizationCandidate => candidate !== null);
}

function normalizeCandidateResponse(
  candidate: ProtoMeshOptimizationCandidate | undefined,
): MeshOptimizationCandidate | undefined {
  return normalizeCandidate(candidate) ?? undefined;
}

const MESH_OPTIMIZATION_FAILURE_POLICY: ActionFailurePolicy = {
  fallback: 'Mesh optimization request failed',
  messages: {
    [Code.PermissionDenied]: 'Forbidden',
    [Code.Unimplemented]: 'Mesh optimization is not available.',
  },
};

function isStaleSourceFileNotFoundError(error: unknown): boolean {
  return isConnectErrorCode(error, Code.NotFound) && error.message.includes('source_file not found');
}

function toApiContext(input: MeshOptimizationRequestContext) {
  return {
    sourceFileId: input.sourceFileId,
    entityType: input.entityType,
    entityId: input.entityId,
  };
}

export async function isImmersiveSceneMeshOptimizationApiAvailableAction(): Promise<boolean> {
  try {
    await createFileClient();
    return true;
  } catch (error) {
    logServerFailure(
      'immersive-scene-optimization-actions',
      'isImmersiveSceneMeshOptimizationApiAvailableAction',
      error,
    );
    return false;
  }
}

export async function listImmersiveSceneMeshOptimizationCandidatesAction(
  input: MeshOptimizationRequestContext,
): Promise<MeshOptimizationCandidatesResult> {
  try {
    const client = await createFileClient();
    const response = await client.listMeshOptimizationCandidates({
      ...toApiContext(input),
      profile: IMMERSIVE_SCENE_MESH_OPTIMIZATION_PROFILE,
    });
    return { candidates: normalizeCandidateList(response.candidates) };
  } catch (error) {
    logServerFailure(
      'immersive-scene-optimization-actions',
      'listImmersiveSceneMeshOptimizationCandidatesAction',
      error,
    );
    if (isStaleSourceFileNotFoundError(error)) {
      return { candidates: [] };
    }
    return { candidates: [], error: actionFailureMessage(error, MESH_OPTIMIZATION_FAILURE_POLICY) };
  }
}

export async function generateImmersiveSceneMeshOptimizationCandidateAction(
  input: GenerateMeshOptimizationRequest,
): Promise<ActionResult<{ candidate: MeshOptimizationCandidate | undefined }>> {
  return runAction(
    'immersive-scene-optimization-actions',
    'generateImmersiveSceneMeshOptimizationCandidateAction',
    async () => {
      const client = await createFileClient();
      const targetRatioPercent = normalizeMeshOptimizationTargetRatioPercent(input.targetRatioPercent);
      const response = await client.generateMeshOptimizationCandidate({
        ...toApiContext(input),
        method: MeshOptimizationCompressionMethod.DRACO,
        targetRatioPercent,
        profile: IMMERSIVE_SCENE_MESH_OPTIMIZATION_PROFILE,
      });
      return { candidate: normalizeCandidateResponse(response.candidate) };
    },
    MESH_OPTIMIZATION_FAILURE_POLICY,
  );
}

export async function useImmersiveSceneMeshOptimizationCandidateAction(
  input: UseMeshOptimizationRequest,
): Promise<ActionResult<{ candidate: MeshOptimizationCandidate | undefined }>> {
  return runAction(
    'immersive-scene-optimization-actions',
    'useImmersiveSceneMeshOptimizationCandidateAction',
    async () => {
      const client = await createFileClient();
      const response = await client.useMeshOptimizationCandidate({
        candidateId: input.candidateId,
        sourceFileId: input.sourceFileId,
        entityType: input.entityType,
        entityId: input.entityId,
      });
      return { candidate: normalizeCandidateResponse(response.candidate) };
    },
    MESH_OPTIMIZATION_FAILURE_POLICY,
  );
}

export async function clearImmersiveSceneMeshOptimizationCandidatesAction(
  input: ClearMeshOptimizationRequest,
): Promise<ActionResult<{ success: boolean }>> {
  return runAction(
    'immersive-scene-optimization-actions',
    'clearImmersiveSceneMeshOptimizationCandidatesAction',
    async () => {
      const client = await createFileClient();
      const response = await client.clearMeshOptimizationCandidates({
        ...toApiContext(input),
        candidateId: input.candidateId,
        profile: IMMERSIVE_SCENE_MESH_OPTIMIZATION_PROFILE,
      });
      return { success: response.success };
    },
    MESH_OPTIMIZATION_FAILURE_POLICY,
  );
}
