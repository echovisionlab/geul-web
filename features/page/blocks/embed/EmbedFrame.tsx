'use client';
import { PageLoader } from '@/features/site/PageLoader';
import { SupportingText } from '@/components/core/Typography';

import { LayoutStack as DsLayoutStack } from '@/components/core/Layout';

import { useComputedColorScheme } from '@/lib/providers/DesignSystemProvider';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';

import { Button } from '@/components/core/Button';
import {
  buildEmbedAllow,
  buildEmbedSandbox,
  hasUnsafeEmbedOrigin,
  isEmbedReadyMessage,
  isToolModuleUrl,
  isTrustedToolModuleUrl,
  readEmbedHeightMessage,
  resolveEmbedUrl,
} from './policy';
import { type EmbedProps } from './schema';
import classes from './EmbedFrame.module.css';
import { ToolModule } from './ToolModule';

export interface EmbedFrameProps {
  props: EmbedProps;
  preview?: boolean;
}

export function EmbedFrame({ props, preview = false }: EmbedFrameProps) {
  const t = useTranslations('pageEditor.embed');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const colorScheme = useComputedColorScheme();
  const [parentOrigin, setParentOrigin] = useState<string | null>(null);
  const sandbox = buildEmbedSandbox(props);
  const allow = buildEmbedAllow(props);
  const identity = `${props.uri}:${props.heightMode}:${sandbox}:${allow}`;
  useEffect(() => setParentOrigin(window.location.origin), []);
  const url = resolveEmbedUrl(props.uri, parentOrigin);
  const module = url && isToolModuleUrl(url);
  const untrustedModule = module && parentOrigin !== null && !isTrustedToolModuleUrl(url, parentOrigin);
  const unsafe = !module && parentOrigin !== null && hasUnsafeEmbedOrigin(props, parentOrigin);
  const canRender = url && parentOrigin !== null && !unsafe;

  return (
    <DsLayoutStack gap="xs">
      {canRender && module ? (
        untrustedModule ? (
          <SupportingText role="alert" tone="secondary">
            {t('toolOriginError')}
          </SupportingText>
        ) : (
          <ToolModule
            key={url.href}
            uri={url.href}
            title={props.title.trim() || t('playerTitle')}
            preview={preview}
            locale={locale}
            colorScheme={colorScheme}
            activateLabel={t('activatePreview')}
            loadingLabel={t('toolLoading')}
            errorLabel={t('toolLoadError')}
          />
        )
      ) : canRender ? (
        <EmbedDocument
          key={identity}
          props={props}
          url={url}
          preview={preview}
          locale={locale}
          colorScheme={colorScheme}
          title={props.title.trim() || t('playerTitle')}
          activateLabel={t('activatePreview')}
          loadingLabel={t('toolLoading')}
          errorLabel={tCommon('errors.generic')}
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
          {url && parentOrigin === null ? (
            <PageLoader extent="container" placement="flow" />
          ) : (
            <SupportingText tone="secondary">
              {unsafe ? t('unsafeOrigin') : props.uri.trim() ? t('invalidPreview') : t('emptyPreview')}
            </SupportingText>
          )}
        </div>
      )}
    </DsLayoutStack>
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
  loadingLabel,
  errorLabel,
}: {
  props: EmbedProps;
  url: URL;
  preview: boolean;
  locale: string;
  colorScheme: string;
  title: string;
  activateLabel: string;
  loadingLabel: string;
  errorLabel: string;
}) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const frame = useRef<HTMLIFrameElement>(null);
  const [autoHeight, setAutoHeight] = useState<number | null>(null);
  const [active, setActive] = useState(!preview);
  const initialize = useCallback(() => {
    if (props.allowSameOrigin === 'true') {
      frame.current?.contentWindow?.postMessage({ type: 'geul:embed:init', locale, colorScheme }, url.origin);
    }
  }, [props.allowSameOrigin, locale, colorScheme, url.origin]);
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const frameWindow = frame.current?.contentWindow ?? null;
      if (isEmbedReadyMessage(event, frameWindow, url.origin)) {
        initialize();
      }
      if (props.heightMode === 'auto') {
        const height = readEmbedHeightMessage(event, frameWindow, url.origin);
        if (height !== null) {
          setAutoHeight(height);
        }
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [props.heightMode, url.origin, initialize]);
  useEffect(initialize, [initialize]);
  const height =
    props.heightMode === 'viewport'
      ? 'clamp(180px, 80dvh, 2160px)'
      : props.heightMode === 'auto'
        ? (autoHeight ?? Number(props.height))
        : Number(props.height);
  return (
    <div className={classes.frameContainer} aria-busy={status === 'loading'}>
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
        aria-hidden={!active || undefined}
        inert={!active || undefined}
        referrerPolicy="no-referrer"
        loading="lazy"
        onLoad={() => {
          initialize();
          setStatus('ready');
        }}
        onError={() => setStatus('error')}
      />
      {status === 'loading' && active ? <PageLoader extent="container" message={loadingLabel} /> : null}
      {status === 'error' ? (
        <SupportingText role="alert" tone="danger">
          {errorLabel}
        </SupportingText>
      ) : null}
      {!active && (
        <div className={classes.activation}>
          <Button
            size="sm"
            onClick={() => {
              setActive(true);
              requestAnimationFrame(() => frame.current?.focus());
            }}
          >
            {activateLabel}
          </Button>
        </div>
      )}
    </div>
  );
}
