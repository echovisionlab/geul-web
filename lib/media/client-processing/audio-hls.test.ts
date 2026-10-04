import { describe, expect, it } from 'vitest';
import { AdtsParser, createAudioHlsOutput } from './audio-hls';
import type { MediaArtifact } from './contracts';

function frame(payload = new Uint8Array([1, 2, 3])) {
  const length = payload.length + 7;
  const result = new Uint8Array(length);
  result.set([0xff, 0xf1, 0x50, 0x80 | (length >> 11), (length >> 3) & 255, ((length & 7) << 5) | 31, 0xfc]);
  result.set(payload, 7);
  return result;
}

describe('continuous AAC HLS', () => {
  it('parses split ADTS headers and payloads with one decoder config and cumulative timestamps', async () => {
    const packets: Array<{ timestamp: number; data: number[]; config: boolean }> = [];
    const parser = new AdtsParser(async (packet, metadata) => {
      packets.push({ timestamp: packet.timestamp, data: [...packet.data], config: !!metadata });
    });
    const data = new Uint8Array([...frame(), ...frame()]);
    for (const byte of data) {
      await parser.write(new Uint8Array([byte]));
    }
    parser.finish();
    expect(packets).toEqual([
      { timestamp: 0, data: [1, 2, 3], config: true },
      { timestamp: 1024 / 44100, data: [1, 2, 3], config: false },
    ]);
  });

  it('rejects truncation, corrupt framing and changing encoder parameters', async () => {
    const parser = new AdtsParser(async () => {});
    await parser.write(frame().subarray(0, 8));
    expect(() => parser.finish()).toThrow('truncated');
    await expect(new AdtsParser(async () => {}).write(new Uint8Array(7))).rejects.toThrow('sync');
    const invalid = frame();
    invalid[2] = 0x4c;
    await expect(new AdtsParser(async () => {}).write(invalid)).rejects.toThrow('incompatible');
  });

  it('muxes a continuous stream into flat MPEG-TS segments and awaits persistence', async () => {
    const artifacts: MediaArtifact[] = [];
    const output = await createAudioHlsOutput({
      signal: new AbortController().signal,
      codecAssetBaseUrl: 'https://example.com',
      onProgress() {},
      async onArtifact(artifact) {
        artifacts.push(artifact);
      },
    });
    const writer = output.writable.getWriter();
    let position = 0;
    for (let i = 0; i < 600; i++) {
      const data = frame();
      await writer.write({ type: 'write', position, data });
      position += data.length;
    }
    await writer.close();
    expect(artifacts.filter((v) => v.path.endsWith('.ts')).length).toBeGreaterThan(1);
    expect(artifacts.map((v) => v.path)).toContain('master.m3u8');
    const playlist = await artifacts.find((v) => v.path === 'audio.m3u8')!.blob.text();
    expect(playlist).toContain('#EXT-X-ENDLIST');
    const segment = new Uint8Array(await artifacts.find((v) => v.path.endsWith('.ts'))!.blob.arrayBuffer());
    expect(segment.length % 188).toBe(0);
    expect(segment[0]).toBe(0x47);
  });

  it('propagates persistence failure instead of completing a partial bundle', async () => {
    const output = await createAudioHlsOutput({
      signal: new AbortController().signal,
      codecAssetBaseUrl: 'https://example.com',
      onProgress() {},
      async onArtifact() {
        throw new Error('disk failed');
      },
    });
    const writer = output.writable.getWriter();
    await writer.write({ type: 'write', position: 0, data: frame() });
    await expect(writer.close()).rejects.toThrow('disk failed');
    await output.cancel();
  });

  it('shares force-close completion across repeated cancellation calls', async () => {
    const onArtifact = async () => {
      throw new Error('Cancellation must not finalize a playlist.');
    };
    const output = await createAudioHlsOutput({
      signal: new AbortController().signal,
      codecAssetBaseUrl: 'unused',
      onProgress() {},
      onArtifact,
    });
    const first = output.cancel();
    expect(output.cancel()).toBe(first);
    await first;
  });
});
