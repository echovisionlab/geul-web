import { describe, expect, it } from 'vitest';
import {
  hasExactLocaleRoomMutationAuthority,
  resolveLocaleDocumentSession,
  type LocaleDocumentSelection,
} from './useLocaleDocumentSession';

const targetRevision = `tr1_${'A'.repeat(43)}`;
const documentRevision = '11111111-1111-4111-8111-111111111111';

function selection(overrides: Partial<LocaleDocumentSelection> = {}): LocaleDocumentSelection {
  return {
    activeLocale: 'ko',
    sourceLocale: 'ko',
    isSourceLocale: true,
    hasLiveRow: true,
    isSourceLocaleReady: true,
    ...overrides,
  };
}

describe('resolveLocaleDocumentSession', () => {
  it('selects the source document and exact source room', () => {
    expect(resolveLocaleDocumentSession(selection())).toEqual({
      mode: {
        isEditingScopedLocale: false,
        hasScopedLocaleLiveRow: false,
        shouldUseLocaleDocument: true,
      },
      roomLocale: 'ko',
    });
  });

  it('selects an existing target document and exact target room', () => {
    expect(
      resolveLocaleDocumentSession(
        selection({
          activeLocale: 'en',
          isSourceLocale: false,
          hasLiveRow: true,
        }),
      ),
    ).toEqual({
      mode: {
        isEditingScopedLocale: true,
        hasScopedLocaleLiveRow: true,
        shouldUseLocaleDocument: true,
      },
      roomLocale: 'en',
    });
  });

  it('keeps a missing target on the read-only source fallback room', () => {
    expect(
      resolveLocaleDocumentSession(
        selection({
          activeLocale: 'fr',
          isSourceLocale: false,
          hasLiveRow: false,
        }),
      ),
    ).toEqual({
      mode: {
        isEditingScopedLocale: true,
        hasScopedLocaleLiveRow: false,
        shouldUseLocaleDocument: false,
      },
      roomLocale: 'ko',
    });
  });

  it('does not admit a locale document before source-locale authority resolves', () => {
    expect(
      resolveLocaleDocumentSession(
        selection({
          activeLocale: null,
          sourceLocale: null,
          isSourceLocaleReady: false,
        }),
      ),
    ).toEqual({
      mode: {
        isEditingScopedLocale: false,
        hasScopedLocaleLiveRow: false,
        shouldUseLocaleDocument: false,
      },
      roomLocale: null,
    });
  });
});

describe('hasExactLocaleRoomMutationAuthority', () => {
  it('admits an exact source room only when it has no target token', () => {
    const sourceSelection = selection();
    const sourceEvidence = {
      sourceLocale: 'ko',
      locale: 'ko',
      localeExists: true,
      documentRevision,
    } as const;

    expect(
      hasExactLocaleRoomMutationAuthority({
        selection: sourceSelection,
        roomLocale: 'ko',
        evidence: sourceEvidence,
      }),
    ).toBe(true);
    expect(
      hasExactLocaleRoomMutationAuthority({
        selection: sourceSelection,
        roomLocale: 'ko',
        evidence: { ...sourceEvidence, targetRevision },
      }),
    ).toBe(false);
  });

  it('admits an exact live target only with its target token', () => {
    const targetSelection = selection({ activeLocale: 'en', isSourceLocale: false });
    const targetEvidence = {
      sourceLocale: 'ko',
      locale: 'en',
      localeExists: true,
      documentRevision,
    } as const;

    expect(
      hasExactLocaleRoomMutationAuthority({
        selection: targetSelection,
        roomLocale: 'en',
        evidence: { ...targetEvidence, targetRevision },
      }),
    ).toBe(true);
    expect(
      hasExactLocaleRoomMutationAuthority({
        selection: targetSelection,
        roomLocale: 'en',
        evidence: targetEvidence,
      }),
    ).toBe(false);
  });

  it('rejects missing-target fallback and every exact-room identity mismatch', () => {
    const targetSelection = selection({ activeLocale: 'en', isSourceLocale: false });
    const evidence = {
      sourceLocale: 'ko',
      locale: 'en',
      localeExists: true,
      documentRevision,
      targetRevision,
    } as const;

    expect(
      hasExactLocaleRoomMutationAuthority({
        selection: targetSelection,
        roomLocale: 'ko',
        evidence: { ...evidence, locale: 'ko', targetRevision: undefined },
      }),
    ).toBe(false);
    expect(
      hasExactLocaleRoomMutationAuthority({
        selection: targetSelection,
        roomLocale: 'en',
        evidence: { ...evidence, sourceLocale: 'ja' },
      }),
    ).toBe(false);
    expect(
      hasExactLocaleRoomMutationAuthority({
        selection: targetSelection,
        roomLocale: 'en',
        evidence: { ...evidence, locale: 'ja' },
      }),
    ).toBe(false);
    expect(
      hasExactLocaleRoomMutationAuthority({
        selection: targetSelection,
        roomLocale: 'en',
        evidence: { ...evidence, localeExists: false },
      }),
    ).toBe(false);
  });

  it('rejects a room without the shared document revision', () => {
    expect(
      hasExactLocaleRoomMutationAuthority({
        selection: selection(),
        roomLocale: 'ko',
        evidence: {
          sourceLocale: 'ko',
          locale: 'ko',
          localeExists: true,
          documentRevision: null,
        },
      }),
    ).toBe(false);
  });
});
