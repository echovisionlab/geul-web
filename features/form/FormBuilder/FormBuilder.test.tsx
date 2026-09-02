// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MantineProvider } from '@mantine/core';
import { FormBuilder } from './FormBuilder';

const buildFormMock = vi.fn();

vi.mock('next-intl', () => ({
  useTranslations: (namespace: string) => (key: string, values?: Record<string, unknown>) => {
    if (namespace === 'formAdmin.builder') {
      if (key === 'addStep') {
        return 'Add step';
      }
      if (key === 'step.addField') {
        return 'Add field';
      }
      if (key === 'step.removeStep') {
        return `Remove step ${String(values?.index ?? '')}`;
      }
      if (key === 'field.removeField') {
        return `Remove field ${String(values?.name ?? '')}`;
      }
      if (key === 'step.fieldsCount') {
        return `${String(values?.count ?? 0)} fields`;
      }
      return key;
    }

    if (namespace === 'common.labels') {
      return key;
    }

    if (namespace === 'common.states') {
      if (key === 'untitledPlain') {
        return 'Untitled';
      }
      return key;
    }

    if (namespace === 'pageEditor') {
      return key;
    }

    return key;
  },
}));

vi.mock('@mantine/hooks', () => ({
  useMediaQuery: () => false,
}));

vi.mock('@mantine/notifications', () => ({
  notifications: {
    show: vi.fn(),
  },
}));

vi.mock('@/components/core/Sortable', () => ({
  SortableGroups: ({ groups, renderGroup, renderItem }: any) => (
    <div data-testid="sortable-groups">
      {groups.map((group: any) => (
        <div key={group.id}>
          {renderGroup({
            group,
            isDropTarget: false,
            dragHandleProps: { attributes: {}, listeners: {} },
            children: (
              <div>
                {group.items.map((item: any) => (
                  <div key={item.id}>
                    {renderItem({
                      item,
                      groupId: group.id,
                      dragHandleProps: { attributes: {}, listeners: {} },
                    })}
                  </div>
                ))}
              </div>
            ),
          })}
        </div>
      ))}
    </div>
  ),
}));

vi.mock('@/features/form/FormRenderer', () => ({
  FormRenderer: () => <div data-testid="form-preview">Preview</div>,
}));

vi.mock('@/features/form/useFormValidationMessages', () => ({
  useFormValidationMessages: () => ({}),
}));

vi.mock('@/lib/form/build', () => ({
  buildForm: (schema: { id: string }) => buildFormMock(schema),
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() {
      return false;
    },
  }),
});

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

Object.defineProperty(globalThis, 'ResizeObserver', {
  writable: true,
  value: ResizeObserverMock,
});

const baseSchema = {
  id: 'schema-1',
  steps: [
    {
      id: 'step-1',
      title: 'Localized step',
      fields: [
        {
          id: 'field-1',
          key: 'message',
          label: 'Localized field',
          type: 'text' as const,
        },
      ],
    },
  ],
};

let container: HTMLDivElement | null = null;
let root: Root | null = null;

function render(mode: 'full' | 'translation' | 'readOnly') {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);

  act(() => {
    root?.render(
      <MantineProvider>
        <FormBuilder schema={baseSchema} mode={mode} title="Localized form" />
      </MantineProvider>,
    );
  });
}

beforeEach(() => {
  buildFormMock.mockReset();
  buildFormMock.mockImplementation((schema: { id: string }) => ({ id: schema.id }));
});

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  container?.remove();
  root = null;
  container = null;
});

describe('FormBuilder', () => {
  it('hides structure editing controls in translation mode', () => {
    render('translation');

    expect(document.body.textContent).not.toContain('Add step');
    expect(document.querySelector('[aria-label^="Remove step"]')).toBeNull();
    expect(document.querySelector('[aria-label^="Remove field"]')).toBeNull();
    expect(document.body.textContent).not.toContain('Add field');
  });

  it('shows structure editing controls in full mode', () => {
    render('full');

    expect(document.body.textContent).toContain('Add step');
    expect(document.querySelector('[aria-label^="Remove step"]')).not.toBeNull();
  });
});
