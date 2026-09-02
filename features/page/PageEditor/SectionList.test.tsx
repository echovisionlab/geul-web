// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PageSectionPreinsertDialog } from './SectionList';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock('@mantine/core', () => ({
  Group: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Modal: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Stack: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/core/Button', () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/core/DropdownMenu', () => ({
  DropdownMenu: Object.assign(({ children }: { children: React.ReactNode }) => <div>{children}</div>, {
    Target: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    Dropdown: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    Item: ({ children }: { children: React.ReactNode }) => <button type="button">{children}</button>,
  }),
}));

vi.mock('./SectionItem', () => ({ SectionItem: () => null }));

vi.mock('@/components/core/Input', () => ({
  TextInput: ({
    label: _label,
    error: _error,
    ...props
  }: React.InputHTMLAttributes<HTMLInputElement> & {
    label?: string;
    error?: React.ReactNode;
  }) => <input {...props} />,
  Select: ({
    data,
    value,
    onChange,
    ...props
  }: {
    data: readonly { value: string; label: string }[];
    value: string | null;
    onChange: (value: string | null) => void;
  } & Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'onChange' | 'value'>) => (
    <select {...props} value={value ?? ''} onChange={(event) => onChange(event.currentTarget.value || null)}>
      <option value="" />
      {data.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  ),
}));

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function renderDialog(
  type: 'external-video' | 'form',
  onCancel: () => void,
  onInsert: (type: 'external-video' | 'form', props: Record<string, unknown>) => void,
) {
  act(() => {
    root.render(
      <PageSectionPreinsertDialog
        type={type}
        title={type}
        formOptions={[{ value: 'form-published', label: 'Published Form' }]}
        formsLoading={false}
        onCancel={onCancel}
        onInsert={onInsert}
      />,
    );
  });
}

function changeInput(input: HTMLInputElement, value: string): void {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('Page section pre-insert configuration', () => {
  it('cancels without inserting a durable Block', () => {
    const onCancel = vi.fn();
    const onInsert = vi.fn();
    renderDialog('external-video', onCancel, onInsert);

    act(() => {
      container.querySelector<HTMLButtonElement>('[data-page-section-preinsert-cancel]')?.click();
    });

    expect(onCancel).toHaveBeenCalledOnce();
    expect(onInsert).not.toHaveBeenCalled();
  });

  it('inserts an external-video exactly once only after a valid HTTP(S) URI exists', () => {
    const onInsert = vi.fn();
    renderDialog('external-video', vi.fn(), onInsert);
    const input = container.querySelector<HTMLInputElement>('[data-page-section-preinsert-url]')!;
    const confirm = container.querySelector<HTMLButtonElement>('[data-page-section-preinsert-confirm]')!;

    expect(confirm.disabled).toBe(true);
    act(() => {
      changeInput(input, 'not-a-uri');
    });
    expect(confirm.disabled).toBe(true);
    expect(onInsert).not.toHaveBeenCalled();

    act(() => {
      changeInput(input, ' https://video.example/watch/1 ');
    });
    expect(confirm.disabled).toBe(false);
    act(() => confirm.click());

    expect(onInsert).toHaveBeenCalledOnce();
    expect(onInsert).toHaveBeenCalledWith('external-video', { url: 'https://video.example/watch/1' });
  });

  it('inserts a Form exactly once only after a published Form is selected', () => {
    const onInsert = vi.fn();
    renderDialog('form', vi.fn(), onInsert);
    const select = container.querySelector<HTMLSelectElement>('[data-page-section-preinsert-form]')!;
    const confirm = container.querySelector<HTMLButtonElement>('[data-page-section-preinsert-confirm]')!;

    expect(confirm.disabled).toBe(true);
    act(() => {
      select.value = 'form-published';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(confirm.disabled).toBe(false);
    act(() => confirm.click());

    expect(onInsert).toHaveBeenCalledOnce();
    expect(onInsert).toHaveBeenCalledWith('form', { formId: 'form-published' });
  });
});
