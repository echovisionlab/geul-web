'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ResolvedYoutubeAudio } from '@echovisionlab/youtube-audio';
import { useTranslations } from 'next-intl';
import { AudioTranscodeTool } from '@/features/tools/transcode/AudioTranscodeTool';
import type { AudioTranscoderInputSource } from '@/features/tools/transcode/audio-transcoder-runtime';
import { YoutubeAudioToolView, type YoutubeAudioToolLabels } from './ui';

type YoutubeAudioClientError =
  | 'INTERNAL_ERROR'
  | 'INVALID_REQUEST'
  | 'INVALID_UPSTREAM_RESPONSE'
  | 'REQUEST_ABORTED'
  | 'SOURCE_EXPIRED'
  | 'SOURCE_NOT_FOUND'
  | 'UNAUTHORIZED'
  | 'UNSUPPORTED_VIDEO'
  | 'UPSTREAM_FAILURE';

interface ExternalSource extends AudioTranscoderInputSource {
  readonly id: string;
}

interface YoutubeAudioToolProps {
  fetcher?: typeof fetch;
}

export function YoutubeAudioTool({ fetcher = fetch }: YoutubeAudioToolProps) {
  const t = useTranslations('tools.youtubeAudio');
  const [url, setUrl] = useState('');
  const [resolved, setResolved] = useState<ResolvedYoutubeAudio | null>(null);
  const [resolving, setResolving] = useState(false);
  const [errorCode, setErrorCode] = useState<YoutubeAudioClientError | null>(null);
  const resolveControllerRef = useRef<AbortController | null>(null);
  const resolvedRef = useRef<ResolvedYoutubeAudio | null>(null);

  const revoke = useCallback(
    (sourceId: string) => {
      void fetcher(`/api/tools/youtube-audio/sources/${encodeURIComponent(sourceId)}`, {
        credentials: 'same-origin',
        keepalive: true,
        method: 'DELETE',
      }).catch(() => undefined);
    },
    [fetcher],
  );

  useEffect(() => {
    resolvedRef.current = resolved;
  }, [resolved]);

  useEffect(
    () => () => {
      resolveControllerRef.current?.abort();
      if (resolvedRef.current !== null) {
        revoke(resolvedRef.current.sourceId);
      }
    },
    [revoke],
  );

  const resolveSource = useCallback(async () => {
    const requestedUrl = url.trim();
    if (requestedUrl.length === 0 || resolving) {
      return;
    }
    resolveControllerRef.current?.abort();
    const controller = new AbortController();
    resolveControllerRef.current = controller;
    setResolving(true);
    setErrorCode(null);

    try {
      const response = await fetcher('/api/tools/youtube-audio/resolve', {
        body: JSON.stringify({ url: requestedUrl }),
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
        signal: controller.signal,
      });
      if (!response.ok) {
        setErrorCode(await readErrorCode(response));
        return;
      }
      const next = await readResolvedSource(response);
      if (resolvedRef.current !== null && resolvedRef.current.sourceId !== next.sourceId) {
        revoke(resolvedRef.current.sourceId);
      }
      resolvedRef.current = next;
      setResolved(next);
    } catch (error) {
      if (!controller.signal.aborted) {
        setErrorCode('INTERNAL_ERROR');
      }
    } finally {
      if (resolveControllerRef.current === controller) {
        resolveControllerRef.current = null;
        setResolving(false);
      }
    }
  }, [fetcher, resolving, revoke, url]);

  const clearSource = useCallback(() => {
    const current = resolvedRef.current;
    if (current !== null) {
      revoke(current.sourceId);
    }
    resolvedRef.current = null;
    setResolved(null);
    setErrorCode(null);
  }, [revoke]);

  const source = useMemo<ExternalSource | null>(
    () =>
      resolved === null
        ? null
        : {
            id: resolved.sourceId,
            input: resolved.input,
            name: resolved.input.name,
            size: resolved.input.http.size,
          },
    [resolved],
  );
  const labels = useMemo<YoutubeAudioToolLabels>(
    () => ({
      title: t('title'),
      description: t('description'),
      sourceTitle: t('sourceTitle'),
      sourceDescription: t('sourceDescription'),
      urlLabel: t('urlLabel'),
      urlDescription: t('urlDescription'),
      urlPlaceholder: t('urlPlaceholder'),
      resolve: t('resolve'),
      resolving: t('resolving'),
      ready: t('ready'),
      clear: t('clear'),
    }),
    [t],
  );

  return (
    <YoutubeAudioToolView
      labels={labels}
      url={url}
      resolving={resolving}
      error={errorCode === null ? null : t(`errors.${errorCode}`)}
      resolvedTitle={resolved?.title ?? null}
      onUrlChange={setUrl}
      onResolve={() => void resolveSource()}
      onClear={clearSource}
      converter={
        resolved === null ? null : (
          <AudioTranscodeTool
            externalSource={source}
            initialFormat="mp3"
            title={null}
            onExternalSourceRemove={clearSource}
          />
        )
      }
    />
  );
}

async function readErrorCode(response: Response): Promise<YoutubeAudioClientError> {
  try {
    const body = (await response.json()) as { error?: unknown };
    return isClientError(body.error) ? body.error : 'INTERNAL_ERROR';
  } catch {
    return 'INTERNAL_ERROR';
  }
}

async function readResolvedSource(response: Response): Promise<ResolvedYoutubeAudio> {
  const value = (await response.json()) as Partial<ResolvedYoutubeAudio>;
  if (
    typeof value.sourceId !== 'string' ||
    typeof value.title !== 'string' ||
    typeof value.videoId !== 'string' ||
    typeof value.contentType !== 'string' ||
    typeof value.expiresAt !== 'number' ||
    typeof value.input?.name !== 'string' ||
    typeof value.input.http?.url !== 'string' ||
    typeof value.input.http.size !== 'number' ||
    value.input.http.credentials !== 'include'
  ) {
    throw new Error('The YouTube audio response is invalid.');
  }
  return value as ResolvedYoutubeAudio;
}

function isClientError(value: unknown): value is YoutubeAudioClientError {
  return (
    typeof value === 'string' &&
    [
      'INTERNAL_ERROR',
      'INVALID_REQUEST',
      'INVALID_UPSTREAM_RESPONSE',
      'REQUEST_ABORTED',
      'SOURCE_EXPIRED',
      'SOURCE_NOT_FOUND',
      'UNAUTHORIZED',
      'UNSUPPORTED_VIDEO',
      'UPSTREAM_FAILURE',
    ].includes(value)
  );
}
