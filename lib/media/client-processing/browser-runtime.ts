import { AUDIO_TRANSCODER_CODEC_ASSET_MANIFEST } from '@echovisionlab/audio-transcoder';
import { ClientMediaUnavailableError } from './contracts';

export function getCodecAssetUrl(): string {
  return `https://cdn.jsdelivr.net/gh/echovisionlab/audio-transcoder@v${AUDIO_TRANSCODER_CODEC_ASSET_MANIFEST.version}/codec-assets/`;
}

let initialization: Promise<void> | undefined;

/** Register the pinned AAC extension only when the native runtime lacks AAC. */
export function ensureAudioCodecs(options: { codecAssetBaseUrl: string }): Promise<void> {
  const url = new URL(options.codecAssetBaseUrl, globalThis.location?.href);
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return Promise.reject(new Error('Client media codecs require an HTTP(S) asset source.'));
  }
  if (!initialization) {
    initialization = (async () => {
      const { canEncodeAudio } = await import('mediabunny');
      if (!(await canEncodeAudio('aac', { numberOfChannels: 2, sampleRate: 44_100, bitrate: 192_000 }))) {
        const { registerAacEncoder } = await import('@mediabunny/aac-encoder');
        registerAacEncoder();
      }
      if (!(await canEncodeAudio('aac', { numberOfChannels: 2, sampleRate: 44_100, bitrate: 192_000 }))) {
        throw new ClientMediaUnavailableError('AAC encoding is unavailable in this browser.', 'capability');
      }
    })().catch((error) => {
      initialization = undefined;
      throw error;
    });
  }
  return initialization;
}
