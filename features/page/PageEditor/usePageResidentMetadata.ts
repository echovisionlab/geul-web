'use client';

import { useCallback, useLayoutEffect, useState } from 'react';
import type { BlockRoomBootstrap } from '@/lib/collab/block-room-bootstrap';
import { resolvePageResidentMetadata } from './collaboration-mode';

type PageMetadataBootstrap = Pick<
  BlockRoomBootstrap,
  'documentRevision' | 'locale' | 'localeMetadata' | 'targetRevision'
>;

export interface UsePageResidentMetadataInput {
  /** Provider identity distinguishes a canonical room from revision-only ACKs. */
  roomIdentity: object | null;
  sessionLocale: string | null;
  roomLocale: string | null;
  bootstrap: PageMetadataBootstrap | null;
  fallbackTitle: string;
  fallbackSummary: string;
}

interface ResidentMetadataState {
  roomIdentity: object | null;
  sessionLocale: string | null;
  roomLocale: string | null;
  initializedFromBootstrap: boolean;
  title: string;
  summary: string;
}

function hasCanonicalMetadata(input: UsePageResidentMetadataInput): boolean {
  return Boolean(
    input.roomIdentity &&
    input.roomLocale &&
    input.bootstrap?.locale === input.roomLocale &&
    input.bootstrap.localeMetadata,
  );
}

function createResidentMetadataState(input: UsePageResidentMetadataInput): ResidentMetadataState {
  const initializedFromBootstrap = hasCanonicalMetadata(input);
  const resident = resolvePageResidentMetadata({
    roomLocale: input.roomLocale,
    bootstrapLocale: initializedFromBootstrap ? (input.bootstrap?.locale ?? null) : null,
    localeMetadata: initializedFromBootstrap ? input.bootstrap?.localeMetadata : undefined,
    fallbackTitle: input.fallbackTitle,
    fallbackSummary: input.fallbackSummary,
  });

  return {
    roomIdentity: input.roomIdentity,
    sessionLocale: input.sessionLocale,
    roomLocale: input.roomLocale,
    initializedFromBootstrap,
    ...resident,
  };
}

/**
 * Keeps Page title and summary resident across revision ACKs. Canonical metadata
 * initializes once per provider/locale scope; a replacement provider starts a
 * fresh scope, while a temporary null provider during reconnect keeps the draft.
 */
export function usePageResidentMetadata(input: UsePageResidentMetadataInput) {
  const { roomIdentity, sessionLocale, roomLocale, bootstrap, fallbackTitle, fallbackSummary } = input;
  const [state, setState] = useState(() => createResidentMetadataState(input));
  const {
    roomIdentity: stateRoomIdentity,
    sessionLocale: stateSessionLocale,
    roomLocale: stateRoomLocale,
    initializedFromBootstrap,
  } = state;

  useLayoutEffect(() => {
    const currentInput = { roomIdentity, sessionLocale, roomLocale, bootstrap, fallbackTitle, fallbackSummary };

    if (stateSessionLocale !== sessionLocale || stateRoomLocale !== roomLocale) {
      setState(createResidentMetadataState(currentInput));
      return;
    }

    // reloadCanonical briefly removes the provider. Keep local fields until the
    // replacement room arrives so the recovery snapshot can capture them.
    if (!roomIdentity) {
      return;
    }

    if (stateRoomIdentity !== roomIdentity) {
      setState(createResidentMetadataState(currentInput));
      return;
    }

    if (!initializedFromBootstrap && hasCanonicalMetadata(currentInput)) {
      setState(createResidentMetadataState(currentInput));
    }
  }, [
    bootstrap,
    fallbackSummary,
    fallbackTitle,
    initializedFromBootstrap,
    roomIdentity,
    roomLocale,
    sessionLocale,
    stateRoomIdentity,
    stateRoomLocale,
    stateSessionLocale,
  ]);

  const setTitle = useCallback((title: string) => {
    setState((current) => ({ ...current, title }));
  }, []);
  const setSummary = useCallback((summary: string) => {
    setState((current) => ({ ...current, summary }));
  }, []);

  return { title: state.title, summary: state.summary, setTitle, setSummary };
}
