import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ROTATION_SPEED,
  DEFAULT_SCROLL_ROTATION_TURNS,
  ZERO_ROTATION_VECTOR,
  addRotationVectors,
  advanceRotation,
  resolveInitialRotationAtProgress,
  resolveRotationSpeedAtProgress,
  resolveSceneInitialRotation,
  resolveSceneRotationSpeed,
  resolveSceneScrollRotationTurns,
  resolveScrollRotationAtProgress,
} from './rotation';
import { parseImmersiveSceneConfig } from './schema';

const radians = (degrees: number) => degrees * (Math.PI / 180);

describe('immersive scene rotation', () => {
  it('keeps the previous Y-axis defaults while exposing every axis', () => {
    const config = parseImmersiveSceneConfig({});

    expect(resolveSceneInitialRotation(config)).toEqual(ZERO_ROTATION_VECTOR);
    expect(resolveSceneRotationSpeed(config)).toEqual(DEFAULT_ROTATION_SPEED);
    expect(resolveSceneScrollRotationTurns(config)).toEqual(DEFAULT_SCROLL_ROTATION_TURNS);
  });

  it('inherits scene axes per field and keeps explicit zero item overrides', () => {
    const config = parseImmersiveSceneConfig({
      rotationX: '10',
      rotationY: '20',
      rotationZ: '30',
      rotationSpeedX: '0.4',
      rotationSpeedY: '0.5',
      rotationSpeedZ: '0.6',
      unitsJson: JSON.stringify([
        {
          id: 'one',
          mesh: 'sphere',
          color: '#fff',
          rotationY: '0',
          rotationSpeedX: '0',
          rotationSpeedZ: '-0.6',
        },
      ]),
    });

    expect(resolveInitialRotationAtProgress(config.units, 0, false, resolveSceneInitialRotation(config))).toEqual({
      x: radians(10),
      y: 0,
      z: radians(30),
    });
    expect(resolveRotationSpeedAtProgress(config.units, 0, false, resolveSceneRotationSpeed(config))).toEqual({
      x: 0,
      y: 0.5,
      z: -0.6,
    });
  });

  it('uses the shortest path when interpolating authored initial poses', () => {
    const config = parseImmersiveSceneConfig({
      unitsJson: JSON.stringify([
        { id: 'one', mesh: 'sphere', color: '#fff', rotationY: '350' },
        { id: 'two', mesh: 'box', color: '#fff', rotationY: '10' },
      ]),
    });

    const rotation = resolveInitialRotationAtProgress(config.units, 0.5, false, resolveSceneInitialRotation(config));
    expect(Math.sin(rotation.y)).toBeCloseTo(0);
    expect(Math.cos(rotation.y)).toBeCloseTo(1);
  });

  it('integrates item scroll rates continuously across scene segments', () => {
    const config = parseImmersiveSceneConfig({
      scrollRotationTurnsY: '0',
      unitsJson: JSON.stringify([
        { id: 'one', mesh: 'sphere', color: '#fff', scrollRotationTurnsY: '0' },
        { id: 'two', mesh: 'box', color: '#fff', scrollRotationTurnsY: '1' },
        { id: 'three', mesh: 'cone', color: '#fff', scrollRotationTurnsY: '0' },
      ]),
    });
    const sceneTurns = resolveSceneScrollRotationTurns(config);

    expect(resolveScrollRotationAtProgress(config.units, 0.5, false, sceneTurns).y).toBeCloseTo(Math.PI / 2);
    expect(resolveScrollRotationAtProgress(config.units, 1, false, sceneTurns).y).toBeCloseTo(Math.PI);
  });

  it('accumulates time rotation without an elapsed-time speed jump', () => {
    const beforeOverride = advanceRotation(ZERO_ROTATION_VECTOR, { x: 0, y: 1, z: 0 }, 0.1);
    const afterOverride = advanceRotation(beforeOverride, { x: 0, y: -1, z: 0 }, 0.1);

    expect(beforeOverride.y).toBeCloseTo(0.1);
    expect(afterOverride.y).toBeCloseTo(0);
    expect(addRotationVectors(afterOverride, { x: 1, y: 2, z: 3 })).toEqual({ x: 1, y: 2, z: 3 });
  });
});
