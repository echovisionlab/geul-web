import type { MeshOptimizationCandidate } from '@/lib/types/mesh-optimization';
import type { MeshOptimizationSelection } from './MeshOptimizationPanel';
import type { RotationAxis, RotationAxisValues } from './RotationAxisInputs';
import type { ImmersiveSceneProps, ImmersiveSceneUnit } from './schema';

export function createImmersiveSceneUnit(name: string): ImmersiveSceneUnit {
  return {
    id: crypto.randomUUID(),
    name,
    mesh: 'sphere',
    color: '#f97316',
    title: '',
    text: '',
  };
}

export function replaceImmersiveSceneUnit(units: ImmersiveSceneUnit[], id: string, patch: Partial<ImmersiveSceneUnit>) {
  return units.map((unit) => (unit.id === id ? { ...unit, ...patch } : unit));
}

const ROTATION_AXIS_FIELDS = {
  rotation: { x: 'rotationX', y: 'rotationY', z: 'rotationZ' },
  rotationSpeed: { x: 'rotationSpeedX', y: 'rotationSpeedY', z: 'rotationSpeedZ' },
  scrollRotationTurns: { x: 'scrollRotationTurnsX', y: 'scrollRotationTurnsY', z: 'scrollRotationTurnsZ' },
} as const;

type RotationAxisFieldGroup = keyof typeof ROTATION_AXIS_FIELDS;

export function getRotationAxisValues(
  source: Partial<ImmersiveSceneProps> | Partial<ImmersiveSceneUnit>,
  group: RotationAxisFieldGroup,
): RotationAxisValues {
  const fields = ROTATION_AXIS_FIELDS[group];
  return { x: source[fields.x], y: source[fields.y], z: source[fields.z] };
}

export function buildRotationAxisPatch(
  group: RotationAxisFieldGroup,
  axis: RotationAxis,
  value: string | undefined,
): Partial<ImmersiveSceneUnit> {
  return { [ROTATION_AXIS_FIELDS[group][axis]]: value };
}

export function hasImmersiveSceneUnitCopy(units: ImmersiveSceneUnit[]) {
  return units.some((unit) => unit.title.trim() !== '' || unit.text.trim() !== '');
}

export function moveImmersiveSceneUnit(units: ImmersiveSceneUnit[], index: number, direction: -1 | 1) {
  const targetIndex = index + direction;
  if (targetIndex < 0 || targetIndex >= units.length) {
    return units;
  }

  const nextUnits = [...units];
  const [unit] = nextUnits.splice(index, 1);
  nextUnits.splice(targetIndex, 0, unit);
  return nextUnits;
}

export function buildSceneAssetSlotId(
  sectionId: string,
  unitId: string,
  assetType: 'mesh' | 'texture' | 'dark-texture',
) {
  return `page-block:${sectionId}:immersive-scene:${unitId}:${assetType}`;
}

export function resolveDarkTextureSourceInput(unit: ImmersiveSceneUnit) {
  if (unit.darkTextureSource) {
    return unit.darkTextureSource;
  }
  if (unit.darkTextureFileId || unit.darkTextureUrl) {
    return 'image';
  }
  if (unit.darkColor) {
    return 'color';
  }
  return 'inherit';
}

export function clearMeshOptimizationFields(): Partial<ImmersiveSceneUnit> {
  return {
    meshOptimizationCandidateId: undefined,
    meshOptimizationSourceFileId: undefined,
    meshOptimizationFileId: undefined,
    meshOptimizationUrl: undefined,
    meshOptimizationFileName: undefined,
    meshOptimizationFileSize: undefined,
    meshOptimizationOriginalFileSize: undefined,
    meshOptimizationMethod: undefined,
    meshOptimizationTargetRatioPercent: undefined,
    meshOptimizationTriangleCount: undefined,
    meshOptimizationVertexCount: undefined,
    meshOptimizationOriginalTriangleCount: undefined,
    meshOptimizationOriginalVertexCount: undefined,
  };
}

export interface RemovedMeshOptimizationSource {
  sourceFileId: string;
  unitId: string;
}

export function diffRemovedMeshOptimizationSources(
  previousUnits: ImmersiveSceneUnit[],
  nextUnits: ImmersiveSceneUnit[],
): RemovedMeshOptimizationSource[] {
  const nextSourceByUnitId = new Map(
    nextUnits.map((unit) => [unit.id, unit.meshFileId || unit.meshOptimizationSourceFileId]),
  );
  return previousUnits.flatMap((unit) => {
    const sourceFileId = unit.meshFileId || unit.meshOptimizationSourceFileId;
    if (!sourceFileId || nextSourceByUnitId.get(unit.id) === sourceFileId) {
      return [];
    }
    return [{ sourceFileId, unitId: unit.id }];
  });
}

export function formatAssetFileSize(fileSize: string | undefined) {
  const bytes = Number(fileSize);
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '';
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  const units = ['KB', 'MB', 'GB'];
  let size = bytes / 1024;
  for (const unit of units) {
    if (size < 1024 || unit === units.at(-1)) {
      return `${size >= 10 ? size.toFixed(0) : size.toFixed(1)} ${unit}`;
    }
    size /= 1024;
  }
  return '';
}

export function fileNameFromUrl(url: string | undefined) {
  if (!url) {
    return '';
  }
  try {
    const parsedUrl = new URL(url, 'https://app.local');
    const lastSegment = parsedUrl.pathname.split('/').filter(Boolean).at(-1);
    return decodeFileName(lastSegment);
  } catch {
    const path = url.split(/[?#]/)[0] ?? '';
    const lastSegment = path.split('/').filter(Boolean).at(-1);
    return decodeFileName(lastSegment);
  }
}

function decodeFileName(value: string | undefined) {
  if (!value) {
    return '';
  }
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

type ImmersiveSceneAssetKind = 'mesh' | 'texture' | 'darkTexture';

export function resolveAssetAttachment(unit: ImmersiveSceneUnit, kind: ImmersiveSceneAssetKind) {
  const fileId = kind === 'mesh' ? unit.meshFileId : kind === 'texture' ? unit.textureFileId : unit.darkTextureFileId;
  const url = kind === 'mesh' ? unit.meshUrl : kind === 'texture' ? unit.textureUrl : unit.darkTextureUrl;
  const fileName =
    kind === 'mesh' ? unit.meshFileName : kind === 'texture' ? unit.textureFileName : unit.darkTextureFileName;
  const fileSize =
    kind === 'mesh' ? unit.meshFileSize : kind === 'texture' ? unit.textureFileSize : unit.darkTextureFileSize;
  const sizeBytes = Number(fileSize);
  return {
    fileId,
    url,
    name: fileName || fileNameFromUrl(url) || fileId || '',
    size: formatAssetFileSize(fileSize),
    sizeBytes: Number.isFinite(sizeBytes) && sizeBytes > 0 ? sizeBytes : undefined,
  };
}

function numberStringFromOptional(value: number | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? String(value) : undefined;
}

export function resolveMeshOptimizationSelection(unit: ImmersiveSceneUnit): MeshOptimizationSelection | null {
  const candidateId = unit.meshOptimizationCandidateId?.trim();
  const fileId = unit.meshOptimizationFileId?.trim();
  const targetRatioPercent = Number(unit.meshOptimizationTargetRatioPercent);

  if (!candidateId && !fileId) {
    return null;
  }

  return {
    candidateId,
    fileId,
    targetRatioPercent: Number.isFinite(targetRatioPercent) ? targetRatioPercent : undefined,
  };
}

export function meshOptimizationPatchFromCandidate(
  unit: ImmersiveSceneUnit,
  candidate: MeshOptimizationCandidate,
): Partial<ImmersiveSceneUnit> {
  return {
    meshOptimizationCandidateId: candidate.id,
    meshOptimizationSourceFileId: candidate.sourceFileId || unit.meshFileId,
    meshOptimizationFileId: candidate.fileId,
    meshOptimizationUrl: candidate.url,
    meshOptimizationFileName: candidate.fileName,
    meshOptimizationFileSize: String(candidate.fileSize),
    meshOptimizationOriginalFileSize: numberStringFromOptional(candidate.originalFileSize),
    meshOptimizationMethod: candidate.method,
    meshOptimizationTargetRatioPercent: String(candidate.targetRatioPercent),
    meshOptimizationTriangleCount: numberStringFromOptional(candidate.triangleCount),
    meshOptimizationVertexCount: numberStringFromOptional(candidate.vertexCount),
    meshOptimizationOriginalTriangleCount: numberStringFromOptional(candidate.originalTriangleCount),
    meshOptimizationOriginalVertexCount: numberStringFromOptional(candidate.originalVertexCount),
  };
}
