import { describe, expect, it } from 'vitest';
import { normalizeVideoTransportStream } from './video-hls';

function packet(hex: string): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(188).fill(0xff);
  bytes.set(Buffer.from(hex, 'hex'));
  return bytes;
}

const PAT = '474000100000b00d0001c100000001f0002ab104b2';
const AAC_PMT = '475000100002b0120001c10000fffff0000fe100f000627dcc6f';
const AAC_PES = '4741003001c0000001c001748480052100637d65fff150802d9ffc214cf487f';
const STABLE_AAC_PES = '4741013001c0000001c001748480052100637d65fff150802d9ffc214cf487f';

function segment(pmt = AAC_PMT, pes = AAC_PES): ArrayBuffer {
  const bytes = new Uint8Array(188 * 3);
  bytes.set(packet(PAT), 0);
  bytes.set(packet(pmt), 188);
  bytes.set(packet(pes), 376);
  return bytes.buffer;
}

describe('stable video MPEG-TS PIDs', () => {
  it('leaves normal AVC/AAC PID allocation and all media bytes unchanged', () => {
    const bytes = segment('475000100002b0170001c10000fffff0001be100f0000fe101f00084c0a2bc', STABLE_AAC_PES);
    expect(normalizeVideoTransportStream(bytes.slice(0))).toEqual(new Uint8Array(bytes));
  });

  it('remaps the AAC PCR PID and elementary PID with the expected PSI checksum', () => {
    const input = segment('475000100002b0120001c10000e100f0000fe100f000b69bc0d9');
    // Expected PMT CRC ece2b094 is fixed independently of the normalizer.
    const expected = segment('475000100002b0120001c10000e101f0000fe101f000ece2b094', STABLE_AAC_PES);
    expect(normalizeVideoTransportStream(input)).toEqual(new Uint8Array(expected));
  });

  it('preserves AAC tail payload, timestamps, adaptation and continuity bytes', () => {
    // Only elementary/PES PID 256 -> 257 and PMT CRC 63a560e8 change.
    const expected = segment('475000100002b0120001c10000fffff0000fe101f00063a560e8', STABLE_AAC_PES);
    expect(normalizeVideoTransportStream(segment())).toEqual(new Uint8Array(expected));
  });

  it('rejects a corrupt PSI checksum instead of patching an invalid stream', () => {
    const bytes = new Uint8Array(segment());
    bytes[188 + 25] ^= 1;
    expect(() => normalizeVideoTransportStream(bytes.buffer)).toThrow('CRC');
  });

  it('rejects invalid packet and adaptation bounds', () => {
    expect(() => normalizeVideoTransportStream(new ArrayBuffer(187))).toThrow('packet length');
    const bytes = new Uint8Array(segment());
    bytes[376 + 4] = 184;
    expect(() => normalizeVideoTransportStream(bytes.buffer)).toThrow('adaptation field length');
  });
});
