'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useLocale, useTranslations } from 'next-intl';

import { buildVideoJsMessages } from '@/features/media/runtime/videojs-messages';
import { resolveVideoPlaybackSource } from '@/features/media/runtime/videojs-source';
import { loadVideoJsRuntime } from '@/features/media/runtime/videojs-loader';
import type { mountVideoJsPlayer } from '@/features/media/runtime/videojs-player';
import { PageLoader } from '@/features/site/PageLoader';
import { MediaPlayerStatusOverlay } from '@/features/media/ui/MediaPlayerStatusOverlay';
import { VideoPlayerView } from './ui/VideoPlayerView';
import { MediaActionSlot, applyMediaActionSlot } from '@/components/core/MediaControls';
import 'video.js/dist/video-js.css';

interface VideoPlayerProps {
  name?: string;
  hlsSrc?: string;
  src?: string;
  poster?: string;
  duration?: number;
  isReady?: boolean;
  isProcessing?: boolean;
  action?: ReactNode;
  /** Reports the video's natural size once its metadata loads. */
  onNaturalSize?: (width: number, height: number) => void;
}

export function VideoPlayer({
  name,
  hlsSrc,
  src,
  poster,
  duration: _duration,
  isReady = true,
  isProcessing = false,
  action,
  onNaturalSize,
}: VideoPlayerProps) {
  const tMedia = useTranslations('editorCommon.media');
  const locale = useLocale();
  const mountRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<ReturnType<typeof mountVideoJsPlayer> | null>(null);
  const [preparedTarget, setPreparedTarget] = useState<unknown>(null);
  const [actionSlotElement, setActionSlotElement] = useState<HTMLDivElement | null>(null);
  const messages = useMemo(
    () => ({ ...buildVideoJsMessages(locale, tMedia), ...(name ? { regionLabel: name } : {}) }),
    [locale, name, tMedia],
  );

  const preparationTarget = useMemo(() => ({}), [hlsSrc, isReady, messages, poster, src]);
  const preparing =
    isReady && Boolean(resolveVideoPlaybackSource({ hlsSrc, src, poster })) && preparedTarget !== preparationTarget;

  const onNaturalSizeRef = useRef(onNaturalSize);
  onNaturalSizeRef.current = onNaturalSize;
  useEffect(() => {
    const mountNode = mountRef.current;
    if (!mountNode) {
      return;
    }
    // Media events do not bubble; capture covers the Video.js and fallback elements alike.
    const reportNaturalSize = (event: Event) => {
      const video = event.target;
      if (video instanceof HTMLVideoElement) {
        onNaturalSizeRef.current?.(video.videoWidth, video.videoHeight);
      }
    };
    mountNode.addEventListener('loadedmetadata', reportNaturalSize, true);
    return () => mountNode.removeEventListener('loadedmetadata', reportNaturalSize, true);
  }, []);

  useEffect(() => {
    const mountNode = mountRef.current;
    if (!mountNode) {
      return;
    }

    const playbackSource = resolveVideoPlaybackSource({ hlsSrc, src, poster });
    let frameId: number | null = null;
    let cancelled = false;
    let runtime: Awaited<ReturnType<typeof loadVideoJsRuntime>> | null = null;
    const resetContainer = () => mountNode.replaceChildren();

    resetContainer();

    if (!isReady || !playbackSource) {
      return;
    }

    const mountNativeFallback = () => {
      if (cancelled || !mountNode.isConnected) {
        return;
      }
      // Keep native playback available when runtime preparation fails.
      const fallback = document.createElement('video');
      fallback.setAttribute('aria-label', messages.regionLabel);
      fallback.controls = true;
      fallback.playsInline = true;
      fallback.preload = 'metadata';
      fallback.src = resolveVideoPlaybackSource({ src })?.src || playbackSource.src;
      if (poster) {
        fallback.poster = poster;
      }
      mountNode.replaceChildren(fallback);
      setPreparedTarget(preparationTarget);
    };

    void loadVideoJsRuntime()
      .then((loadedRuntime) => {
        if (cancelled) {
          return;
        }
        runtime = loadedRuntime;
        frameId = window.requestAnimationFrame(() => {
          if (cancelled || mountRef.current !== mountNode || !mountNode.isConnected) {
            return;
          }

          try {
            const currentVideo = document.createElement('video');
            currentVideo.className = 'video-js vjs-big-play-centered';
            currentVideo.setAttribute('aria-label', messages.regionLabel);
            mountNode.appendChild(currentVideo);
            const player = loadedRuntime.mountVideoJsPlayer(currentVideo, { hlsSrc, src, poster, messages });
            playerRef.current = player;
            setPreparedTarget(preparationTarget);

            const controlBar = (player?.el?.() as HTMLElement | null)?.querySelector('.vjs-control-bar');
            if (controlBar) {
              const actionSlot = document.createElement('div');
              actionSlot.className = 'video-player__action-slot';
              applyMediaActionSlot(actionSlot);
              actionSlot.dataset.videoPlayerActionSlot = 'true';
              controlBar.insertBefore(actionSlot, controlBar.querySelector('.vjs-fullscreen-control'));
              setActionSlotElement(actionSlot);
            }
          } catch {
            mountNativeFallback();
          }
        });
      })
      .catch(mountNativeFallback);

    return () => {
      cancelled = true;
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
      if (playerRef.current) {
        runtime?.disposeVideoJsPlayer(playerRef.current);
        playerRef.current = null;
      }
      setActionSlotElement(null);
      resetContainer();
    };
  }, [hlsSrc, isReady, messages, poster, src, preparationTarget]);

  return (
    <VideoPlayerView
      name={messages.regionLabel}
      mountRef={mountRef}
      preparing={preparing}
      processing={isProcessing}
      loadingSurface={
        <PageLoader
          contrast="inverse"
          height="100%"
          minHeight={0}
          message={tMedia('videoPlayer.controls.videoPlayerLoading')}
        />
      }
      processingSurface={
        <MediaPlayerStatusOverlay message={tMedia('videoEditor.processingOverlay')} kind="processing" />
      }
    >
      {action && actionSlotElement
        ? createPortal(<MediaActionSlot>{action}</MediaActionSlot>, actionSlotElement)
        : null}
    </VideoPlayerView>
  );
}
