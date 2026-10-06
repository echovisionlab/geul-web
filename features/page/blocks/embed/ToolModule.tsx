'use client';

import { useEffect, useRef, useState } from 'react';
import { Text } from '@mantine/core';
import { Button } from '@/components/core/Button';
import { loadToolModule, type MountedTool, type ToolContext } from './loadToolModule';
import classes from './EmbedFrame.module.css';

interface ToolModuleProps extends ToolContext {
  uri: string;
  title?: string;
  preview: boolean;
  activateLabel: string;
  loadingLabel: string;
  errorLabel: string;
}

export function ToolModule({
  uri,
  title,
  preview,
  activateLabel,
  loadingLabel,
  errorLabel,
  locale,
  colorScheme,
}: ToolModuleProps) {
  const container = useRef<HTMLDivElement>(null);
  const mounted = useRef<MountedTool | null>(null);
  const context = useRef<ToolContext>({ locale, colorScheme });
  context.current = { locale, colorScheme };
  const [active, setActive] = useState(!preview);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  useEffect(() => {
    if (!active) {
      return;
    }
    const controller = new AbortController();
    const host = document.createElement('div');
    container.current!.append(host);
    setStatus('loading');
    const initialContext = context.current;
    async function start() {
      try {
        const module = await loadToolModule(uri);
        if (controller.signal.aborted) {
          return;
        }
        const instance = await module.mount(host, { ...initialContext, signal: controller.signal });
        if (controller.signal.aborted) {
          instance.destroy();
          return;
        }
        mounted.current = instance;
        instance.update(context.current);
        setStatus('ready');
      } catch {
        if (!controller.signal.aborted) {
          mounted.current?.destroy();
          mounted.current = null;
          host.remove();
          setStatus('error');
        }
      }
    }
    void start();
    return () => {
      controller.abort();
      mounted.current?.destroy();
      mounted.current = null;
      host.remove();
    };
  }, [uri, active]);
  useEffect(() => {
    mounted.current?.update({ locale, colorScheme });
  }, [locale, colorScheme]);
  return (
    <div className={classes.frameContainer} role="group" aria-label={title || undefined}>
      <div ref={container} />
      {!active ? (
        <Button size="sm" onClick={() => setActive(true)}>
          {activateLabel}
        </Button>
      ) : status === 'loading' ? (
        <Text role="status" aria-live="polite" c="dimmed" size="sm">
          {loadingLabel}
        </Text>
      ) : status === 'error' ? (
        <Text role="alert" c="dimmed" size="sm">
          {errorLabel}
        </Text>
      ) : null}
    </div>
  );
}
