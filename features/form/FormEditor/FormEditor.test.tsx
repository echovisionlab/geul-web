// @vitest-environment jsdom
import { setProviderAccessLevel } from '@/lib/collab/provider-control-state';

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FormEditor } from './FormEditor';

const useFormEditorContextMock = vi.fn();
const useFormTranslationContextMock = vi.fn();
const formBuilderMock = vi.fn();
const setFieldMock = vi.fn();

vi.mock('@/lib/contexts/FormEditorContext', () => ({
  useFormEditorContext: () => useFormEditorContextMock(),
}));

vi.mock('@/features/form/FormTranslationContext', () => ({
  useFormTranslationContext: () => useFormTranslationContextMock(),
}));

vi.mock('../FormBuilder/FormBuilder', () => ({
  FormBuilder: (props: unknown) => {
    formBuilderMock(props);
    return <div data-testid="form-builder" />;
  },
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement | null = null;
let root: Root | null = null;

function render() {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);

  act(() => {
    root?.render(<FormEditor />);
  });
}

beforeEach(() => {
  formBuilderMock.mockReset();
  useFormEditorContextMock.mockReset();
  useFormTranslationContextMock.mockReset();
  setFieldMock.mockReset();

  useFormEditorContextMock.mockReturnValue({
    isSynced: true,
    fields: {
      title: 'Source form',
      schema: {
        id: 'form-1',
        steps: [
          {
            id: 'step-source',
            title: 'Source step',
            fields: [
              {
                id: 'field-email',
                key: 'email',
                label: 'Email',
                type: 'email',
              },
            ],
          },
        ],
      },
    },
    setField: setFieldMock,
  });
  useFormTranslationContextMock.mockReturnValue({
    activeEditLocale: {
      activeLocale: 'ko',
      isSourceLocale: false,
      hasLiveRow: true,
      displayTitle: '현지화 폼',
    },
    isEditingScopedLocale: true,
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

describe('FormEditor', () => {
  it.each([true, false])(
    'upgrades the resident builder in place and rejects writes after downgrade (source: %s)',
    (isSourceLocale) => {
      useFormTranslationContextMock.mockReturnValue({
        activeEditLocale: { activeLocale: isSourceLocale ? 'en' : 'ko', isSourceLocale, hasLiveRow: true },
        isEditingScopedLocale: !isSourceLocale,
      });
      const provider = {};
      useFormEditorContextMock.mockReturnValue({ ...useFormEditorContextMock(), provider });
      setProviderAccessLevel(provider, 'view');
      render();
      const before = formBuilderMock.mock.lastCall?.[0];
      const builder = container!.querySelector('[data-testid="form-builder"]');
      expect(builder).not.toBeNull();
      expect(before.mode).toBe('readOnly');
      act(() => setProviderAccessLevel(provider, 'edit'));
      expect(formBuilderMock.mock.lastCall?.[0].mode).toBe(isSourceLocale ? 'full' : 'translation');
      expect(container!.querySelector('[data-testid="form-builder"]')).toBe(builder);
      expect(formBuilderMock.mock.lastCall?.[0].schema).toBe(before.schema);
      act(() => setProviderAccessLevel(provider, 'view'));
      const after = formBuilderMock.mock.lastCall?.[0];
      expect(after.mode).toBe('readOnly');
      expect(after.schema).toBe(before.schema);
      expect(container!.querySelector('[data-testid="form-builder"]')).toBe(builder);
      act(() => after.onChange({ id: 'form-1', steps: [] }));
      expect(setFieldMock).not.toHaveBeenCalled();
    },
  );
  it('keeps the builder read-only until the canonical room has synced', () => {
    const context = useFormEditorContextMock();
    useFormEditorContextMock.mockReturnValue({ ...context, isSynced: false });

    render();

    const props = formBuilderMock.mock.lastCall?.[0] as {
      mode: string;
      onChange: (schema: { id: string; steps: [] }) => void;
    };
    expect(props.mode).toBe('readOnly');

    act(() => {
      props.onChange({ id: 'form-1', steps: [] });
    });

    expect(setFieldMock).not.toHaveBeenCalled();
  });

  it('opens an existing target in translation mode with the resident locale schema', () => {
    render();

    expect(formBuilderMock).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'translation',
        title: 'Source form',
        schema: {
          id: 'form-1',
          steps: [
            {
              id: 'step-source',
              title: 'Source step',
              fields: [
                {
                  id: 'field-email',
                  key: 'email',
                  label: 'Email',
                  type: 'email',
                },
              ],
            },
          ],
        },
      }),
    );
  });

  it('writes locale-owned target field changes through the collaborative resident document', () => {
    render();

    const props = formBuilderMock.mock.lastCall?.[0] as {
      mode: string;
      onChange: (schema: { id: string; steps: [] }) => void;
    };
    expect(props.mode).toBe('translation');

    act(() => {
      props.onChange({ id: 'form-1', steps: [] });
    });

    expect(setFieldMock).toHaveBeenCalledWith('schema', { id: 'form-1', steps: [] });
  });
});
