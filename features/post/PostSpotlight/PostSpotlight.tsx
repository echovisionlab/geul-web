'use client';

import { Component, type ComponentType, type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useHotkeys } from '@mantine/hooks';
import { Alert } from '@/components/core/Alert';
import { Button } from '@/components/core/Button';
import { loadPostSpotlightRuntime } from './post-spotlight-runtime-loader';
import { consumePostSpotlightOpen, POST_SPOTLIGHT_OPEN_EVENT } from './post-spotlight-trigger';
import type { PostSpotlightRuntimeProps } from './PostSpotlightRuntime';

class SearchBoundary extends Component<
  { children: ReactNode; fallback: ReactNode; resetKey: number },
  { failed: boolean; resetKey: number }
> {
  state = { failed: false, resetKey: 0 };

  static getDerivedStateFromProps(props: { resetKey: number }, state: { resetKey: number }) {
    return props.resetKey !== state.resetKey ? { failed: false, resetKey: props.resetKey } : null;
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/** Mount the search renderer only after its first button or keyboard invocation. */
export function PostSpotlight() {
  const t = useTranslations('common');
  const [Runtime, setRuntime] = useState<ComponentType<PostSpotlightRuntimeProps> | null>(null);
  const [openRequest, setOpenRequest] = useState(0);
  const [failed, setFailed] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const mounted = useRef(false);
  const pending = useRef(false);
  const loaded = useRef(false);

  const open = useCallback(() => {
    setOpenRequest((request) => request + 1);
    setFailed(false);
    setDismissed(false);
    if (loaded.current || pending.current) {
      return;
    }
    pending.current = true;
    loadPostSpotlightRuntime()
      .then((runtime) => {
        if (mounted.current) {
          loaded.current = true;
          setRuntime(() => runtime);
        }
      })
      .catch(() => {
        if (mounted.current) {
          setFailed(true);
        }
      })
      .finally(() => {
        pending.current = false;
      });
  }, []);

  useEffect(() => {
    mounted.current = true;
    const handleOpen = () => {
      if (consumePostSpotlightOpen()) {
        open();
      }
    };
    window.addEventListener(POST_SPOTLIGHT_OPEN_EVENT, handleOpen);
    handleOpen();
    return () => {
      mounted.current = false;
      window.removeEventListener(POST_SPOTLIGHT_OPEN_EVENT, handleOpen);
    };
  }, [open]);

  useHotkeys([['mod + K', open]]);

  const fallback = (
    <Alert tone="danger" role="alert" title={t('labels.error')} withCloseButton onClose={() => setDismissed(true)}>
      {t('errors.generic')}
      <Button onClick={open} mt="sm">
        {t('actions.tryAgain')}
      </Button>
    </Alert>
  );

  if (dismissed) {
    return null;
  }
  if (failed) {
    return fallback;
  }
  if (!Runtime) {
    return null;
  }
  return (
    <SearchBoundary resetKey={openRequest} fallback={fallback}>
      <Runtime openRequest={openRequest} />
    </SearchBoundary>
  );
}
