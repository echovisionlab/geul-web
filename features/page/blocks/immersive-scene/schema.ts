import { z } from 'zod';
import { sanitizePageVisualUnitsJson } from '@echovisionlab/geul-common/collaboration/page';

export const IMMERSIVE_SCENE_MESH_VALUES = ['sphere', 'box', 'torus', 'cone'] as const;

export type ImmersiveSceneMesh = (typeof IMMERSIVE_SCENE_MESH_VALUES)[number];

const IMMERSIVE_SCENE_MESH_SOURCE_VALUES = ['primitive', 'file'] as const;

export const IMMERSIVE_SCENE_TEXTURE_SOURCE_VALUES = ['color', 'image'] as const;

export type ImmersiveSceneTextureSource = (typeof IMMERSIVE_SCENE_TEXTURE_SOURCE_VALUES)[number];

export const IMMERSIVE_SCENE_PLAYBACK_VALUES = ['scroll', 'autoplay'] as const;

export type ImmersiveScenePlayback = (typeof IMMERSIVE_SCENE_PLAYBACK_VALUES)[number];

export const IMMERSIVE_SCENE_PREFERRED_SCHEME_VALUES = ['auto', 'light', 'dark'] as const;

export type ImmersiveScenePreferredScheme = (typeof IMMERSIVE_SCENE_PREFERRED_SCHEME_VALUES)[number];

export const IMMERSIVE_SCENE_TEXT_COLOR_SOURCE_VALUES = ['theme', 'custom'] as const;

export type ImmersiveSceneTextColorSource = (typeof IMMERSIVE_SCENE_TEXT_COLOR_SOURCE_VALUES)[number];

export const IMMERSIVE_SCENE_DARK_TEXT_COLOR_SOURCE_VALUES = ['inherit', 'custom'] as const;

export type ImmersiveSceneDarkTextColorSource = (typeof IMMERSIVE_SCENE_DARK_TEXT_COLOR_SOURCE_VALUES)[number];

export const IMMERSIVE_SCENE_TEXTURE_SIZE_VALUES = ['32', '64', '96', '128'] as const;

export const DEFAULT_IMMERSIVE_SCENE_UNIT_HOLD_SECONDS = 5;
export const DEFAULT_IMMERSIVE_SCENE_UNIT_GAP_SECONDS = 1.5;

const IMMERSIVE_SCENE_TRANSITION_VALUES = ['linear', 'smooth'] as const;

const defaultVisualUnits = [
  { id: 'who-we-are', mesh: 'sphere', color: '#d8dde5' },
  { id: 'what-we-explore', mesh: 'torus', color: '#f97316' },
  { id: 'our-goal', mesh: 'cone', color: '#fb923c' },
] as const;

export const immersiveSceneUnitVisualSchema = z.object({
  id: z.string().min(1),
  name: z.string().optional(),
  attribution: z.string().optional(),
  mesh: z.enum(IMMERSIVE_SCENE_MESH_VALUES).default('sphere'),
  meshSource: z.enum(IMMERSIVE_SCENE_MESH_SOURCE_VALUES).optional(),
  meshFileId: z.string().optional(),
  meshUrl: z.string().optional(),
  meshFileName: z.string().optional(),
  meshFileSize: z.string().optional(),
  meshObjectName: z.string().optional(),
  meshOptimizationCandidateId: z.string().optional(),
  meshOptimizationSourceFileId: z.string().optional(),
  meshOptimizationFileId: z.string().optional(),
  meshOptimizationUrl: z.string().optional(),
  meshOptimizationFileName: z.string().optional(),
  meshOptimizationFileSize: z.string().optional(),
  meshOptimizationOriginalFileSize: z.string().optional(),
  meshOptimizationMethod: z.literal('draco').optional(),
  meshOptimizationTargetRatioPercent: z.string().optional(),
  meshOptimizationTriangleCount: z.string().optional(),
  meshOptimizationVertexCount: z.string().optional(),
  meshOptimizationOriginalTriangleCount: z.string().optional(),
  meshOptimizationOriginalVertexCount: z.string().optional(),
  scale: z.string().optional(),
  meshOffsetY: z.string().optional(),
  particleSize: z.string().optional(),
  holdSeconds: z.string().optional(),
  rotationX: z.string().optional(),
  rotationY: z.string().optional(),
  rotationZ: z.string().optional(),
  rotationSpeedX: z.string().optional(),
  rotationSpeedY: z.string().optional(),
  rotationSpeedZ: z.string().optional(),
  scrollRotationTurnsX: z.string().optional(),
  scrollRotationTurnsY: z.string().optional(),
  scrollRotationTurnsZ: z.string().optional(),
  color: z.string().default('#d8dde5'),
  textureSource: z.enum(IMMERSIVE_SCENE_TEXTURE_SOURCE_VALUES).optional(),
  textureFileId: z.string().optional(),
  textureUrl: z.string().optional(),
  textureFileName: z.string().optional(),
  textureFileSize: z.string().optional(),
  darkColor: z.string().optional(),
  darkTextureSource: z.enum(IMMERSIVE_SCENE_TEXTURE_SOURCE_VALUES).optional(),
  darkTextureFileId: z.string().optional(),
  darkTextureUrl: z.string().optional(),
  darkTextureFileName: z.string().optional(),
  darkTextureFileSize: z.string().optional(),
});

export const immersiveSceneUnitCopySchema = z.object({
  id: z.string().min(1),
  title: z.string().default(''),
  text: z.string().default(''),
});

export const immersiveSceneSchema = z.object({
  unitsJson: z.string().default(JSON.stringify(defaultVisualUnits)),
  copyJson: z.string().default(''),
  playback: z.enum(IMMERSIVE_SCENE_PLAYBACK_VALUES).default('scroll'),
  loop: z.string().default('false'),
  transition: z.enum(IMMERSIVE_SCENE_TRANSITION_VALUES).default('smooth'),
  transitionWindow: z.string().default('0.22'),
  textureSize: z.enum(IMMERSIVE_SCENE_TEXTURE_SIZE_VALUES).default('64'),
  heightVh: z.string().default('360'),
  minHeightPx: z.string().default('720'),
  unitHoldSeconds: z.string().default(String(DEFAULT_IMMERSIVE_SCENE_UNIT_HOLD_SECONDS)),
  unitGapSeconds: z.string().default(String(DEFAULT_IMMERSIVE_SCENE_UNIT_GAP_SECONDS)),
  particleSize: z.string().default('1'),
  particleBrightness: z.string().default('1.25'),
  backgroundColor: z.string().default('#070a0d'),
  backgroundEnabled: z.string().default('true'),
  preferredScheme: z.enum(IMMERSIVE_SCENE_PREFERRED_SCHEME_VALUES).default('auto'),
  textColorSource: z.enum(IMMERSIVE_SCENE_TEXT_COLOR_SOURCE_VALUES).default('theme'),
  lightTextColor: z.string().default('#111827'),
  darkTextColorSource: z.enum(IMMERSIVE_SCENE_DARK_TEXT_COLOR_SOURCE_VALUES).default('inherit'),
  darkTextColor: z.string().default('#f8fafc'),
  darkBackgroundColor: z.string().default('#030712'),
  darkParticleBrightness: z.string().default('1.45'),
  rotationEnabled: z.string().default('true'),
  rotationX: z.string().default('0'),
  rotationY: z.string().default('0'),
  rotationZ: z.string().default('0'),
  rotationSpeedX: z.string().default('0'),
  rotationSpeedY: z.string().default('0.18'),
  rotationSpeedZ: z.string().default('0'),
  scrollRotationEnabled: z.string().default('true'),
  scrollRotationTurnsX: z.string().default('0'),
  scrollRotationTurnsY: z.string().default('0.35'),
  scrollRotationTurnsZ: z.string().default('0'),
  hoverEnabled: z.string().default('true'),
  hoverRepelRadius: z.string().default('0.45'),
});

export type ImmersiveSceneProps = z.infer<typeof immersiveSceneSchema>;
export type ImmersiveSceneUnitVisual = z.infer<typeof immersiveSceneUnitVisualSchema>;
export type ImmersiveSceneUnitCopy = z.infer<typeof immersiveSceneUnitCopySchema>;

export interface ImmersiveSceneUnit extends ImmersiveSceneUnitVisual, ImmersiveSceneUnitCopy {}

export interface ImmersiveSceneConfig extends ImmersiveSceneProps {
  units: ImmersiveSceneUnit[];
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function resolveImmersiveSceneUnitMeshScale(scale: string | undefined) {
  const parsed = Number(scale ?? '1');
  if (!Number.isFinite(parsed)) {
    return 1;
  }
  return clampNumber(parsed, 0.1, 8);
}

export function resolveImmersiveSceneUnitMeshOffsetY(meshOffsetY: string | undefined) {
  const parsed = Number(meshOffsetY ?? '0');
  if (!Number.isFinite(parsed)) {
    return 0;
  }
  return clampNumber(parsed, -5, 5);
}

export function resolveImmersiveSceneUnitParticleSize(particleSize: string | undefined, fallbackParticleSize: number) {
  const fallback = Number.isFinite(fallbackParticleSize) ? clampNumber(fallbackParticleSize, 0.2, 5) : 1;
  if (particleSize == null || particleSize.trim() === '') {
    return fallback;
  }

  const parsed = Number(particleSize);
  return Number.isFinite(parsed) ? clampNumber(parsed, 0.2, 5) : fallback;
}

function parseJsonArray(value: unknown): unknown[] | null {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value !== 'string' || value.trim() === '') {
    return null;
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function parseVisualUnits(value: unknown): ImmersiveSceneUnitVisual[] {
  const parsed = parseJsonArray(value) ?? [...defaultVisualUnits];
  const units = parsed
    .map((item, index) => {
      const fallback = defaultVisualUnits[index % defaultVisualUnits.length];
      const itemRecord = typeof item === 'object' && item !== null ? (item as Record<string, unknown>) : {};
      return immersiveSceneUnitVisualSchema.safeParse({
        id: 'id' in itemRecord ? itemRecord.id : fallback.id,
        name: 'name' in itemRecord ? itemRecord.name : undefined,
        attribution: 'attribution' in itemRecord ? itemRecord.attribution : undefined,
        mesh: 'mesh' in itemRecord ? itemRecord.mesh : fallback.mesh,
        meshSource: 'meshSource' in itemRecord ? itemRecord.meshSource : undefined,
        meshFileId: 'meshFileId' in itemRecord ? itemRecord.meshFileId : undefined,
        meshUrl: 'meshUrl' in itemRecord ? itemRecord.meshUrl : undefined,
        meshFileName: 'meshFileName' in itemRecord ? itemRecord.meshFileName : undefined,
        meshFileSize: 'meshFileSize' in itemRecord ? itemRecord.meshFileSize : undefined,
        meshObjectName: 'meshObjectName' in itemRecord ? itemRecord.meshObjectName : undefined,
        meshOptimizationCandidateId:
          'meshOptimizationCandidateId' in itemRecord ? itemRecord.meshOptimizationCandidateId : undefined,
        meshOptimizationSourceFileId:
          'meshOptimizationSourceFileId' in itemRecord ? itemRecord.meshOptimizationSourceFileId : undefined,
        meshOptimizationFileId: 'meshOptimizationFileId' in itemRecord ? itemRecord.meshOptimizationFileId : undefined,
        meshOptimizationUrl: 'meshOptimizationUrl' in itemRecord ? itemRecord.meshOptimizationUrl : undefined,
        meshOptimizationFileName:
          'meshOptimizationFileName' in itemRecord ? itemRecord.meshOptimizationFileName : undefined,
        meshOptimizationFileSize:
          'meshOptimizationFileSize' in itemRecord ? itemRecord.meshOptimizationFileSize : undefined,
        meshOptimizationOriginalFileSize:
          'meshOptimizationOriginalFileSize' in itemRecord ? itemRecord.meshOptimizationOriginalFileSize : undefined,
        meshOptimizationMethod: 'meshOptimizationMethod' in itemRecord ? itemRecord.meshOptimizationMethod : undefined,
        meshOptimizationTargetRatioPercent:
          'meshOptimizationTargetRatioPercent' in itemRecord
            ? itemRecord.meshOptimizationTargetRatioPercent
            : 'meshOptimizationQuality' in itemRecord
              ? itemRecord.meshOptimizationQuality
              : undefined,
        meshOptimizationTriangleCount:
          'meshOptimizationTriangleCount' in itemRecord ? itemRecord.meshOptimizationTriangleCount : undefined,
        meshOptimizationVertexCount:
          'meshOptimizationVertexCount' in itemRecord ? itemRecord.meshOptimizationVertexCount : undefined,
        meshOptimizationOriginalTriangleCount:
          'meshOptimizationOriginalTriangleCount' in itemRecord
            ? itemRecord.meshOptimizationOriginalTriangleCount
            : undefined,
        meshOptimizationOriginalVertexCount:
          'meshOptimizationOriginalVertexCount' in itemRecord
            ? itemRecord.meshOptimizationOriginalVertexCount
            : undefined,
        scale: 'scale' in itemRecord ? itemRecord.scale : undefined,
        meshOffsetY: 'meshOffsetY' in itemRecord ? itemRecord.meshOffsetY : undefined,
        particleSize: 'particleSize' in itemRecord ? itemRecord.particleSize : undefined,
        holdSeconds: 'holdSeconds' in itemRecord ? itemRecord.holdSeconds : undefined,
        rotationX: 'rotationX' in itemRecord ? itemRecord.rotationX : undefined,
        rotationY: 'rotationY' in itemRecord ? itemRecord.rotationY : undefined,
        rotationZ: 'rotationZ' in itemRecord ? itemRecord.rotationZ : undefined,
        rotationSpeedX: 'rotationSpeedX' in itemRecord ? itemRecord.rotationSpeedX : undefined,
        rotationSpeedY: 'rotationSpeedY' in itemRecord ? itemRecord.rotationSpeedY : undefined,
        rotationSpeedZ: 'rotationSpeedZ' in itemRecord ? itemRecord.rotationSpeedZ : undefined,
        scrollRotationTurnsX: 'scrollRotationTurnsX' in itemRecord ? itemRecord.scrollRotationTurnsX : undefined,
        scrollRotationTurnsY: 'scrollRotationTurnsY' in itemRecord ? itemRecord.scrollRotationTurnsY : undefined,
        scrollRotationTurnsZ: 'scrollRotationTurnsZ' in itemRecord ? itemRecord.scrollRotationTurnsZ : undefined,
        color: 'color' in itemRecord ? itemRecord.color : fallback.color,
        textureSource: 'textureSource' in itemRecord ? itemRecord.textureSource : undefined,
        textureFileId: 'textureFileId' in itemRecord ? itemRecord.textureFileId : undefined,
        textureUrl: 'textureUrl' in itemRecord ? itemRecord.textureUrl : undefined,
        textureFileName: 'textureFileName' in itemRecord ? itemRecord.textureFileName : undefined,
        textureFileSize: 'textureFileSize' in itemRecord ? itemRecord.textureFileSize : undefined,
        darkColor: 'darkColor' in itemRecord ? itemRecord.darkColor : undefined,
        darkTextureSource: 'darkTextureSource' in itemRecord ? itemRecord.darkTextureSource : undefined,
        darkTextureFileId: 'darkTextureFileId' in itemRecord ? itemRecord.darkTextureFileId : undefined,
        darkTextureUrl: 'darkTextureUrl' in itemRecord ? itemRecord.darkTextureUrl : undefined,
        darkTextureFileName: 'darkTextureFileName' in itemRecord ? itemRecord.darkTextureFileName : undefined,
        darkTextureFileSize: 'darkTextureFileSize' in itemRecord ? itemRecord.darkTextureFileSize : undefined,
      });
    })
    .filter((result): result is z.ZodSafeParseSuccess<ImmersiveSceneUnitVisual> => result.success)
    .map(
      (result) =>
        Object.fromEntries(
          Object.entries(result.data).filter(([, fieldValue]) => fieldValue !== undefined),
        ) as ImmersiveSceneUnitVisual,
    );

  return units.length > 0 ? units : [...defaultVisualUnits];
}

function parseCopyUnits(value: unknown, visualUnits: ImmersiveSceneUnitVisual[]): ImmersiveSceneUnitCopy[] {
  const parsed = parseJsonArray(value) ?? [];
  const byId = new Map<string, ImmersiveSceneUnitCopy>();

  for (const item of parsed) {
    const itemRecord = typeof item === 'object' && item !== null ? (item as Record<string, unknown>) : {};
    const result = immersiveSceneUnitCopySchema.safeParse({
      id: 'id' in itemRecord ? itemRecord.id : undefined,
      title: 'title' in itemRecord ? itemRecord.title : undefined,
      text: 'text' in itemRecord ? itemRecord.text : undefined,
    });

    if (result.success) {
      byId.set(result.data.id, result.data);
    }
  }

  return visualUnits.map((unit) => {
    return (
      byId.get(unit.id) ?? {
        id: unit.id,
        title: '',
        text: '',
      }
    );
  });
}

export function parseImmersiveSceneUnits(unitsJson: unknown, copyJson: unknown): ImmersiveSceneUnit[] {
  const visualUnits = parseVisualUnits(unitsJson);
  const copyUnits = parseCopyUnits(copyJson, visualUnits);
  const copyById = new Map(copyUnits.map((unit) => [unit.id, unit]));

  return visualUnits.map((unit, index) => ({
    ...unit,
    ...(copyById.get(unit.id) ?? copyUnits[index]),
  }));
}

export function parseImmersiveSceneProps(data: unknown): ImmersiveSceneProps {
  return immersiveSceneSchema.parse(data ?? {});
}

export function parseImmersiveSceneConfig(data: unknown): ImmersiveSceneConfig {
  const props = parseImmersiveSceneProps(data);
  return {
    ...props,
    units: parseImmersiveSceneUnits(props.unitsJson, props.copyJson),
  };
}

export function serializeImmersiveSceneVisualUnits(units: ImmersiveSceneUnit[]): string {
  return sanitizePageVisualUnitsJson(
    JSON.stringify(
      units.map((unit) => {
        const visual: Record<string, string> = {
          id: unit.id,
          mesh: unit.mesh,
          color: unit.color,
        };
        for (const key of [
          'name',
          'attribution',
          'meshSource',
          'meshFileId',
          'meshUrl',
          'meshFileName',
          'meshFileSize',
          'meshObjectName',
          'meshOptimizationCandidateId',
          'meshOptimizationSourceFileId',
          'meshOptimizationFileId',
          'meshOptimizationUrl',
          'meshOptimizationFileName',
          'meshOptimizationFileSize',
          'meshOptimizationOriginalFileSize',
          'meshOptimizationMethod',
          'meshOptimizationTargetRatioPercent',
          'meshOptimizationTriangleCount',
          'meshOptimizationVertexCount',
          'meshOptimizationOriginalTriangleCount',
          'meshOptimizationOriginalVertexCount',
          'scale',
          'meshOffsetY',
          'particleSize',
          'holdSeconds',
          'rotationX',
          'rotationY',
          'rotationZ',
          'rotationSpeedX',
          'rotationSpeedY',
          'rotationSpeedZ',
          'scrollRotationTurnsX',
          'scrollRotationTurnsY',
          'scrollRotationTurnsZ',
          'textureSource',
          'textureFileId',
          'textureUrl',
          'textureFileName',
          'textureFileSize',
          'darkColor',
          'darkTextureSource',
          'darkTextureFileId',
          'darkTextureUrl',
          'darkTextureFileName',
          'darkTextureFileSize',
        ] as const) {
          const value = unit[key];
          if (typeof value === 'string' && value.trim() !== '') {
            visual[key] = value;
          }
        }
        return visual;
      }),
    ),
  );
}

export function serializeImmersiveSceneCopyUnits(units: ImmersiveSceneUnit[]): string {
  return JSON.stringify(
    units.map((unit) => ({
      id: unit.id,
      title: unit.title,
      text: unit.text,
    })),
  );
}

export function collectImmersiveSceneAssetFileIds(units: ImmersiveSceneUnit[]): Set<string> {
  const fileIds = new Set<string>();
  for (const unit of units) {
    for (const fileId of [unit.meshFileId, unit.meshOptimizationFileId, unit.textureFileId, unit.darkTextureFileId]) {
      if (typeof fileId === 'string' && fileId.trim() !== '') {
        fileIds.add(fileId);
      }
    }
  }
  return fileIds;
}

export function diffRemovedImmersiveSceneAssetFileIds(
  previousUnits: ImmersiveSceneUnit[],
  nextUnits: ImmersiveSceneUnit[],
): string[] {
  const previousFileIds = collectImmersiveSceneAssetFileIds(previousUnits);
  const nextFileIds = collectImmersiveSceneAssetFileIds(nextUnits);
  return [...previousFileIds].filter((fileId) => !nextFileIds.has(fileId));
}
