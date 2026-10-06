'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Stack, Text, useComputedColorScheme } from '@mantine/core';
import { Button } from '@/components/core/Button';
import {
  buildEmbedAllow,
  buildEmbedSandbox,
  hasUnsafeEmbedOrigin,
  readEmbedHeightMessage,
  resolveEmbedUrl,
} from './policy';
import { type EmbedProps } from './schema';
import classes from './EmbedFrame.module.css';

export interface EmbedFrameProps {
  props: EmbedProps;
  preview?: boolean;
}

export function EmbedFrame({ props, preview = false }: EmbedFrameProps) {
  const t = useTranslations('pageEditor.embed');
  const locale = useLocale();
  const colorScheme = useComputedColorScheme('light');
  const [parentOrigin, setParentOrigin] = useState<string | null>(null);
  const sandbox = buildEmbedSandbox(props);
  const allow = buildEmbedAllow(props);
  const identity = `${props.uri}:${props.heightMode}:${sandbox}:${allow}`;
  useEffect(() => setParentOrigin(window.location.origin), []);
  const url = resolveEmbedUrl(props.uri);
  const unsafe = parentOrigin !== null && hasUnsafeEmbedOrigin(props, parentOrigin);
  const canRender = url && parentOrigin !== null && !unsafe;

  return (
    <Stack gap="xs">
      {canRender ? (
        <EmbedDocument
          key={identity}
          props={props}
          url={url}
          preview={preview}
          locale={locale}
          colorScheme={colorScheme}
          title={props.title.trim() || t('playerTitle')}
          activateLabel={t('activatePreview')}
        />
      ) : (
        <div
          className={classes.placeholder}
          style={
            url && parentOrigin === null
              ? { minHeight: props.heightMode === 'viewport' ? 'clamp(180px, 80dvh, 2160px)' : Number(props.height) }
              : undefined
          }
        >
          <Text c="dimmed" size="sm">
            {unsafe
              ? t('unsafeOrigin')
              : url && parentOrigin === null
                ? null
                : props.uri.trim()
                  ? t('invalidPreview')
                  : t('emptyPreview')}
          </Text>
        </div>
      )}
    </Stack>
  );
}

function EmbedDocument({
  props,
  url,
  preview,
  locale,
  colorScheme,
  title,
  activateLabel,
}: {
  props: EmbedProps;
  url: URL;
  preview: boolean;
  locale: string;
  colorScheme: string;
  title: string;
  activateLabel: string;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [autoHeight, setAutoHeight] = useState<number | null>(null);
  const [active, setActive] = useState(!preview);
  useEffect(() => {
    if (props.heightMode !== 'auto') {
      return;
    }
    const onMessage = (event: MessageEvent) => {
      const height = readEmbedHeightMessage(event, frame.current?.contentWindow ?? null, url.origin);
      if (height !== null) {
        setAutoHeight(height);
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [props.heightMode, url.origin]);
  const initialize = useCallback(() => {
    if (props.allowSameOrigin === 'true') {
      frame.current?.contentWindow?.postMessage({ type: 'geul:embed:init', locale, colorScheme }, url.origin);
    }
  }, [props.allowSameOrigin, locale, colorScheme, url.origin]);
  useEffect(initialize, [initialize]);
  const height =
    props.heightMode === 'viewport'
      ? 'clamp(180px, 80dvh, 2160px)'
      : props.heightMode === 'auto'
        ? (autoHeight ?? Number(props.height))
        : Number(props.height);
  return (
    <div className={classes.frameContainer}>
      <iframe
        ref={frame}
        src={url.href}
        title={title}
        className={classes.frame}
        style={{ height, pointerEvents: active ? 'auto' : 'none' }}
        sandbox={buildEmbedSandbox(props)}
        allow={buildEmbedAllow(props)}
        allowFullScreen={props.allowFullscreen === 'true'}
        tabIndex={active ? undefined : -1}
        referrerPolicy="no-referrer"
        loading="lazy"
        onLoad={initialize}
      />
      {!active && (
        <div className={classes.activation}>
          <Button size="sm" onClick={() => setActive(true)}>
            {activateLabel}
          </Button>
        </div>
      )}
    </div>
  );
}
