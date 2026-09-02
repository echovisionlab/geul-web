import type { ImmersiveSceneConfig, ImmersiveSceneUnit } from './schema';

export interface RotationVector {
  x: number;
  y: number;
  z: number;
}

export const ZERO_ROTATION_VECTOR: RotationVector = Object.freeze({ x: 0, y: 0, z: 0 });
export const DEFAULT_ROTATION_SPEED: RotationVector = Object.freeze({ x: 0, y: 0.18, z: 0 });
export const DEFAULT_SCROLL_ROTATION_TURNS: RotationVector = Object.freeze({ x: 0, y: 0.35, z: 0 });

type RotationFieldPrefix = 'rotation' | 'rotationSpeed' | 'scrollRotationTurns';
type RotationFieldName =
  | 'rotationX'
  | 'rotationY'
  | 'rotationZ'
  | 'rotationSpeedX'
  | 'rotationSpeedY'
  | 'rotationSpeedZ'
  | 'scrollRotationTurnsX'
  | 'scrollRotationTurnsY'
  | 'scrollRotationTurnsZ';

const AXES = ['x', 'y', 'z'] as const;
const FIELD_SUFFIX = { x: 'X', y: 'Y', z: 'Z' } as const;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function parseAxisValue(value: string | undefined, fallback: number, min: number, max: number) {
  if (value == null || value.trim() === '') {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? clamp(parsed, min, max) : fallback;
}

function fieldName(prefix: RotationFieldPrefix, axis: (typeof AXES)[number]) {
  return `${prefix}${FIELD_SUFFIX[axis]}` as RotationFieldName;
}

function resolveSceneVector(
  config: ImmersiveSceneConfig,
  prefix: RotationFieldPrefix,
  fallback: RotationVector,
  min: number,
  max: number,
): RotationVector {
  return Object.fromEntries(
    AXES.map((axis) => [axis, parseAxisValue(config[fieldName(prefix, axis)], fallback[axis], min, max)]),
  ) as unknown as RotationVector;
}

function resolveUnitVector(
  unit: ImmersiveSceneUnit,
  prefix: RotationFieldPrefix,
  fallback: RotationVector,
  min: number,
  max: number,
): RotationVector {
  return Object.fromEntries(
    AXES.map((axis) => [axis, parseAxisValue(unit[fieldName(prefix, axis)], fallback[axis], min, max)]),
  ) as unknown as RotationVector;
}

function interpolateVector(from: RotationVector, to: RotationVector, progress: number): RotationVector {
  return {
    x: from.x + (to.x - from.x) * progress,
    y: from.y + (to.y - from.y) * progress,
    z: from.z + (to.z - from.z) * progress,
  };
}

function interpolateAngle(from: number, to: number, progress: number) {
  const fullTurn = Math.PI * 2;
  const delta = ((((to - from + Math.PI) % fullTurn) + fullTurn) % fullTurn) - Math.PI;
  return from + delta * progress;
}

function interpolateAngleVector(from: RotationVector, to: RotationVector, progress: number): RotationVector {
  return {
    x: interpolateAngle(from.x, to.x, progress),
    y: interpolateAngle(from.y, to.y, progress),
    z: interpolateAngle(from.z, to.z, progress),
  };
}

function resolveSequence(units: ImmersiveSceneUnit[], loop: boolean) {
  if (loop && units.length > 1) {
    return [...units, units[0]];
  }
  return units;
}

function resolveVectorAtProgress(
  units: ImmersiveSceneUnit[],
  progress: number,
  loop: boolean,
  resolveUnit: (unit: ImmersiveSceneUnit) => RotationVector,
  fallback: RotationVector,
  interpolate: (from: RotationVector, to: RotationVector, progress: number) => RotationVector = interpolateVector,
) {
  const sequence = resolveSequence(units, loop);
  if (sequence.length === 0) {
    return fallback;
  }
  if (sequence.length === 1) {
    return resolveUnit(sequence[0]);
  }

  const scaledProgress = clamp(progress, 0, 1) * (sequence.length - 1);
  const fromIndex = Math.min(Math.floor(scaledProgress), sequence.length - 1);
  const toIndex = Math.min(fromIndex + 1, sequence.length - 1);
  return interpolate(resolveUnit(sequence[fromIndex]), resolveUnit(sequence[toIndex]), scaledProgress - fromIndex);
}

export function resolveSceneInitialRotation(config: ImmersiveSceneConfig): RotationVector {
  const degrees = resolveSceneVector(config, 'rotation', ZERO_ROTATION_VECTOR, -360, 360);
  const radiansPerDegree = Math.PI / 180;
  return {
    x: degrees.x * radiansPerDegree,
    y: degrees.y * radiansPerDegree,
    z: degrees.z * radiansPerDegree,
  };
}

export function resolveSceneRotationSpeed(config: ImmersiveSceneConfig): RotationVector {
  return resolveSceneVector(config, 'rotationSpeed', DEFAULT_ROTATION_SPEED, -2, 2);
}

export function resolveSceneScrollRotationTurns(config: ImmersiveSceneConfig): RotationVector {
  return resolveSceneVector(config, 'scrollRotationTurns', DEFAULT_SCROLL_ROTATION_TURNS, -2, 2);
}

export function resolveInitialRotationAtProgress(
  units: ImmersiveSceneUnit[],
  progress: number,
  loop: boolean,
  sceneRotation: RotationVector,
) {
  return resolveVectorAtProgress(
    units,
    progress,
    loop,
    (unit) => {
      const degrees = resolveUnitVector(
        unit,
        'rotation',
        {
          x: sceneRotation.x * (180 / Math.PI),
          y: sceneRotation.y * (180 / Math.PI),
          z: sceneRotation.z * (180 / Math.PI),
        },
        -360,
        360,
      );
      return {
        x: degrees.x * (Math.PI / 180),
        y: degrees.y * (Math.PI / 180),
        z: degrees.z * (Math.PI / 180),
      };
    },
    sceneRotation,
    interpolateAngleVector,
  );
}

export function resolveRotationSpeedAtProgress(
  units: ImmersiveSceneUnit[],
  progress: number,
  loop: boolean,
  sceneSpeed: RotationVector,
) {
  return resolveVectorAtProgress(
    units,
    progress,
    loop,
    (unit) => resolveUnitVector(unit, 'rotationSpeed', sceneSpeed, -2, 2),
    sceneSpeed,
  );
}

export function resolveScrollRotationAtProgress(
  units: ImmersiveSceneUnit[],
  progress: number,
  loop: boolean,
  sceneTurns: RotationVector,
): RotationVector {
  const sequence = resolveSequence(units, loop);
  const clampedProgress = clamp(progress, 0, 1);
  if (sequence.length === 0) {
    return {
      x: clampedProgress * sceneTurns.x * Math.PI * 2,
      y: clampedProgress * sceneTurns.y * Math.PI * 2,
      z: clampedProgress * sceneTurns.z * Math.PI * 2,
    };
  }
  if (sequence.length === 1) {
    const unitTurns = resolveUnitVector(sequence[0], 'scrollRotationTurns', sceneTurns, -2, 2);
    return {
      x: clampedProgress * unitTurns.x * Math.PI * 2,
      y: clampedProgress * unitTurns.y * Math.PI * 2,
      z: clampedProgress * unitTurns.z * Math.PI * 2,
    };
  }

  const segmentCount = sequence.length - 1;
  const scaledProgress = clampedProgress * segmentCount;
  const completeSegments = Math.min(Math.floor(scaledProgress), segmentCount);
  const partialProgress = Math.min(1, scaledProgress - completeSegments);
  const integrated = { ...ZERO_ROTATION_VECTOR };

  for (let index = 0; index < completeSegments; index += 1) {
    const from = resolveUnitVector(sequence[index], 'scrollRotationTurns', sceneTurns, -2, 2);
    const to = resolveUnitVector(sequence[index + 1], 'scrollRotationTurns', sceneTurns, -2, 2);
    for (const axis of AXES) {
      integrated[axis] += (from[axis] + to[axis]) / 2 / segmentCount;
    }
  }

  if (completeSegments < segmentCount && partialProgress > 0) {
    const from = resolveUnitVector(sequence[completeSegments], 'scrollRotationTurns', sceneTurns, -2, 2);
    const to = resolveUnitVector(sequence[completeSegments + 1], 'scrollRotationTurns', sceneTurns, -2, 2);
    for (const axis of AXES) {
      const partialIntegral =
        from[axis] * partialProgress + ((to[axis] - from[axis]) * partialProgress * partialProgress) / 2;
      integrated[axis] += partialIntegral / segmentCount;
    }
  }

  return {
    x: integrated.x * Math.PI * 2,
    y: integrated.y * Math.PI * 2,
    z: integrated.z * Math.PI * 2,
  };
}

export function addRotationVectors(...vectors: RotationVector[]): RotationVector {
  return vectors.reduce(
    (result, vector) => ({
      x: result.x + vector.x,
      y: result.y + vector.y,
      z: result.z + vector.z,
    }),
    { ...ZERO_ROTATION_VECTOR },
  );
}

export function advanceRotation(current: RotationVector, speed: RotationVector, deltaSeconds: number): RotationVector {
  const delta = Number.isFinite(deltaSeconds) ? clamp(deltaSeconds, 0, 0.25) : 0;
  return {
    x: current.x + speed.x * delta,
    y: current.y + speed.y * delta,
    z: current.z + speed.z * delta,
  };
}
