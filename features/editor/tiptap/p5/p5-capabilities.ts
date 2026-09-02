export const P5_CAPABILITIES = [
  'camera',
  'microphone',
  'motion',
  'midi',
  'gamepad',
  'serial',
  'location',
  'bluetooth',
] as const;

export type P5Capability = (typeof P5_CAPABILITIES)[number];

export const P5_CAPABILITY_API: Record<P5Capability, string> = {
  camera: 'createCapture(VIDEO)',
  microphone: 'createCapture(AUDIO)',
  motion: 'requestMotionPermission()',
  midi: 'requestMIDIAccess()',
  gamepad: 'getGamepads()',
  serial: 'requestSerialPort()',
  location: 'requestCurrentPosition()',
  bluetooth: 'requestBluetoothDevice(options)',
};

function capabilityValues(value: unknown): readonly unknown[] {
  if (Array.isArray(value)) {
    return value;
  }
  if (typeof value === 'string') {
    return value.split(/[\s,]+/u).filter(Boolean);
  }
  return [];
}

/** Returns the known capability set in a stable UI and wire order. */
export function normalizeP5Capabilities(value: unknown): P5Capability[] {
  const values = capabilityValues(value);
  return P5_CAPABILITIES.filter((capability) => values.includes(capability));
}

export function serializeP5Capabilities(value: unknown): string {
  return normalizeP5Capabilities(value).join(' ');
}

export type P5CapabilitySupport = 'supported' | 'unsupported' | 'unknown';

/** Browser support only; this never asks for permission or connects a device. */
export function getP5CapabilitySupport(capability: P5Capability): P5CapabilitySupport {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return 'unknown';
  }
  const browserNavigator = navigator as Navigator & {
    bluetooth?: unknown;
    requestMIDIAccess?: unknown;
    serial?: unknown;
  };
  switch (capability) {
    case 'camera':
    case 'microphone':
      return typeof navigator.mediaDevices?.getUserMedia === 'function' ? 'supported' : 'unsupported';
    case 'motion':
      return 'DeviceMotionEvent' in window ? 'supported' : 'unsupported';
    case 'midi':
      return typeof browserNavigator.requestMIDIAccess === 'function' ? 'supported' : 'unsupported';
    case 'gamepad':
      return typeof navigator.getGamepads === 'function' ? 'supported' : 'unsupported';
    case 'serial':
      return browserNavigator.serial ? 'supported' : 'unsupported';
    case 'location':
      return navigator.geolocation ? 'supported' : 'unsupported';
    case 'bluetooth':
      return browserNavigator.bluetooth ? 'supported' : 'unsupported';
  }
}
