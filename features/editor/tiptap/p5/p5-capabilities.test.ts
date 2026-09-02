import {
  normalizeP5Capabilities,
  P5_CAPABILITIES,
  P5_CAPABILITY_API,
  serializeP5Capabilities,
} from './p5-capabilities';

describe('p5 capability contract', () => {
  it('keeps the exact supported set in stable wire order', () => {
    expect(P5_CAPABILITIES).toEqual([
      'camera',
      'microphone',
      'motion',
      'midi',
      'gamepad',
      'serial',
      'location',
      'bluetooth',
    ]);
    expect(P5_CAPABILITY_API.location).toBe('requestCurrentPosition()');
    expect(P5_CAPABILITY_API.bluetooth).toBe('requestBluetoothDevice(options)');
    expect(normalizeP5Capabilities('bluetooth unknown camera location')).toEqual(['camera', 'location', 'bluetooth']);
    expect(serializeP5Capabilities(['bluetooth', 'location', 'bluetooth'])).toBe('location bluetooth');
  });
});
