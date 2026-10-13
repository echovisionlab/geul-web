import * as z from '@/lib/zod-mini';
import { sanitizePageVisualUnitsJson } from '@echovisionlab/geul-common/collaboration/page';
import { invariantTokens } from '@/components/core/design-tokens';

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
  id: z.string().check(z.minLength(1)),
  name: z.optional(z.string()),
  attribution: z.optional(z.string()),
  mesh: z._default(z.enum(IMMERSIVE_SCENE_MESH_VALUES), 'sphere'),
  meshSource: z.optional(z.enum(IMMERSIVE_SCENE_MESH_SOURCE_VALUES)),
  meshFileId: z.optional(z.string()),
  meshUrl: z.optional(z.string()),
  meshFileName: z.optional(z.string()),
  meshFileSize: z.optional(z.string()),
  meshObjectName: z.optional(z.string()),
  meshOptimizationCandidateId: z.optional(z.string()),
  meshOptimizationSourceFileId: z.optional(z.string()),
  meshOptimizationFileId: z.optional(z.string()),
  meshOptimizationUrl: z.optional(z.string()),
  meshOptimizationFileName: z.optional(z.string()),
  meshOptimizationFileSize: z.optional(z.string()),
  meshOptimizationOriginalFileSize: z.optional(z.string()),
  meshOptimizationMethod: z.optional(z.literal('draco')),
  meshOptimizationTargetRatioPercent: z.optional(z.string()),
  meshOptimizationTriangleCount: z.optional(z.string()),
  meshOptimizationVertexCount: z.optional(z.string()),
  meshOptimizationOriginalTriangleCount: z.optional(z.string()),
  meshOptimizationOriginalVertexCount: z.optional(z.string()),
  scale: z.optional(z.string()),
  meshOffsetY: z.optional(z.string()),
  particleSize: z.optional(z.string()),
  holdSeconds: z.optional(z.string()),
  rotationX: z.optional(z.string()),
  rotationY: z.optional(z.string()),
  rotationZ: z.optional(z.string()),
  rotationSpeedX: z.optional(z.string()),
  rotationSpeedY: z.optional(z.string()),
  rotationSpeedZ: z.optional(z.string()),
  scrollRotationTurnsX: z.optional(z.string()),
  scrollRotationTurnsY: z.optional(z.string()),
  scrollRotationTurnsZ: z.optional(z.string()),
  color: z._default(z.string(), '#d8dde5'),
  textureSource: z.optional(z.enum(IMMERSIVE_SCENE_TEXTURE_SOURCE_VALUES)),
  textureFileId: z.optional(z.string()),
  textureUrl: z.optional(z.string()),
  textureFileName: z.optional(z.string()),
  textureFileSize: z.optional(z.string()),
  darkColor: z.optional(z.string()),
  darkTextureSource: z.optional(z.enum(IMMERSIVE_SCENE_TEXTURE_SOURCE_VALUES)),
  darkTextureFileId: z.optional(z.string()),
  darkTextureUrl: z.optional(z.string()),
  darkTextureFileName: z.optional(z.string()),
  darkTextureFileSize: z.optional(z.string()),
});

export const immersiveSceneUnitCopySchema = z.object({
  id: z.string().check(z.minLength(1)),
  title: z._default(z.string(), ''),
  text: z._default(z.string(), ''),
});

export const immersiveSceneSchema = z.object({
  unitsJson: z._default(z.string(), JSON.stringify(defaultVisualUnits)),
  copyJson: z._default(z.string(), ''),
  playback: z._default(z.enum(IMMERSIVE_SCENE_PLAYBACK_VALUES), 'scroll'),
  loop: z._default(z.string(), 'false'),
  transition: z._default(z.enum(IMMERSIVE_SCENE_TRANSITION_VALUES), 'smooth'),
  transitionWindow: z._default(z.string(), '0.22'),
  textureSize: z._default(z.enum(IMMERSIVE_SCENE_TEXTURE_SIZE_VALUES), '64'),
  heightVh: z._default(z.string(), '360'),
  minHeightPx: z._default(z.string(), '720'),
  unitHoldSeconds: z._default(z.string(), String(DEFAULT_IMMERSIVE_SCENE_UNIT_HOLD_SECONDS)),
  unitGapSeconds: z._default(z.string(), String(DEFAULT_IMMERSIVE_SCENE_UNIT_GAP_SECONDS)),
  particleSize: z._default(z.string(), '1'),
  particleBrightness: z._default(z.string(), '1.25'),
  backgroundColor: z._default(z.string(), invariantTokens['paper-background']),
  backgroundEnabled: z._default(z.string(), 'true'),
  preferredScheme: z._default(z.enum(IMMERSIVE_SCENE_PREFERRED_SCHEME_VALUES), 'auto'),
  textColorSource: z._default(z.enum(IMMERSIVE_SCENE_TEXT_COLOR_SOURCE_VALUES), 'theme'),
  lightTextColor: z._default(z.string(), '#111827'),
  darkTextColorSource: z._default(z.enum(IMMERSIVE_SCENE_DARK_TEXT_COLOR_SOURCE_VALUES), 'inherit'),
  darkTextColor: z._default(z.string(), '#f8fafc'),
  darkBackgroundColor: z._default(z.string(), '#030712'),
  darkParticleBrightness: z._default(z.string(), '1.45'),
  rotationEnabled: z._default(z.string(), 'true'),
  rotationX: z._default(z.string(), '0'),
  rotationY: z._default(z.string(), '0'),
  rotationZ: z._default(z.string(), '0'),
  rotationSpeedX: z._default(z.string(), '0'),
  rotationSpeedY: z._default(z.string(), '0.18'),
  rotationSpeedZ: z._default(z.string(), '0'),
  scrollRotationEnabled: z._default(z.string(), 'true'),
  scrollRotationTurnsX: z._default(z.string(), '0'),
  scrollRotationTurnsY: z._default(z.string(), '0.35'),
  scrollRotationTurnsZ: z._default(z.string(), '0'),
  hoverEnabled: z._default(z.string(), 'true'),
  hoverRepelRadius: z._default(z.string(), '0.45'),
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
    .filter((result): result is z.core.util.SafeParseSuccess<ImmersiveSceneUnitVisual> => result.success)
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
