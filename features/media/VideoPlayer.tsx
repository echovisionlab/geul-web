'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useLocale, useTranslations } from 'next-intl';
import { Box } from '@mantine/core';
import { buildVideoJsMessages } from '@/features/media/runtime/videojs-messages';
import { resolveVideoPlaybackSource } from '@/features/media/runtime/videojs-source';
import { loadVideoJsRuntime } from '@/features/media/runtime/videojs-loader';
import type { mountVideoJsPlayer } from '@/features/media/runtime/videojs-player';
import { MediaPlayerStatusOverlay } from '@/features/media/ui/MediaPlayerStatusOverlay';
import 'video.js/dist/video-js.css';
import './ui/MediaPlayer.css';
import './ui/VideoPlayer.css';

interface VideoPlayerProps {
  hlsSrc?: string;
  src?: string;
  poster?: string;
  duration?: number;
  isReady?: boolean;
  isProcessing?: boolean;
  action?: ReactNode;
}

export function VideoPlayer({
  hlsSrc,
  src,
  poster,
  duration: _duration,
  isReady = true,
  isProcessing = false,
  action,
}: VideoPlayerProps) {
  const tMedia = useTranslations('editorCommon.media');
  const locale = useLocale();
  const mountRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<ReturnType<typeof mountVideoJsPlayer> | null>(null);
  const [actionSlotElement, setActionSlotElement] = useState<HTMLDivElement | null>(null);
  const messages = useMemo(() => buildVideoJsMessages(locale, tMedia), [locale, tMedia]);

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

          const currentVideo = document.createElement('video');
          currentVideo.className = 'video-js vjs-big-play-centered';
          mountNode.appendChild(currentVideo);
          const player = loadedRuntime.mountVideoJsPlayer(currentVideo, { hlsSrc, src, poster, messages });
          playerRef.current = player;

          const controlBar = (player?.el?.() as HTMLElement | null)?.querySelector('.vjs-control-bar');
          if (controlBar) {
            const actionSlot = document.createElement('div');
            actionSlot.className = 'video-player__action-slot';
            actionSlot.dataset.videoPlayerActionSlot = 'true';
            controlBar.insertBefore(actionSlot, controlBar.querySelector('.vjs-fullscreen-control'));
            setActionSlotElement(actionSlot);
          }
        });
      })
      .catch(() => {
        if (cancelled || !mountNode.isConnected) {
          return;
        }
        // Keep playback accessible if the runtime chunk could not be fetched.
        const fallback = document.createElement('video');
        fallback.controls = true;
        fallback.playsInline = true;
        fallback.preload = 'metadata';
        fallback.src = resolveVideoPlaybackSource({ src })?.src || playbackSource.src;
        if (poster) {
          fallback.poster = poster;
        }
        mountNode.replaceChildren(fallback);
      });

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
  }, [hlsSrc, isReady, messages, poster, src]);

  return (
    <Box
      className="video-player-container geul-media-player"
      data-video-player-processing={isProcessing ? 'true' : 'false'}
      style={{ position: 'relative' }}
    >
      <Box ref={mountRef} className="video-player__mount" data-video-player-mount />
      {isProcessing ? (
        <Box data-processing-overlay>
          <MediaPlayerStatusOverlay message={tMedia('videoEditor.processingOverlay')} kind="processing" />
        </Box>
      ) : null}
      {action && actionSlotElement ? createPortal(action, actionSlotElement) : null}
    </Box>
  );
}
