// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FormTranslationProvider, useFormTranslationContext } from './FormTranslationContext';

const useFormEditorContextMock = vi.fn();

vi.mock('@/lib/contexts/FormEditorContext', () => ({
  useFormEditorContext: () => useFormEditorContextMock(),
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement | null = null;
let root: Root | null = null;
let latestContext: ReturnType<typeof useFormTranslationContext> | null = null;

function ContextReader() {
  latestContext = useFormTranslationContext();
  return null;
}

function render(node: React.ReactNode) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);

  act(() => {
    root?.render(node);
  });
}

beforeEach(() => {
  latestContext = null;
  useFormEditorContextMock.mockReset();
  useFormEditorContextMock.mockReturnValue({
    fields: {
      title: 'Source title',
      schema: {
        id: 'source-schema',
        steps: [{ id: 'step-1', title: 'Source step', fields: [] }],
      },
    },
    provider: { kind: 'provider' },
    activeEditLocale: {
      activeLocale: 'en',
      activeLocaleLabel: 'English',
      sourceLocale: 'en',
      localeOptions: [],
      setActiveLocale: vi.fn(),
      isLoading: false,
      isControlVisible: true,
      isSourceLocale: true,
      hasLiveRow: true,
      displayTitle: 'Source title',
      contentJson: undefined,
    },
  });
});

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  container?.remove();
  root = null;
  container = null;
});

describe('FormTranslationProvider', () => {
  it('exposes the active target locale from the resident Form collaboration context', () => {
    useFormEditorContextMock.mockReturnValue({
      fields: { title: 'Source title', schema: { id: 'source-schema', steps: [] } },
      activeEditLocale: {
        activeLocale: 'ko',
        activeLocaleLabel: 'Korean',
        sourceLocale: 'en',
        localeOptions: [],
        setActiveLocale: vi.fn(),
        isLoading: false,
        isControlVisible: true,
        isSourceLocale: false,
        hasLiveRow: true,
        displayTitle: '현지화 제목',
        contentJson: new TextEncoder().encode('{}'),
      },
    });

    render(
      <FormTranslationProvider>
        <ContextReader />
      </FormTranslationProvider>,
    );

    expect(latestContext).toMatchObject({
      isEditingScopedLocale: true,
      activeEditLocale: expect.objectContaining({ activeLocale: 'ko', isSourceLocale: false }),
    });
  });

  it('keeps a missing target locale in read-only preview mode', () => {
    useFormEditorContextMock.mockReturnValue({
      fields: { title: 'Source title', schema: { id: 'source-schema', steps: [] } },
      activeEditLocale: {
        activeLocale: 'ko',
        activeLocaleLabel: 'Korean',
        sourceLocale: 'en',
        localeOptions: [],
        setActiveLocale: vi.fn(),
        isLoading: false,
        isControlVisible: true,
        isSourceLocale: false,
        hasLiveRow: false,
        displayTitle: 'Source title',
        contentJson: undefined,
      },
    });

    render(
      <FormTranslationProvider>
        <ContextReader />
      </FormTranslationProvider>,
    );

    expect(latestContext).toMatchObject({
      isEditingScopedLocale: true,
      activeEditLocale: expect.objectContaining({ hasLiveRow: false }),
    });
  });

  it('keeps the source document as the only editable locale', () => {
    useFormEditorContextMock.mockReturnValue({
      fields: { title: 'Source title', schema: { id: 'source-schema', steps: [] } },
      activeEditLocale: {
        activeLocale: 'en',
        activeLocaleLabel: 'English',
        sourceLocale: 'en',
        localeOptions: [],
        setActiveLocale: vi.fn(),
        isLoading: false,
        isControlVisible: true,
        isSourceLocale: true,
        hasLiveRow: true,
        displayTitle: 'Source title',
        contentJson: undefined,
      },
    });

    render(
      <FormTranslationProvider>
        <ContextReader />
      </FormTranslationProvider>,
    );

    expect(latestContext).toMatchObject({
      isEditingScopedLocale: false,
      activeEditLocale: expect.objectContaining({ activeLocale: 'en', isSourceLocale: true }),
    });
  });
});
