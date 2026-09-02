export const MESH_OPTIMIZATION_METHOD_DRACO = 'draco' as const;

export type MeshOptimizationMethod = typeof MESH_OPTIMIZATION_METHOD_DRACO;

export type MeshOptimizationStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';

export interface MeshOptimizationCandidate {
  id: string;
  sourceFileId: string;
  fileId: string;
  url: string;
  fileName: string;
  fileSize: number;
  originalFileSize?: number;
  method: MeshOptimizationMethod;
  targetRatioPercent: number;
  status: MeshOptimizationStatus;
  triangleCount?: number;
  vertexCount?: number;
  originalTriangleCount?: number;
  originalVertexCount?: number;
  errorMessage?: string;
  createdAt?: string;
}

export interface MeshOptimizationCandidatesResult {
  candidates: MeshOptimizationCandidate[];
  error?: string;
}

export interface MeshOptimizationCandidateResult {
  candidate?: MeshOptimizationCandidate;
  error?: string;
}

export interface MeshOptimizationClearResult {
  success?: boolean;
  error?: string;
}

export function normalizeMeshOptimizationTargetRatioPercent(value: number) {
  if (!Number.isFinite(value)) {
    return 70;
  }
  return Math.min(100, Math.max(1, Math.round(value)));
}
