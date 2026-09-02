// @vitest-environment jsdom

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
    return null;
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
