import { DEFAULT_P5_SKETCH_SOURCE, normalizeP5SketchError, validateP5SketchSource } from './p5-source';

it('rejects network, page, storage and sketch schedulers with a source location', () => {
  expect(validateP5SketchSource('const ok = 1;\nfetch("https://example.com")')).toMatchObject({
    kind: 'policy',
    line: 2,
    column: 1,
  });
  expect(validateP5SketchSource('document.body.textContent = "unsafe"')).toMatchObject({ kind: 'policy' });
  expect(validateP5SketchSource('setTimeout(() => {}, 1)')).toMatchObject({ kind: 'policy' });
  expect(validateP5SketchSource('function setup() { createCapture(AUDIO); }')).toMatchObject({
    kind: 'policy',
    message: expect.stringContaining('must be declared'),
  });
  expect(validateP5SketchSource('function setup() { createCapture(AUDIO); }', ['microphone'])).toBeNull();
  expect(validateP5SketchSource('function setup() { requestCurrentPosition(); }')).toMatchObject({
    kind: 'policy',
    message: expect.stringContaining('must be declared'),
  });
  expect(validateP5SketchSource('function setup() { requestCurrentPosition(); }', ['location'])).toBeNull();
  expect(
    validateP5SketchSource('function mousePressed() { requestBluetoothDevice({ acceptAllDevices: true }); }'),
  ).toMatchObject({
    kind: 'policy',
    message: expect.stringContaining('must be declared'),
  });
  expect(
    validateP5SketchSource('function mousePressed() { requestBluetoothDevice({ acceptAllDevices: true }); }', [
      'bluetooth',
    ]),
  ).toBeNull();
  expect(validateP5SketchSource(DEFAULT_P5_SKETCH_SOURCE)).toBeNull();
});

it('sanitizes resource URLs while keeping an author source location', () => {
  const error = new Error('failed at https://private.example/sketch');
  error.stack = 'Error\n at p5-sketch.js:7:9';
  expect(normalizeP5SketchError(error, 'runtime', 2)).toEqual({
    kind: 'runtime',
    message: 'failed at [resource]',
    line: 5,
    column: 9,
  });
});
