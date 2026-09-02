// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { notifications } from '@mantine/notifications';
import type { ReleaseCreditItem } from '@/lib/types/release/model';
import { TestProviders } from '@/test/TestProviders';
import { ReleaseCreditsSection } from './ReleaseCreditsSection';

const setReleaseCreditsActionMock = vi.fn();
let queryArtistsData: Array<{ id: string; name: string; slug: string | null }> | undefined;
let queryUsersData: { data: Array<{ id: string; name: string | null }> } | undefined;

vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  KeyboardSensor: class {},
  PointerSensor: class {},
  closestCenter: vi.fn(),
  useSensor: vi.fn(() => ({})),
  useSensors: vi.fn((...sensors: unknown[]) => sensors),
}));

vi.mock('@dnd-kit/sortable', () => ({
  SortableContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  arrayMove: <T,>(items: T[], from: number, to: number) => {
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    return next;
  },
  sortableKeyboardCoordinates: vi.fn(),
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: undefined,
    isDragging: false,
  }),
  verticalListSortingStrategy: {},
}));

vi.mock('@dnd-kit/utilities', () => ({
  CSS: {
    Transform: {
      toString: () => '',
    },
  },
}));

vi.mock('@tanstack/react-query', () => ({
  useMutation: ({
    mutationFn,
    onSuccess,
  }: {
    mutationFn: (vars: any) => Promise<any>;
    onSuccess?: (result: any) => void;
  }) => ({
    mutate: async (vars: any) => {
      const result = await mutationFn(vars);
      onSuccess?.(result);
      return result;
    },
    isPending: false,
  }),
  useQuery: ({ queryKey }: { queryKey: unknown[] }) => ({
    data:
      Array.isArray(queryKey) && queryKey[0] === 'artist'
        ? queryArtistsData
        : Array.isArray(queryKey) && queryKey[0] === 'member'
          ? queryUsersData
          : undefined,
  }),
}));

vi.mock('@mantine/core', async () => {
  const actual = await vi.importActual<typeof import('@mantine/core')>('@mantine/core');
  const reactDom = await vi.importActual<typeof import('react-dom')>('react-dom');
  return {
    ...actual,
    Modal: ({ opened, title, children }: { opened: boolean; title?: React.ReactNode; children: React.ReactNode }) =>
      opened
        ? reactDom.createPortal(
            <div data-testid="modal">
              <div>{title}</div>
              {children}
            </div>,
            document.body,
          )
        : null,
    SegmentedControl: ({
      id,
      value,
      onChange,
      data,
    }: {
      id?: string;
      value: string;
      onChange?: (value: string) => void;
      data: Array<{ value: string; label: React.ReactNode }>;
    }) => (
      <div id={id}>
        {data.map((item) => (
          <button
            key={item.value}
            type="button"
            data-active={item.value === value ? 'true' : 'false'}
            onClick={() => onChange?.(item.value)}
          >
            {item.label}
          </button>
        ))}
      </div>
    ),
  };
});

vi.mock('@mantine/notifications', () => ({
  notifications: {
    show: vi.fn(),
  },
}));

vi.mock('@/components/core/Button', () => ({
  Button: ({
    children,
    onClick,
    disabled,
    id,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    id?: string;
  }) => (
    <button id={id} type="button" onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/core/IconButton', () => ({
  IconButton: ({
    children,
    onClick,
    tone,
    ...props
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    tone?: string;
    [key: string]: unknown;
  }) => (
    <button type="button" onClick={onClick} data-tone={tone ?? ''} {...props}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/core/Input', () => ({
  SegmentedControl: ({
    id,
    value,
    onChange,
    data,
  }: {
    id?: string;
    value: string;
    onChange?: (value: string) => void;
    data: Array<{ value: string; label: React.ReactNode }>;
  }) => (
    <div id={id}>
      {data.map((item) => (
        <button
          key={item.value}
          type="button"
          data-active={item.value === value ? 'true' : 'false'}
          onClick={() => onChange?.(item.value)}
        >
          {item.label}
        </button>
      ))}
    </div>
  ),
  Select: ({
    id,
    value,
    data,
    onChange,
    placeholder,
  }: {
    id?: string;
    value?: string | null;
    data?: Array<{ value: string; label: string }>;
    onChange?: (value: string | null) => void;
    placeholder?: string;
  }) => (
    <select id={id} value={value ?? ''} onChange={(e) => onChange?.(e.currentTarget.value || null)}>
      <option value="">{placeholder ?? 'Select'}</option>
      {(data ?? []).map((item) => (
        <option key={item.value} value={item.value}>
          {item.label}
        </option>
      ))}
    </select>
  ),
  TextInput: ({
    id,
    value,
    onChange,
  }: {
    id?: string;
    value?: string;
    onChange?: (event: { currentTarget: { value: string } }) => void;
  }) => (
    <input
      id={id}
      value={value ?? ''}
      onChange={(e) => onChange?.({ currentTarget: { value: e.currentTarget.value } })}
    />
  ),
  Textarea: ({
    id,
    value,
    onChange,
    disabled,
  }: {
    id?: string;
    value?: string;
    onChange?: (event: { currentTarget: { value: string } }) => void;
    disabled?: boolean;
  }) => (
    <textarea
      id={id}
      value={value ?? ''}
      disabled={disabled}
      onChange={(e) => onChange?.({ currentTarget: { value: e.currentTarget.value } })}
    />
  ),
}));

vi.mock('@/components/core/Section', () => ({
  SectionCard: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SectionHeader: ({ title, actions }: { title: React.ReactNode; actions?: React.ReactNode }) => (
    <div>
      <div>{title}</div>
      {actions}
    </div>
  ),
}));

vi.mock('@/lib/actions/artist', () => ({
  listArtistsAction: vi.fn(),
}));

vi.mock('@/lib/actions/user', () => ({
  listUsersAdminAction: vi.fn(),
}));

vi.mock('@/lib/actions/release', () => ({
  setReleaseCreditsAction: (...args: any[]) => setReleaseCreditsActionMock(...args),
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

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

Object.defineProperty(globalThis, 'ResizeObserver', {
  writable: true,
  value: ResizeObserverMock,
});

let container: HTMLDivElement | null = null;
let root: Root | null = null;

function render(node: React.ReactNode) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);

  act(() => {
    root?.render(<TestProviders>{node}</TestProviders>);
  });
}

async function flushUpdates() {
  await act(async () => {
    await Promise.resolve();
  });
}

async function clickElement(element: Element | null | undefined) {
  expect(element).not.toBeNull();
  expect(element).not.toBeUndefined();

  act(() => {
    element?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  });

  await flushUpdates();
}

async function changeInput(element: HTMLInputElement | HTMLTextAreaElement, value: string) {
  act(() => {
    const prototype =
      element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const valueSetter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
    valueSetter?.call(element, value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  });

  await flushUpdates();
}

function findLastButtonByText(label: string): HTMLButtonElement | undefined {
  return Array.from(document.querySelectorAll('button'))
    .reverse()
    .find((button): button is HTMLButtonElement => button.textContent === label);
}

function findEnabledLastButtonByText(label: string): HTMLButtonElement | undefined {
  return Array.from(document.querySelectorAll('button'))
    .reverse()
    .find((button): button is HTMLButtonElement => button.textContent === label && !button.disabled);
}

beforeEach(() => {
  queryArtistsData = [{ id: 'artist-1', name: 'Artist One', slug: 'artist-one' }];
  queryUsersData = { data: [{ id: 'member-1', name: 'User One' }] };
  setReleaseCreditsActionMock.mockReset();
  setReleaseCreditsActionMock.mockResolvedValue({ success: true });
});

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  container?.remove();
  container = null;
  root = null;
  vi.restoreAllMocks();
});

describe('ReleaseCreditsSection', () => {
  it('adds a text credit and writes its localized note separately', async () => {
    const onCreditsChange = vi.fn();
    const onCreditNoteChange = vi.fn();
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue('credit-new');

    render(
      <ReleaseCreditsSection
        releaseId="release-1"
        idPrefix="release-credits"
        credits={[]}
        creditNotes={{}}
        canEdit
        canEditNotes
        onCreditsChange={onCreditsChange}
        onCreditNoteChange={onCreditNoteChange}
      />,
    );

    await clickElement(document.getElementById('release-credits-add-button'));
    await clickElement(findLastButtonByText('Text'));

    const creditedNameInput = document.getElementById('release-credits-credited-name') as HTMLInputElement | null;
    const roleInput = document.getElementById('release-credits-role') as HTMLInputElement | null;
    const noteInput = document.getElementById('release-credits-note') as HTMLTextAreaElement | null;

    expect(creditedNameInput).not.toBeNull();
    expect(roleInput).not.toBeNull();
    expect(noteInput).not.toBeNull();

    await changeInput(creditedNameInput!, 'Sleeve notes');
    await changeInput(roleInput!, 'Writer');
    await changeInput(noteInput!, 'Refers to Blue Circuit and Midnight Radio');

    const modalAddButton = findEnabledLastButtonByText('Add');
    expect(modalAddButton?.disabled).toBe(false);
    await clickElement(modalAddButton);

    expect(onCreditsChange).toHaveBeenCalledWith([
      {
        id: 'credit-new',
        credit_type: 'text',
        artist_id: null,
        artist_name: null,
        artist_slug: null,
        member_id: null,
        member_name: null,
        credited_name: 'Sleeve notes',
        credit_role: 'Writer',
        sort_order: 0,
      },
    ] satisfies ReleaseCreditItem[]);
    expect(setReleaseCreditsActionMock).toHaveBeenCalledWith('release-1', [
      {
        id: 'credit-new',
        artistId: null,
        memberId: null,
        creditedName: 'Sleeve notes',
        creditRole: 'Writer',
        sortOrder: 0,
      },
    ]);
    expect(onCreditNoteChange).toHaveBeenCalledWith('credit-new', 'Refers to Blue Circuit and Midnight Radio');
    expect(notifications.show).toHaveBeenCalled();
  });

  it('updates the note for an existing credit through the note modal', async () => {
    const onCreditsChange = vi.fn();
    const onCreditNoteChange = vi.fn();
    const credits: ReleaseCreditItem[] = [
      {
        id: 'credit-1',
        credit_type: 'artist',
        artist_id: 'artist-1',
        artist_name: 'Artist One',
        artist_slug: 'artist-one',
        member_id: null,
        member_name: null,
        credited_name: null,
        credit_role: 'Producer',
        sort_order: 0,
      },
    ];

    render(
      <ReleaseCreditsSection
        releaseId="release-1"
        idPrefix="release-credits"
        credits={credits}
        creditNotes={{ 'credit-1': 'Initial note' }}
        canEdit
        canEditNotes
        onCreditsChange={onCreditsChange}
        onCreditNoteChange={onCreditNoteChange}
      />,
    );

    await clickElement(findLastButtonByText('Edit'));

    const noteInput = document.getElementById('release-credits-note-credit-1') as HTMLTextAreaElement | null;
    expect(noteInput).not.toBeNull();

    await changeInput(noteInput!, 'Updated note mentioning Blue Circuit');
    await clickElement(findLastButtonByText('Save'));

    expect(onCreditNoteChange).toHaveBeenCalledWith('credit-1', 'Updated note mentioning Blue Circuit');
    expect(onCreditsChange).not.toHaveBeenCalled();
  });

  it('clears note state when removing a credit', async () => {
    const onCreditsChange = vi.fn();
    const onCreditNoteChange = vi.fn();
    const credits: ReleaseCreditItem[] = [
      {
        id: 'credit-1',
        credit_type: 'artist',
        artist_id: 'artist-1',
        artist_name: 'Artist One',
        artist_slug: 'artist-one',
        member_id: null,
        member_name: null,
        credited_name: null,
        credit_role: 'Producer',
        sort_order: 0,
      },
    ];

    render(
      <ReleaseCreditsSection
        releaseId="release-1"
        credits={credits}
        creditNotes={{ 'credit-1': 'Localized note' }}
        canEdit
        canEditNotes
        onCreditsChange={onCreditsChange}
        onCreditNoteChange={onCreditNoteChange}
      />,
    );

    const removeButton = document.querySelector('button[data-tone="danger"]');
    await clickElement(removeButton);

    expect(onCreditsChange).toHaveBeenCalledWith([]);
    expect(setReleaseCreditsActionMock).toHaveBeenCalledWith('release-1', []);
    expect(onCreditNoteChange).toHaveBeenCalledWith('credit-1', '');
  });

  it('keeps credit mutations disabled while translation authoring is locked', async () => {
    const onCreditsChange = vi.fn();
    const onCreditNoteChange = vi.fn();
    const credits: ReleaseCreditItem[] = [
      {
        id: 'credit-1',
        credit_type: 'text',
        artist_id: null,
        artist_name: null,
        artist_slug: null,
        member_id: null,
        member_name: null,
        credited_name: 'Sleeve notes',
        credit_role: 'Writer',
        sort_order: 0,
      },
    ];

    render(
      <ReleaseCreditsSection
        releaseId="release-1"
        idPrefix="release-credits"
        credits={credits}
        creditNotes={{ 'credit-1': 'Localized note' }}
        canEdit={false}
        canEditNotes={false}
        onCreditsChange={onCreditsChange}
        onCreditNoteChange={onCreditNoteChange}
      />,
    );

    const addButton = document.getElementById('release-credits-add-button') as HTMLButtonElement | null;
    const removeButton = document.querySelector<HTMLButtonElement>('button[data-tone="danger"]');

    expect(addButton?.disabled).toBe(true);
    expect(removeButton?.disabled).toBe(true);
    await clickElement(addButton);
    await clickElement(removeButton);
    expect(onCreditsChange).not.toHaveBeenCalled();
    expect(onCreditNoteChange).not.toHaveBeenCalled();
    expect(setReleaseCreditsActionMock).not.toHaveBeenCalled();
  });
});
