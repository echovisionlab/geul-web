'use client';

import { Component, type ComponentType, type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useDebouncedValue, useHotkeys } from '@mantine/hooks';
import { createSpotlight, SpotlightEmpty, SpotlightRoot, SpotlightSearch, useSpotlight } from '@mantine/spotlight';
import { IconSearch } from '@tabler/icons-react';
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
  const [[store, controls]] = useState(createSpotlight);
  const { opened } = useSpotlight(store);
  const [query, setQuery] = useState('');
  const [debouncedQuery] = useDebouncedValue(query, 300);
  const tPlaceholders = useTranslations('common.placeholders');
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
    controls.open();
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
  }, [controls]);

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
      controls.close();
      window.removeEventListener(POST_SPOTLIGHT_OPEN_EVENT, handleOpen);
    };
  }, [open, controls]);

  useHotkeys([['mod + K', open]]);

  const fallback = (
    <Alert tone="danger" role="alert" title={t('labels.error')} withCloseButton onClose={controls.close}>
      {t('errors.generic')}
      <Button onClick={open} mt="sm">
        {t('actions.tryAgain')}
      </Button>
    </Alert>
  );

  const pendingMessage =
    query.length === 0
      ? tPlaceholders('searchPosts')
      : query.length < 2
        ? tMessages('typeAtLeast2Characters', { count: 2 })
        : tStates('loading');

  return (
    <SpotlightRoot
      store={store}
      query={query}
      onQueryChange={setQuery}
      shortcut={null}
      styles={{
        content: { padding: 'var(--mantine-spacing-sm)' },
        search: {
          border: 'none',
          borderBottom: '1px solid var(--mantine-color-default-border)',
          borderRadius: 0,
          background: 'transparent',
        },
        action: { padding: 'var(--mantine-spacing-sm)', borderRadius: 'var(--mantine-radius-md)' },
        actionBody: { flex: 1 },
        actionsGroup: { padding: 'var(--mantine-spacing-xs) 0' },
      }}
    >
      <SpotlightSearch placeholder={tPlaceholders('searchPosts')} leftSection={<IconSearch size={20} />} />
      {opened &&
        (failed ? (
          fallback
        ) : Runtime ? (
          <SearchBoundary resetKey={openRequest} fallback={fallback}>
            <Runtime query={query} debouncedQuery={debouncedQuery} opened={opened} />
          </SearchBoundary>
        ) : (
          <SpotlightEmpty>{pendingMessage}</SpotlightEmpty>
        ))}
    </SpotlightRoot>
  );
}
