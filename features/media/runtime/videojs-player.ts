'use client';

import videojs from 'video.js';
import {
  resolveVideoPlaybackSource,
  normalizeMediaUrl,
  type VideoJsSourceInput,
  type VideoJsMessages,
  type VideoJsRuntimeError,
} from './videojs-source';
export { resolveVideoPlaybackSource } from './videojs-source';
export type { VideoJsSourceInput, VideoJsMessages, VideoJsRuntimeError } from './videojs-source';

function normalizeLanguageCode(locale: string | undefined): string {
  return (locale || '').trim().toLowerCase();
}

function isMountableVideoElement(videoElement: HTMLVideoElement): boolean {
  const ownerDocument = videoElement.ownerDocument;
  return Boolean(videoElement.isConnected && ownerDocument?.contains(videoElement));
}

function isAbortError(error: unknown): boolean {
  if (error instanceof DOMException && error.name === 'AbortError') {
    return true;
  }
  if (error instanceof Error && error.name === 'AbortError') {
    return true;
  }
  if (typeof error === 'string') {
    return /aborterror|aborted by the user agent/i.test(error);
  }
  if (error instanceof Error) {
    return /aborted by the user agent/i.test(error.message);
  }
  return false;
}

export function disposeVideoJsPlayer(player: ReturnType<typeof videojs> | undefined) {
  if (!player) {
    return;
  }
  try {
    suppressVideoJsErrorsDuringDispose(player);
    player.dispose();
  } catch (error) {
    if (!isAbortError(error)) {
      throw error;
    }
  }
}

function applyVideoJsMessages(player: ReturnType<typeof videojs>, messages: VideoJsMessages | undefined) {
  if (!messages) {
    return;
  }

  const playerElement = player.el() as HTMLElement | null;
  if (!playerElement) {
    return;
  }

  playerElement.setAttribute('aria-label', messages.regionLabel);

  const syncPlayLabels = () => {
    const playLabel = player.paused() ? messages.play : messages.pause;
    const controls = playerElement.querySelectorAll<HTMLElement>('.vjs-big-play-button, .vjs-play-control');
    controls.forEach((control) => {
      control.setAttribute('aria-label', playLabel);
      control.setAttribute('title', playLabel);
      const controlText = control.querySelector<HTMLElement>('.vjs-control-text');
      if (controlText) {
        controlText.textContent = playLabel;
      }
    });
  };

  player.ready(syncPlayLabels);
  player.on('play', syncPlayLabels);
  player.on('pause', syncPlayLabels);
}

const BEFORE_ERROR_HANDLER_KEY = '__videoBeforeErrorHandler';
const BEFORE_ERROR_SUPPRESSED_AT_KEY = '__videoBeforeErrorSuppressedAt';
const BEFORE_ERROR_DISPOSE_SUPPRESSED_AT_KEY = '__videoBeforeErrorDisposeSuppressedAt';
const RECENT_SUPPRESSED_ERROR_WINDOW_MS = 1500;

type BeforeErrorCapable = {
  [BEFORE_ERROR_HANDLER_KEY]?: ((error?: VideoJsRuntimeError) => boolean | void) | undefined;
  [BEFORE_ERROR_SUPPRESSED_AT_KEY]?: number | undefined;
  [BEFORE_ERROR_DISPOSE_SUPPRESSED_AT_KEY]?: number | undefined;
};

let beforeErrorHookRegistered = false;

function getRecentDisposeSuppression(...targets: Array<BeforeErrorCapable | null | undefined>) {
  const suppressedAt = Math.max(
    0,
    ...targets.map((target) =>
      typeof target?.[BEFORE_ERROR_DISPOSE_SUPPRESSED_AT_KEY] === 'number'
        ? (target[BEFORE_ERROR_DISPOSE_SUPPRESSED_AT_KEY] as number)
        : 0,
    ),
  );
  return Date.now() - suppressedAt < RECENT_SUPPRESSED_ERROR_WINDOW_MS;
}

function suppressVideoJsErrorsDuringDispose(player: ReturnType<typeof videojs>) {
  const suppressedAt = Date.now();
  (player as BeforeErrorCapable)[BEFORE_ERROR_DISPOSE_SUPPRESSED_AT_KEY] = suppressedAt;
}

function registerBeforeErrorHookOnce() {
  if (beforeErrorHookRegistered) {
    return;
  }
  beforeErrorHookRegistered = true;
  videojs.hook('beforeerror', (player: ({ el?: () => Element | null } & BeforeErrorCapable) | null, err: unknown) => {
    const tagElement =
      player && 'tag' in player ? ((player as { tag?: Element | null }).tag as BeforeErrorCapable | null) : null;
    const playerElement = typeof player?.el === 'function' ? ((player.el() as HTMLElement | null) ?? null) : null;
    const mountedVideo =
      (playerElement?.querySelector('video') as (HTMLVideoElement & BeforeErrorCapable) | null) ?? null;

    const errCode =
      typeof err === 'object' && err !== null && 'code' in err ? (err as { code?: unknown }).code : undefined;
    const errMessage =
      typeof err === 'object' && err !== null && 'message' in err ? (err as { message?: unknown }).message : undefined;
    if (getRecentDisposeSuppression(player, tagElement, mountedVideo)) {
      return null;
    }

    const runtimeError = { code: errCode, message: errMessage };
    const handled = Boolean(
      player?.[BEFORE_ERROR_HANDLER_KEY]?.(runtimeError) ||
      tagElement?.[BEFORE_ERROR_HANDLER_KEY]?.(runtimeError) ||
      mountedVideo?.[BEFORE_ERROR_HANDLER_KEY]?.(runtimeError),
    );

    if (handled) {
      const suppressedAt = Date.now();
      if (player) {
        player[BEFORE_ERROR_SUPPRESSED_AT_KEY] = suppressedAt;
      }
      if (tagElement) {
        tagElement[BEFORE_ERROR_SUPPRESSED_AT_KEY] = suppressedAt;
      }
      if (mountedVideo) {
        mountedVideo[BEFORE_ERROR_SUPPRESSED_AT_KEY] = suppressedAt;
      }
      return null;
    }

    return err as string | number | Record<string, unknown> | null;
  });
}

export function mountVideoJsPlayer(
  videoElement: HTMLVideoElement,
  input: VideoJsSourceInput & { messages?: VideoJsMessages },
) {
  const source = resolveVideoPlaybackSource(input);
  if (!source || !isMountableVideoElement(videoElement)) {
    return null;
  }

  registerBeforeErrorHookOnce();

  const existing = videojs.getPlayer(videoElement);
  if (existing) {
    disposeVideoJsPlayer(existing);
  }

  (videoElement as HTMLVideoElement & BeforeErrorCapable)[BEFORE_ERROR_HANDLER_KEY] = input.onBeforeError;

  videoElement.classList.add('video-js', 'vjs-big-play-centered');
  videoElement.setAttribute('playsinline', 'true');

  const languageCode = normalizeLanguageCode(input.messages?.locale);
  if (languageCode && input.messages?.strings) {
    videojs.addLanguage(languageCode, input.messages.strings);
  }

  const player = videojs(videoElement, {
    controls: true,
    preload: 'metadata',
    poster: normalizeMediaUrl(input.poster) || undefined,
    sources: [source],
    language: languageCode || undefined,
    languages: input.messages?.strings
      ? {
          [languageCode]: input.messages.strings,
        }
      : undefined,
    responsive: true,
    fluid: true,
    playbackRates: [0.5, 1, 1.25, 1.5, 2],
    controlBar: {
      pictureInPictureToggle: false,
    },
  });

  player.width('100%');
  const playerElement = player.el() as HTMLElement | null;
  if (playerElement) {
    playerElement.style.width = '100%';
    playerElement.style.maxWidth = '100%';
  }

  player.addClass('geul-video-js');
  (player as BeforeErrorCapable)[BEFORE_ERROR_HANDLER_KEY] = input.onBeforeError;
  applyVideoJsMessages(player, input.messages);
  player.on('error', () => {
    const playerSuppressedAt =
      typeof (player as BeforeErrorCapable)[BEFORE_ERROR_SUPPRESSED_AT_KEY] === 'number'
        ? ((player as BeforeErrorCapable)[BEFORE_ERROR_SUPPRESSED_AT_KEY] as number)
        : 0;
    const elementSuppressedAt =
      typeof (videoElement as HTMLVideoElement & BeforeErrorCapable)[BEFORE_ERROR_SUPPRESSED_AT_KEY] === 'number'
        ? ((videoElement as HTMLVideoElement & BeforeErrorCapable)[BEFORE_ERROR_SUPPRESSED_AT_KEY] as number)
        : 0;
    const suppressedRecently =
      Date.now() - Math.max(playerSuppressedAt, elementSuppressedAt) < RECENT_SUPPRESSED_ERROR_WINDOW_MS;
    if (suppressedRecently) {
      player.error(null as never);
      return;
    }
    const handled = Boolean(input.onError?.());
    if (handled) {
      player.error(null as never);
    }
  });
  return player;
}
