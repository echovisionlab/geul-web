import { readAudioMediaHydration, readVideoMediaHydration } from '@/lib/media/hydration';
import { looksLikeHlsUrl, normalizeHydrationUrl } from '@/lib/media/shared';

export interface AudioHydrationInput {
  block: HTMLElement | null;
  audio: HTMLAudioElement;
}

export interface VideoHydrationInput {
  block: HTMLElement | null;
  video: HTMLVideoElement;
}

export function resolveHydratedAudioSources(input: AudioHydrationInput) {
  const audioContract = readAudioMediaHydration(input.block || document.createElement('div'), input.audio);
  const currentSrc = normalizeHydrationUrl(input.audio.getAttribute('src'));
  const hlsSrc = audioContract.hlsUrl || (looksLikeHlsUrl(currentSrc) ? currentSrc : '');
  const playbackUrl = audioContract.playbackUrl || hlsSrc;
  return {
    playbackUrl,
    hlsSrc,
    originalUrl: audioContract.originalUrl,
  };
}

export function resolveHydratedAudioSrc(input: AudioHydrationInput): string {
  return resolveHydratedAudioSources(input).playbackUrl;
}

export function resolveHydratedVideoSources(input: VideoHydrationInput) {
  const videoContract = readVideoMediaHydration(input.block || document.createElement('div'), input.video);
  const currentSrc = normalizeHydrationUrl(input.video.getAttribute('src'));
  const hlsSrc = videoContract.hlsUrl || (looksLikeHlsUrl(currentSrc) ? currentSrc : '');
  const originalUrl = videoContract.originalUrl || (looksLikeHlsUrl(currentSrc) ? '' : currentSrc);
  const posterUrl = videoContract.posterUrl;

  return { hlsSrc, originalUrl, posterUrl };
}
