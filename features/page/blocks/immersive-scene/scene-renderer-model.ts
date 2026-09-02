import {
  DEFAULT_IMMERSIVE_SCENE_UNIT_GAP_SECONDS,
  DEFAULT_IMMERSIVE_SCENE_UNIT_HOLD_SECONDS,
  resolveImmersiveSceneUnitMeshOffsetY,
  resolveImmersiveSceneUnitMeshScale,
  resolveImmersiveSceneUnitParticleSize,
  type ImmersiveSceneConfig,
  type ImmersiveScenePreferredScheme,
  type ImmersiveSceneTextureSource,
  type ImmersiveSceneUnit,
} from './schema';
import type { RotationVector } from './rotation';

export type SceneColorScheme = 'light' | 'dark';

interface ThemedUnitTexture {
  source: ImmersiveSceneTextureSource;
  color: string;
  fileId?: string;
  url?: string;
}

interface SceneTextColors {
  root: string;
  title: string;
  body: string;
}

type SceneTextColorConfig = Pick<
  ImmersiveSceneConfig,
  'textColorSource' | 'lightTextColor' | 'darkTextColorSource' | 'darkTextColor'
>;

interface MeshScale {
  x: number;
  y: number;
  z: number;
}

export interface AutoplayClockState {
  elapsedSeconds: number;
  lastFrameTimestamp: number | null;
}

const MAX_AUTOPLAY_FRAME_DELTA_SECONDS = 0.25;

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function parseNumber(value: string, fallback: number, options: { min: number; max: number }) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return clamp(parsed, options.min, options.max);
}

export function parseOptionalNumber(value: string | undefined, options: { min: number; max: number }) {
  if (typeof value !== 'string' || value.trim() === '') {
    return undefined;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return undefined;
  }
  return clamp(parsed, options.min, options.max);
}

export function parseBoolean(value: string | undefined, fallback: boolean) {
  if (value === 'true') {
    return true;
  }
  if (value === 'false') {
    return false;
  }
  return fallback;
}

export function resolveParticleGeometryScale(particleSize: number) {
  return particleSize;
}

export function resolveParticleSizeAtProgress(
  units: ImmersiveSceneUnit[],
  progress: number,
  loop: boolean,
  defaultParticleSize: number,
) {
  const sequence = resolveRenderUnitSequence(units, loop);
  if (sequence.length === 0) {
    return defaultParticleSize;
  }
  if (sequence.length === 1) {
    return resolveImmersiveSceneUnitParticleSize(sequence[0].particleSize, defaultParticleSize);
  }

  const scaledProgress = clamp(progress, 0, 1) * (sequence.length - 1);
  const indexA = Math.min(Math.floor(scaledProgress), sequence.length - 1);
  const indexB = Math.min(indexA + 1, sequence.length - 1);
  const localProgress = scaledProgress - indexA;
  const sizeA = resolveImmersiveSceneUnitParticleSize(sequence[indexA].particleSize, defaultParticleSize);
  const sizeB = resolveImmersiveSceneUnitParticleSize(sequence[indexB].particleSize, defaultParticleSize);
  return sizeA + (sizeB - sizeA) * localProgress;
}

export function resolveMeshOffsetYAtProgress(units: ImmersiveSceneUnit[], progress: number, loop: boolean) {
  const sequence = resolveRenderUnitSequence(units, loop);
  if (sequence.length === 0) {
    return 0;
  }
  if (sequence.length === 1) {
    return resolveImmersiveSceneUnitMeshOffsetY(sequence[0].meshOffsetY);
  }

  const scaledProgress = clamp(progress, 0, 1) * (sequence.length - 1);
  const indexA = Math.min(Math.floor(scaledProgress), sequence.length - 1);
  const indexB = Math.min(indexA + 1, sequence.length - 1);
  const localProgress = scaledProgress - indexA;
  const offsetA = resolveImmersiveSceneUnitMeshOffsetY(sequence[indexA].meshOffsetY);
  const offsetB = resolveImmersiveSceneUnitMeshOffsetY(sequence[indexB].meshOffsetY);
  return offsetA + (offsetB - offsetA) * localProgress;
}

export function resolveRendererUnitSignature(units: ImmersiveSceneUnit[]) {
  return units
    .map((unit) =>
      [
        unit.id,
        unit.mesh,
        unit.meshSource,
        unit.meshFileId,
        unit.meshUrl,
        unit.meshOptimizationFileId,
        unit.meshOptimizationUrl,
        unit.meshObjectName,
        unit.scale,
        unit.particleSize,
        unit.color,
        unit.textureSource,
        unit.textureFileId,
        unit.textureUrl,
        unit.darkColor,
        unit.darkTextureSource,
        unit.darkTextureFileId,
        unit.darkTextureUrl,
      ].join(':'),
    )
    .join('|');
}

export function resolveMeshOffsetYSignature(units: ImmersiveSceneUnit[]) {
  return units.map((unit) => `${unit.id}:${resolveImmersiveSceneUnitMeshOffsetY(unit.meshOffsetY)}`).join('|');
}

interface RotatableParticleObject {
  rotation: { set: (x: number, y: number, z: number) => void };
  updateMatrixWorld: (force?: boolean) => void;
}

interface TransformableParticleObject extends RotatableParticleObject {
  position: { set: (x: number, y: number, z: number) => void };
}

export function applyParticleObjectRotation(object: RotatableParticleObject, rotation: RotationVector) {
  object.rotation.set(rotation.x, rotation.y, rotation.z);
  object.updateMatrixWorld(true);
}

export function applyParticleObjectTransform(
  object: TransformableParticleObject,
  rotation: RotationVector,
  meshOffsetY: number,
) {
  object.position.set(0, meshOffsetY, 0);
  object.rotation.set(rotation.x, rotation.y, rotation.z);
  object.updateMatrixWorld(true);
}

export function resolveUnitMeshScale(unit: Pick<ImmersiveSceneUnit, 'scale'>) {
  return resolveImmersiveSceneUnitMeshScale(unit.scale);
}

export function resolveLoadedMeshScale(baseScale: MeshScale, unit: Pick<ImmersiveSceneUnit, 'scale'>): MeshScale {
  const multiplier = resolveUnitMeshScale(unit);
  return {
    x: baseScale.x * multiplier,
    y: baseScale.y * multiplier,
    z: baseScale.z * multiplier,
  };
}

export function resolveSceneColorScheme(
  preferredScheme: ImmersiveScenePreferredScheme,
  computedColorScheme: SceneColorScheme,
): SceneColorScheme {
  if (preferredScheme === 'light' || preferredScheme === 'dark') {
    return preferredScheme;
  }
  return computedColorScheme;
}

function nonEmptyColor(value: string | undefined, fallback: string) {
  return value?.trim() || fallback;
}

export function resolveSceneTextColors(colorScheme: SceneColorScheme, config: SceneTextColorConfig): SceneTextColors {
  if (config.textColorSource === 'custom') {
    const lightTextColor = nonEmptyColor(config.lightTextColor, '#111827');
    const customColor =
      colorScheme === 'dark' && config.darkTextColorSource === 'custom'
        ? nonEmptyColor(config.darkTextColor, '#f8fafc')
        : lightTextColor;
    return {
      root: customColor,
      title: customColor,
      body: customColor,
    };
  }

  if (colorScheme === 'dark') {
    return {
      root: 'var(--mantine-color-gray-0)',
      title: 'var(--mantine-color-gray-0)',
      body: 'var(--mantine-color-gray-3)',
    };
  }

  return {
    root: 'var(--mantine-color-dark-9)',
    title: 'var(--mantine-color-dark-9)',
    body: 'var(--mantine-color-dark-6)',
  };
}

export function resolveThemedUnitTexture(unit: ImmersiveSceneUnit, colorScheme: SceneColorScheme): ThemedUnitTexture {
  const lightTexture: ThemedUnitTexture = {
    source: unit.textureSource ?? (unit.textureUrl ? 'image' : 'color'),
    color: unit.color,
    fileId: unit.textureFileId,
    url: unit.textureUrl,
  };

  if (colorScheme === 'light') {
    return lightTexture;
  }

  if (!unit.darkTextureSource && !unit.darkTextureFileId && !unit.darkTextureUrl && !unit.darkColor) {
    return lightTexture;
  }

  return {
    source: unit.darkTextureSource ?? (unit.darkTextureUrl ? 'image' : 'color'),
    color: unit.darkColor || unit.color,
    fileId: unit.darkTextureFileId,
    url: unit.darkTextureUrl,
  };
}

export function resolvePlaybackProgress(rawProgress: number, transition: ImmersiveSceneConfig['transition']) {
  const progress = clamp(rawProgress, 0, 1);
  if (transition === 'linear') {
    return progress;
  }
  return progress * progress * (3 - 2 * progress);
}

interface AutoplayTimelineInput {
  elapsedSeconds: number;
  unitCount: number;
  unitHoldSeconds: number;
  unitHoldSecondsByIndex?: readonly (number | undefined)[];
  unitGapSeconds: number;
  loop: boolean;
  transition: ImmersiveSceneConfig['transition'];
}

interface AutoplayTimelineState {
  visualProgress: number;
  textSegmentProgress: number;
  shouldContinue: boolean;
}

interface AutoplayTimelineSegmentState {
  visualSegmentProgress: number;
  textSegmentProgress: number;
  shouldContinue: boolean;
}

export function resolveAutoplayTimelineState({
  elapsedSeconds,
  unitCount,
  unitHoldSeconds,
  unitHoldSecondsByIndex,
  unitGapSeconds,
  loop,
  transition,
}: AutoplayTimelineInput): AutoplayTimelineState {
  if (unitCount <= 1) {
    return {
      visualProgress: 0,
      textSegmentProgress: 0,
      shouldContinue: false,
    };
  }

  const elapsed = Math.max(0, Number.isFinite(elapsedSeconds) ? elapsedSeconds : 0);
  const holdSeconds = Number.isFinite(unitHoldSeconds)
    ? Math.max(0.2, unitHoldSeconds)
    : DEFAULT_IMMERSIVE_SCENE_UNIT_HOLD_SECONDS;
  const gapSeconds = Number.isFinite(unitGapSeconds)
    ? Math.max(0, unitGapSeconds)
    : DEFAULT_IMMERSIVE_SCENE_UNIT_GAP_SECONDS;
  const segmentDenominator = loop ? unitCount : unitCount - 1;
  const resolveHoldSeconds = (index: number) => {
    const unitHoldSecondsOverride = unitHoldSecondsByIndex?.[index];
    return typeof unitHoldSecondsOverride === 'number' && Number.isFinite(unitHoldSecondsOverride)
      ? Math.max(0.2, unitHoldSecondsOverride)
      : holdSeconds;
  };

  const createState = ({
    visualSegmentProgress,
    textSegmentProgress,
    shouldContinue,
  }: AutoplayTimelineSegmentState) => ({
    visualProgress: clamp(visualSegmentProgress / segmentDenominator, 0, 1),
    textSegmentProgress,
    shouldContinue,
  });

  if (loop) {
    const holdSecondsList = Array.from({ length: unitCount }, (_, index) => resolveHoldSeconds(index));
    const cycleDuration = holdSecondsList.reduce(
      (duration, unitHoldSecondsValue) => duration + unitHoldSecondsValue + gapSeconds,
      0,
    );
    const cycleElapsed = ((elapsed % cycleDuration) + cycleDuration) % cycleDuration;

    let remainingSeconds = cycleElapsed;
    for (let index = 0; index < unitCount; index += 1) {
      const unitHoldSecondsValue = holdSecondsList[index];
      if (remainingSeconds < unitHoldSecondsValue) {
        return createState({
          visualSegmentProgress: index,
          textSegmentProgress: index,
          shouldContinue: true,
        });
      }

      remainingSeconds -= unitHoldSecondsValue;
      if (gapSeconds > 0) {
        if (remainingSeconds < gapSeconds) {
          const gapProgress = remainingSeconds / gapSeconds;
          const visualGapProgress = resolvePlaybackProgress(gapProgress, transition);
          return createState({
            visualSegmentProgress: index + visualGapProgress,
            textSegmentProgress: index + gapProgress,
            shouldContinue: true,
          });
        }
        remainingSeconds -= gapSeconds;
      }
    }

    return createState({
      visualSegmentProgress: 0,
      textSegmentProgress: 0,
      shouldContinue: true,
    });
  }

  const lastIndex = unitCount - 1;
  let remainingSeconds = elapsed;

  for (let index = 0; index < lastIndex; index += 1) {
    const unitHoldSecondsValue = resolveHoldSeconds(index);
    if (remainingSeconds < unitHoldSecondsValue) {
      return createState({
        visualSegmentProgress: index,
        textSegmentProgress: index,
        shouldContinue: true,
      });
    }

    remainingSeconds -= unitHoldSecondsValue;
    if (gapSeconds > 0) {
      if (remainingSeconds < gapSeconds) {
        const gapProgress = remainingSeconds / gapSeconds;
        const visualGapProgress = resolvePlaybackProgress(gapProgress, transition);
        return createState({
          visualSegmentProgress: index + visualGapProgress,
          textSegmentProgress: index + gapProgress,
          shouldContinue: true,
        });
      }
      remainingSeconds -= gapSeconds;
    }
  }

  if (remainingSeconds < resolveHoldSeconds(lastIndex)) {
    return createState({
      visualSegmentProgress: lastIndex,
      textSegmentProgress: lastIndex,
      shouldContinue: true,
    });
  }

  return createState({
    visualSegmentProgress: lastIndex,
    textSegmentProgress: lastIndex,
    shouldContinue: false,
  });
}

export function resolveAutoplayClockState(
  state: AutoplayClockState,
  timestamp: number,
  isPageHidden: boolean,
): AutoplayClockState {
  if (isPageHidden || !Number.isFinite(timestamp)) {
    return {
      ...state,
      lastFrameTimestamp: null,
    };
  }

  if (state.lastFrameTimestamp === null || !Number.isFinite(state.lastFrameTimestamp)) {
    return {
      elapsedSeconds: state.elapsedSeconds,
      lastFrameTimestamp: timestamp,
    };
  }

  const frameDeltaSeconds = clamp((timestamp - state.lastFrameTimestamp) / 1000, 0, MAX_AUTOPLAY_FRAME_DELTA_SECONDS);

  return {
    elapsedSeconds: state.elapsedSeconds + frameDeltaSeconds,
    lastFrameTimestamp: timestamp,
  };
}

export function resolveRenderUnitSequence(units: ImmersiveSceneUnit[], loop: boolean) {
  if (!loop || units.length <= 1) {
    return units;
  }

  return [...units, units[0]];
}

export function resolveActiveUnit(units: ImmersiveSceneUnit[], progress: number, loop: boolean) {
  if (units.length <= 1) {
    return units[0];
  }

  if (loop) {
    const index = Math.round((progress % 1) * units.length) % units.length;
    return units[index];
  }

  const index = Math.round(progress * (units.length - 1));
  return units[clamp(index, 0, units.length - 1)];
}

function ease(progress: number) {
  const value = clamp(progress, 0, 1);
  return value * value * (3 - 2 * value);
}

function resolveTextPacing(transitionWindow: number) {
  const fadeDuration = clamp(transitionWindow, 0.08, 0.4);
  const gapDuration = clamp(fadeDuration * 0.5, 0.06, 0.16);
  const fadeInTailDuration = clamp(fadeDuration * 0.5, 0.06, 0.12);
  const fadeInEnd = 1 - fadeInTailDuration;
  const fadeInStart = Math.max(0, fadeInEnd - fadeDuration);
  const fadeOutEnd = Math.max(0, fadeInStart - gapDuration);
  const fadeOutStart = Math.max(0, fadeOutEnd - fadeDuration);

  return {
    fadeInDuration: Math.max(0.001, fadeInEnd - fadeInStart),
    fadeInEnd,
    fadeOutDuration: Math.max(0.001, fadeOutEnd - fadeOutStart),
    fadeInStart,
    fadeOutStart,
    fadeOutEnd,
  };
}

function resolveCurrentTextOpacity(localProgress: number, transitionWindow: number) {
  const { fadeOutDuration, fadeOutStart, fadeOutEnd } = resolveTextPacing(transitionWindow);
  if (localProgress < fadeOutStart) {
    return 1;
  }
  if (localProgress < fadeOutEnd) {
    return 1 - ease((localProgress - fadeOutStart) / fadeOutDuration);
  }
  return 0;
}

function resolveNextTextOpacity(localProgress: number, transitionWindow: number) {
  const { fadeInDuration, fadeInEnd, fadeInStart } = resolveTextPacing(transitionWindow);
  if (localProgress < fadeInStart) {
    return 0;
  }
  if (localProgress >= fadeInEnd) {
    return 1;
  }
  return ease((localProgress - fadeInStart) / fadeInDuration);
}

export function resolveUnitPresentation(
  segmentProgress: number,
  index: number,
  unitCount: number,
  transitionWindow: number,
  loop: boolean,
) {
  if (unitCount <= 1) {
    return { opacity: 1 };
  }

  if (loop) {
    const normalizedSegmentProgress = ((segmentProgress % unitCount) + unitCount) % unitCount;
    const currentIndex = Math.floor(normalizedSegmentProgress);
    const nextIndex = (currentIndex + 1) % unitCount;
    const localProgress = normalizedSegmentProgress - currentIndex;

    if (index === currentIndex) {
      return {
        opacity: resolveCurrentTextOpacity(localProgress, transitionWindow),
      };
    }

    if (index === nextIndex) {
      return {
        opacity: resolveNextTextOpacity(localProgress, transitionWindow),
      };
    }

    return {
      opacity: 0,
    };
  }

  const lastIndex = unitCount - 1;
  if (segmentProgress >= lastIndex) {
    return {
      opacity: index === lastIndex ? 1 : 0,
    };
  }

  const currentIndex = Math.floor(segmentProgress);
  const nextIndex = currentIndex + 1;
  const localProgress = segmentProgress - currentIndex;

  if (index === currentIndex) {
    return {
      opacity: resolveCurrentTextOpacity(localProgress, transitionWindow),
    };
  }

  if (index === nextIndex) {
    return {
      opacity: resolveNextTextOpacity(localProgress, transitionWindow),
    };
  }

  return {
    opacity: 0,
  };
}
