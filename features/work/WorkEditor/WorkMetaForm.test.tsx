// @vitest-environment jsdom

import { DesignSystemProvider } from '@/lib/providers/DesignSystemProvider';
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { STRING_LIST_SPLIT_CHARS } from './stringList';
import { WorkMetaForm } from './WorkMetaForm';

const tagsInputMock = vi.fn();

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock('@/components/core/Input', () => ({
  MonthPickerInput: ({ id, label }: { id?: string; label?: string }) => <div data-testid={id}>{label}</div>,
  NativeSelect: () => null,
  NumberInput: () => null,
  Switch: () => null,
  TagsInput: ({
    splitChars,
    value,
    onChange,
    label,
    id,
    placeholder,
  }: {
    splitChars?: string[];
    value?: string[];
    onChange?: (value: string[]) => void;
    label?: string;
    id?: string;
    placeholder?: string;
  }) => {
    tagsInputMock({ splitChars, value, label, id, placeholder, onChange });
    return (
      <button
        type="button"
        data-testid="technologies-tags-input"
        onClick={() => onChange?.(['React', ' Next.js ', 'react', '', 'TypeScript'])}
      >
        technologies
      </button>
    );
  },
  TextInput: ({
    value,
    onChange,
    placeholder,
    id,
  }: {
    value?: string;
    onChange?: (event: { currentTarget: { value: string } }) => void;
    placeholder?: string;
    id?: string;
  }) => (
    <input
      id={id}
      value={value}
      placeholder={placeholder}
      onChange={(event) => onChange?.({ currentTarget: { value: event.currentTarget.value } })}
    />
  ),
}));

vi.mock('@/components/core/Section', () => ({
  SectionCard: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SectionHeader: ({ title }: { title: string }) => <div>{title}</div>,
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

describe('WorkMetaForm', () => {
  let container: HTMLDivElement;
  let root: Root | null = null;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    tagsInputMock.mockClear();
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    root = null;
    container.remove();
  });

  it('configures technologies input to split on commas, newlines, and spaces', async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(
        <DesignSystemProvider forceColorScheme="light">
          <WorkMetaForm
            workId="work-1"
            type="portfolio"
            year={2026}
            month={4}
            untilYear={null}
            untilMonth={null}
            isPresent
            metadata={{ technologies: ['React', 'Next.js'] }}
            featured={false}
            onChange={() => {}}
          />
        </DesignSystemProvider>,
      );
    });

    const lastCall = tagsInputMock.mock.calls.at(-1)?.[0];
    expect(lastCall?.splitChars).toEqual(STRING_LIST_SPLIT_CHARS);
    expect(lastCall?.value).toEqual(['React', 'Next.js']);
  });

  it('normalizes technologies when the tags input changes', async () => {
    const onChange = vi.fn();

    await act(async () => {
      root = createRoot(container);
      root.render(
        <DesignSystemProvider forceColorScheme="light">
          <WorkMetaForm
            workId="work-2"
            type="portfolio"
            year={2026}
            month={4}
            untilYear={null}
            untilMonth={null}
            isPresent
            metadata={{ technologies: ['React'] }}
            featured={false}
            onChange={onChange}
          />
        </DesignSystemProvider>,
      );
    });

    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-testid="technologies-tags-input"]')?.click();
    });

    expect(onChange).toHaveBeenCalledWith({
      metadata: {
        technologies: ['React', 'Next.js', 'TypeScript'],
      },
    });
  });
});
