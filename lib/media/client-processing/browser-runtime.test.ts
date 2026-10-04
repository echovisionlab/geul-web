import { beforeEach, describe, expect, it, vi } from 'vitest';

const { canEncodeAudio, registerAacEncoder } = vi.hoisted(() => ({
  canEncodeAudio: vi.fn(),
  registerAacEncoder: vi.fn(),
}));
vi.mock('mediabunny', () => ({ canEncodeAudio }));
vi.mock('@mediabunny/aac-encoder', () => ({ registerAacEncoder }));

beforeEach(() => {
  vi.resetModules();
  canEncodeAudio.mockReset();
  registerAacEncoder.mockReset();
});
const options = { codecAssetBaseUrl: 'https://assets.example/audio/' };

describe('client media codec runtime', () => {
  it('keeps native AAC without registering a custom encoder', async () => {
    canEncodeAudio.mockResolvedValue(true);
    const { ensureAudioCodecs } = await import('./browser-runtime');
    await ensureAudioCodecs(options);
    expect(registerAacEncoder).not.toHaveBeenCalled();
  });

  it('registers the pinned AAC extension once when native encoding is unsupported', async () => {
    canEncodeAudio.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const { ensureAudioCodecs } = await import('./browser-runtime');
    await Promise.all([ensureAudioCodecs(options), ensureAudioCodecs(options)]);
    expect(registerAacEncoder).toHaveBeenCalledOnce();
    expect(canEncodeAudio).toHaveBeenCalledTimes(2);
  });

  it('returns typed capability failure and allows a later fresh capability probe', async () => {
    canEncodeAudio.mockResolvedValue(false);
    const { ensureAudioCodecs } = await import('./browser-runtime');
    await expect(ensureAudioCodecs(options)).rejects.toMatchObject({
      name: 'ClientMediaUnavailableError',
      reason: 'capability',
    });
    canEncodeAudio.mockResolvedValue(true);
    await expect(ensureAudioCodecs(options)).resolves.toBeUndefined();
  });
});
