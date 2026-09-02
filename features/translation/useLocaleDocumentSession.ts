'use client';

import { useCallback, useMemo } from 'react';
import { resolveLocaleDocumentMode, resolveLocaleRoomLocale, type LocaleDocumentMode } from './locale-document-mode';
import {
  useActiveEditLocale,
  type UseActiveEditLocaleInput,
  type UseActiveEditLocaleResult,
} from './useActiveEditLocale';

export interface LocaleRoomAuthorityEvidence {
  sourceLocale: string | null;
  locale: string | null;
  localeExists: boolean;
  documentRevision: string | null;
  targetRevision?: string;
}

export interface LocaleDocumentSelection {
  activeLocale: string | null;
  sourceLocale: string | null;
  isSourceLocale: boolean;
  hasLiveRow: boolean;
  isSourceLocaleReady: boolean;
}

export interface ResolvedLocaleDocumentSession {
  mode: LocaleDocumentMode;
  roomLocale: string | null;
}

export interface LocaleDocumentSession extends ResolvedLocaleDocumentSession {
  activeEditLocale: UseActiveEditLocaleResult;
  hasRoomMutationAuthority: (evidence: LocaleRoomAuthorityEvidence) => boolean;
}

const unresolvedDocumentMode: LocaleDocumentMode = {
  isEditingScopedLocale: false,
  hasScopedLocaleLiveRow: false,
  shouldUseLocaleDocument: false,
};

export function resolveLocaleDocumentSession(selection: LocaleDocumentSelection): ResolvedLocaleDocumentSession {
  return {
    mode: selection.isSourceLocaleReady ? resolveLocaleDocumentMode(selection) : unresolvedDocumentMode,
    roomLocale: resolveLocaleRoomLocale(selection),
  };
}

export function hasExactLocaleRoomMutationAuthority(input: {
  selection: LocaleDocumentSelection;
  roomLocale: string | null;
  evidence: LocaleRoomAuthorityEvidence;
}): boolean {
  const { selection, roomLocale, evidence } = input;
  if (
    !selection.isSourceLocaleReady ||
    !selection.activeLocale ||
    !selection.sourceLocale ||
    !roomLocale ||
    !evidence.sourceLocale ||
    !evidence.locale ||
    !evidence.documentRevision?.trim() ||
    selection.activeLocale !== roomLocale ||
    roomLocale !== evidence.locale ||
    selection.sourceLocale !== evidence.sourceLocale ||
    !evidence.localeExists
  ) {
    return false;
  }

  return roomLocale === evidence.sourceLocale
    ? evidence.targetRevision === undefined
    : evidence.targetRevision !== undefined;
}

export function useLocaleDocumentSession(input: UseActiveEditLocaleInput): LocaleDocumentSession {
  const activeEditLocale = useActiveEditLocale(input);
  const selection = useMemo<LocaleDocumentSelection>(
    () => ({
      activeLocale: activeEditLocale.activeLocale,
      sourceLocale: activeEditLocale.sourceLocale,
      isSourceLocale: activeEditLocale.isSourceLocale,
      hasLiveRow: activeEditLocale.hasLiveRow,
      isSourceLocaleReady: activeEditLocale.isSourceLocaleReady,
    }),
    [
      activeEditLocale.activeLocale,
      activeEditLocale.hasLiveRow,
      activeEditLocale.isSourceLocale,
      activeEditLocale.isSourceLocaleReady,
      activeEditLocale.sourceLocale,
    ],
  );
  const resolved = useMemo(() => resolveLocaleDocumentSession(selection), [selection]);
  const hasRoomMutationAuthority = useCallback(
    (evidence: LocaleRoomAuthorityEvidence) =>
      hasExactLocaleRoomMutationAuthority({
        selection,
        roomLocale: resolved.roomLocale,
        evidence,
      }),
    [resolved.roomLocale, selection],
  );

  return useMemo(
    () => ({
      activeEditLocale,
      ...resolved,
      hasRoomMutationAuthority,
    }),
    [activeEditLocale, hasRoomMutationAuthority, resolved],
  );
}
