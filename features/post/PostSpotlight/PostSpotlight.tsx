'use client';

import { Component, type ComponentType, type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { LayoutInset } from '@/components/core/Layout';
import { useTranslations } from 'next-intl';
import { useDebouncedValue, useHotkeys } from '@mantine/hooks';
import { CommandPalette, CommandPaletteResults } from '@/components/core/CommandPalette';
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

/** Open the input immediately; mount search data/results only after invocation. */
export function PostSpotlight() {
  const t = useTranslations('common');
  const [opened, setOpened] = useState(false);
  const close = useCallback(() => setOpened(false), []);
  const [query, setQuery] = useState('');
  const [debouncedQuery] = useDebouncedValue(query, 300);
  const tPlaceholders = useTranslations('common.placeholders');
  const tShell = useTranslations('shell');
  const tMessages = useTranslations('common.messages');
  const tStates = useTranslations('common.states');
  const [Runtime, setRuntime] = useState<ComponentType<PostSpotlightRuntimeProps> | null>(null);
  const [openRequest, setOpenRequest] = useState(0);
  const [failed, setFailed] = useState(false);
  const mounted = useRef(false);
  const pending = useRef(false);
  const loaded = useRef(false);

  const open = useCallback(() => {
    setOpenRequest((request) => request + 1);
    setFailed(false);
    setOpened(true);
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
      close();
      window.removeEventListener(POST_SPOTLIGHT_OPEN_EVENT, handleOpen);
    };
  }, [open, close]);

  useHotkeys([['mod + K', open]]);

  const fallback = (
    <Alert
      tone="danger"
      role="alert"
      title={t('labels.error')}
      withCloseButton
      onClose={close}
      closeButtonLabel={t('actions.close')}
    >
      {t('errors.generic')}
      <LayoutInset blockStart="sm">
        <Button onClick={open}>{t('actions.tryAgain')}</Button>
      </LayoutInset>
    </Alert>
  );

  // The field's placeholder already names the search; before two characters, the empty state says what to do next.
  const pendingMessage = query.length < 2 ? tMessages('typeAtLeast2Characters', { count: 2 }) : tStates('loading');

  return (
    <CommandPalette
      opened={opened}
      onClose={close}
      title={tShell('actions.search')}
      closeLabel={t('actions.close')}
      query={query}
      onQueryChange={setQuery}
      placeholder={tPlaceholders('searchPosts')}
    >
      {opened &&
        (failed ? (
          fallback
        ) : Runtime ? (
          <SearchBoundary resetKey={openRequest} fallback={fallback}>
            <Runtime query={query} debouncedQuery={debouncedQuery} opened={opened} />
          </SearchBoundary>
        ) : (
          <CommandPaletteResults items={[]} label={tPlaceholders('searchPosts')} emptyLabel={pendingMessage} />
        ))}
    </CommandPalette>
  );
}
