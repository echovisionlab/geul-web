// @vitest-environment jsdom

import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MenuItem } from './menu-editor-model';
import { SortableMenuItem } from './MenuItemsEditor';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: ({ queryKey }: { queryKey: unknown[] }) => ({
    data:
      queryKey[2] === 'category'
        ? [{ id: 'category-1', name: 'Category one', slug: 'category-one' }]
        : [{ id: 'page-1', name: 'Page one', slug: 'page-one' }],
  }),
}));

vi.mock('@/lib/actions/menu', () => ({ getMenuAvailableTargetsAction: vi.fn() }));

vi.mock('@dnd-kit/sortable', () => ({
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: () => {},
    transform: null,
    transition: undefined,
    isDragging: false,
  }),
}));

vi.mock('@mantine/core', () => ({
  Collapse: ({ children, expanded }: { children: ReactNode; expanded: boolean }) =>
    expanded ? <div>{children}</div> : null,
  Divider: () => null,
  Group: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Paper: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Stack: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Text: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));

vi.mock('@/components/core/Button', () => ({
  Button: ({ children, disabled, onClick }: { children: ReactNode; disabled?: boolean; onClick?: () => void }) => (
    <button type="button" disabled={disabled} onClick={onClick}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/core/Badge', () => ({
  LabelBadge: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));

vi.mock('@/components/core/IconButton', () => ({
  IconButton: ({
    children,
    disabled,
    onClick,
    'aria-label': ariaLabel,
  }: {
    children: ReactNode;
    disabled?: boolean;
    onClick?: () => void;
    'aria-label'?: string;
  }) => (
    <button type="button" aria-label={ariaLabel} disabled={disabled} onClick={onClick}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/core/Input', () => ({
  Checkbox: ({
    checked,
    disabled,
    label,
    onChange,
  }: {
    checked?: boolean;
    disabled?: boolean;
    label?: string;
    onChange?: (event: { currentTarget: { checked: boolean } }) => void;
  }) => (
    <label>
      {label}
      <input
        type="checkbox"
        aria-label={label}
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange?.({ currentTarget: { checked: event.currentTarget.checked } })}
      />
    </label>
  ),
  Select: ({
    data,
    disabled,
    label,
    onChange,
    placeholder,
    value,
  }: {
    data: Array<{ value: string; label: string }>;
    disabled?: boolean;
    label?: string;
    onChange?: (value: string | null) => void;
    placeholder?: string;
    value?: string | null;
  }) => {
    const testId = data.some((option) => option.value === 'custom')
      ? 'link-type-select'
      : data.some((option) => option.value === 'fixed_locale')
        ? 'localization-mode-select'
        : label === 'labels.language'
          ? 'fixed-locale-select'
          : 'target-select';
    return (
      <label>
        {label ?? placeholder ?? testId}
        <select
          aria-label={label ?? placeholder ?? testId}
          data-testid={testId}
          disabled={disabled}
          value={value ?? ''}
          onChange={(event) => onChange?.(event.currentTarget.value || null)}
        >
          <option value="">Select</option>
          {data.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    );
  },
  TextInput: ({
    disabled,
    label,
    onChange,
    placeholder,
    value,
  }: {
    disabled?: boolean;
    label?: string;
    onChange?: (event: { currentTarget: { value: string } }) => void;
    placeholder?: string;
    value?: string;
  }) => (
    <label>
      {label ?? placeholder}
      <input
        aria-label={label ?? placeholder}
        data-testid={placeholder}
        disabled={disabled}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange?.({ currentTarget: { value: event.currentTarget.value } })}
      />
    </label>
  ),
}));

vi.mock('./VisibilityEditor', () => ({
  getVisibilityLabel: (visibility?: { mode: string }) => visibility?.mode ?? 'all',
  VisibilityEditor: ({ value, onChange }: { value: { mode: string }; onChange: (value: { mode: string }) => void }) => (
    <button
      type="button"
      data-testid="visibility-editor"
      onClick={() => onChange({ mode: value.mode === 'authenticated' ? 'guest' : 'authenticated' })}
    >
      {value.mode}
    </button>
  ),
}));

type TestProps = {
  item: MenuItem;
  onUpdate: (item: MenuItem) => void;
  onUpdateChild: (parentId: string, child: MenuItem) => void;
};

function TestSubject({ item, onUpdate, onUpdateChild }: TestProps) {
  return (
    <SortableMenuItem
      item={item}
      sourceLocale="en"
      onUpdate={onUpdate}
      onDelete={() => {}}
      onUpdateChild={onUpdateChild}
      allowChildren
      editable
    />
  );
}

function setInputValue(element: HTMLInputElement | HTMLSelectElement, value: string) {
  const prototype = element instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
  setter?.call(element, value);
  element.dispatchEvent(new Event(element instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
}

describe('SortableMenuItem editing', () => {
  let container: HTMLDivElement;
  let root: Root | null = null;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    act(() => root?.unmount());
    root = null;
    container.remove();
  });

  const render = async (props: TestProps) => {
    await act(async () => {
      root ??= createRoot(container);
      root.render(<TestSubject {...props} />);
    });
  };

  const click = async (selector: string) => {
    await act(async () => {
      container.querySelector<HTMLButtonElement>(selector)?.click();
    });
  };

  const clickAt = async (selector: string, index: number) => {
    await act(async () => {
      container.querySelectorAll<HTMLButtonElement>(selector).item(index)?.click();
    });
  };

  const clickText = async (text: string) => {
    const button = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(
      (candidate) => candidate.textContent === text,
    );
    await act(async () => button?.click());
  };

  it('saves a root label edit over the latest peer URL, visibility, and tab setting', async () => {
    const onUpdate = vi.fn();
    const item: MenuItem = { id: 'root', label: 'Original', linkType: 'custom', url: '/original' };
    const props = { item, onUpdate, onUpdateChild: vi.fn() };
    await render(props);
    await click('button[aria-label="actions.edit"]');

    const label = container.querySelector<HTMLInputElement>('[data-testid="labelPlaceholder"]');
    expect(label).not.toBeNull();
    await act(async () => setInputValue(label!, 'Local label'));

    const latestItem: MenuItem = {
      ...item,
      label: 'Peer label',
      url: '/peer-url',
      visibility: { mode: 'authenticated' },
      openInNewTab: true,
    };
    await render({ ...props, item: latestItem });

    expect(container.querySelector<HTMLInputElement>('[data-testid="labelPlaceholder"]')?.value).toBe('Local label');
    expect(container.querySelector<HTMLInputElement>('[data-testid="urlPlaceholder"]')?.value).toBe('/peer-url');
    expect(container.querySelector('[data-testid="visibility-editor"]')?.textContent).toBe('authenticated');
    expect(container.querySelector<HTMLInputElement>('input[type="checkbox"]')?.checked).toBe(true);

    await clickText('actions.save');

    expect(onUpdate).toHaveBeenCalledWith({
      ...latestItem,
      label: 'Local label',
    });
  });

  it('keeps nested local link and localization groups coherent while adopting untouched peer fields', async () => {
    const onUpdateChild = vi.fn();
    const parent: MenuItem = {
      id: 'parent',
      label: 'Parent',
      linkType: 'custom',
      url: '/parent',
      children: [{ id: 'child', label: 'Child', linkType: 'page', targetId: 'page-1', targetSlug: 'page-one' }],
    };
    const props = { item: parent, onUpdate: vi.fn(), onUpdateChild };
    await render(props);
    await click('button[aria-label="Expand submenu"]');
    await clickAt('button[aria-label="actions.edit"]', 1);

    const linkType = container.querySelector<HTMLSelectElement>('[data-testid="link-type-select"]');
    expect(linkType).not.toBeNull();
    await act(async () => setInputValue(linkType!, 'custom'));
    const url = container.querySelector<HTMLInputElement>('[data-testid="urlPlaceholder"]');
    expect(url).not.toBeNull();
    await act(async () => setInputValue(url!, '/local-url'));

    const localizationMode = container.querySelector<HTMLSelectElement>('[data-testid="localization-mode-select"]');
    expect(localizationMode).not.toBeNull();
    await act(async () => setInputValue(localizationMode!, 'fixed_locale'));
    const fixedLocale = container.querySelector<HTMLSelectElement>('[data-testid="fixed-locale-select"]');
    expect(fixedLocale).not.toBeNull();
    await act(async () => setInputValue(fixedLocale!, 'ko'));
    await click('[data-testid="visibility-editor"]');

    const latestParent: MenuItem = {
      ...parent,
      children: [
        {
          id: 'child',
          label: 'Peer child label',
          linkType: 'custom',
          url: '/peer-url',
          localizationMode: 'fixed_locale',
          fixedLocale: 'en',
          openInNewTab: true,
          visibility: { mode: 'guest' },
        },
      ],
    };
    await render({ ...props, item: latestParent });

    expect(container.querySelector<HTMLInputElement>('[data-testid="labelPlaceholder"]')?.value).toBe(
      'Peer child label',
    );
    expect(container.querySelector<HTMLInputElement>('[data-testid="urlPlaceholder"]')?.value).toBe('/local-url');
    expect(container.querySelector<HTMLSelectElement>('[data-testid="fixed-locale-select"]')?.value).toBe('ko');
    expect(container.querySelector('[data-testid="visibility-editor"]')?.textContent).toBe('authenticated');
    expect(container.querySelector<HTMLInputElement>('input[type="checkbox"]')?.checked).toBe(true);

    await clickText('actions.save');

    expect(onUpdateChild).toHaveBeenCalledWith('parent', {
      ...latestParent.children![0],
      url: '/local-url',
      targetId: undefined,
      targetSlug: undefined,
      localizationMode: 'fixed_locale',
      fixedLocale: 'ko',
      visibility: { mode: 'authenticated' },
    });
  });

  it('adopts a peer label when that field has not been edited', async () => {
    const onUpdate = vi.fn();
    const item: MenuItem = { id: 'root', label: 'Original', linkType: 'custom', url: '/original' };
    const props = { item, onUpdate, onUpdateChild: vi.fn() };
    await render(props);
    await click('button[aria-label="actions.edit"]');

    const latestItem = { ...item, label: 'Peer label' };
    await render({ ...props, item: latestItem });
    expect(container.querySelector<HTMLInputElement>('[data-testid="labelPlaceholder"]')?.value).toBe('Peer label');

    await clickText('actions.save');

    expect(onUpdate).toHaveBeenCalledWith(latestItem);
  });
});
