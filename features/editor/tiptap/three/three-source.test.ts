import {
  DEFAULT_THREE_SCENE_SOURCE,
  normalizeThreeSceneError,
  stripThreeSceneRuntimeImport,
  validateThreeSceneSource,
} from './three-source';

it('rejects network and dynamic import while preserving source location', () => {
  expect(validateThreeSceneSource('const ok = 1;\nfetch("https://example.com")')).toMatchObject({
    kind: 'policy',
    line: 2,
    column: 1,
  });
  expect(validateThreeSceneSource('import("https://example.com/mod.js")')).toMatchObject({ kind: 'policy' });
  expect(validateThreeSceneSource('export const sceneValue = 1')).toMatchObject({ kind: 'policy' });
  expect(validateThreeSceneSource(DEFAULT_THREE_SCENE_SOURCE)).toBeNull();
  expect(DEFAULT_THREE_SCENE_SOURCE.startsWith("import * as THREE from 'three';\n")).toBe(true);
  expect(stripThreeSceneRuntimeImport(DEFAULT_THREE_SCENE_SOURCE)).not.toContain("from 'three'");
  expect(validateThreeSceneSource("import * as Other from 'other';\nconst ok = 1;")).toMatchObject({
    kind: 'policy',
  });
});

it('sanitizes runtime resource URLs and keeps line and column', () => {
  const error = new Error('failed at https://private.example/scene');
  error.stack = 'Error\n at three-scene.js:7:9';
  expect(normalizeThreeSceneError(error, 'runtime', 2)).toEqual({
    kind: 'runtime',
    message: 'failed at [resource]',
    line: 5,
    column: 9,
  });
});
