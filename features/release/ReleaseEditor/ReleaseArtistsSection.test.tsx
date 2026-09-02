// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { notifications } from '@mantine/notifications';
import type { ReleaseArtistItem } from '@/lib/types/release/model';
import { TestProviders } from '@/test/TestProviders';
import { ReleaseArtistsSection } from './ReleaseArtistsSection';

const setReleaseArtistsActionMock = vi.fn();
let queryArtistsData: Array<{ id: string; name: string; slug: string | null }> | undefined;
let latestDragEndHandler: ((event: { active: { id: string }; over: { id: string } | null }) => void) | null = null;

vi.mock('@dnd-kit/core', () => ({
  DndContext: ({
    children,
    onDragEnd,
  }: {
    children: React.ReactNode;
    onDragEnd?: (event: { active: { id: string }; over: { id: string } | null }) => void;
  }) => {
    latestDragEndHandler = onDragEnd ?? null;
    return <>{children}</>;
  },
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
    data: Array.isArray(queryKey) && queryKey[0] === 'artist' ? queryArtistsData : undefined,
  }),
}));

vi.mock('@mantine/core', async () => {
  const actual = await vi.importActual<typeof import('@mantine/core')>('@mantine/core');
  return {
    ...actual,
    Modal: ({ opened, title, children }: { opened: boolean; title?: React.ReactNode; children: React.ReactNode }) =>
      opened ? (
        <div data-testid="modal">
          <div>{title}</div>
          {children}
        </div>
      ) : null,
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

vi.mock('@/lib/actions/release', () => ({
  setReleaseArtistsAction: (...args: any[]) => setReleaseArtistsActionMock(...args),
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

async function changeSelect(element: HTMLSelectElement, value: string) {
  act(() => {
    element.value = value;
    element.dispatchEvent(new Event('change', { bubbles: true }));
  });

  await flushUpdates();
}

beforeEach(() => {
  queryArtistsData = [
    { id: 'artist-1', name: 'Artist One', slug: 'artist-one' },
    { id: 'artist-2', name: 'Artist Two', slug: 'artist-two' },
  ];
  latestDragEndHandler = null;
  setReleaseArtistsActionMock.mockResolvedValue({ success: true });
});

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  container?.remove();
  container = null;
  root = null;
  vi.clearAllMocks();
});

describe('ReleaseArtistsSection', () => {
  it('adds a release artist and persists normalized sort order', async () => {
    const onArtistsChange = vi.fn();

    render(
      <ReleaseArtistsSection
        releaseId="release-1"
        idPrefix="release-artists"
        artists={[]}
        onArtistsChange={onArtistsChange}
      />,
    );

    await clickElement(document.getElementById('release-artists-add-button'));

    const select = document.getElementById('release-artists-select') as HTMLSelectElement | null;
    expect(select).not.toBeNull();
    await changeSelect(select!, 'artist-1');

    const addButton = Array.from(document.querySelectorAll('button')).find((button) => button.textContent === 'Add');
    await clickElement(addButton);

    expect(onArtistsChange).toHaveBeenCalledWith([
      {
        artist_id: 'artist-1',
        artist_name: 'Artist One',
        artist_slug: 'artist-one',
        sort_order: 0,
      },
    ] satisfies ReleaseArtistItem[]);
    expect(setReleaseArtistsActionMock).toHaveBeenCalledWith('release-1', [{ artistId: 'artist-1', sortOrder: 0 }]);
    expect(notifications.show).toHaveBeenCalled();
  });

  it('reorders artists and rewrites sort orders before persisting', async () => {
    const onArtistsChange = vi.fn();
    const artists: ReleaseArtistItem[] = [
      {
        artist_id: 'artist-1',
        artist_name: 'Artist One',
        artist_slug: 'artist-one',
        sort_order: 0,
      },
      {
        artist_id: 'artist-2',
        artist_name: 'Artist Two',
        artist_slug: 'artist-two',
        sort_order: 1,
      },
    ];

    render(<ReleaseArtistsSection releaseId="release-1" artists={artists} onArtistsChange={onArtistsChange} />);

    act(() => {
      latestDragEndHandler?.({
        active: { id: 'artist-2' },
        over: { id: 'artist-1' },
      });
    });
    await flushUpdates();

    expect(onArtistsChange).toHaveBeenCalledWith([
      {
        artist_id: 'artist-2',
        artist_name: 'Artist Two',
        artist_slug: 'artist-two',
        sort_order: 0,
      },
      {
        artist_id: 'artist-1',
        artist_name: 'Artist One',
        artist_slug: 'artist-one',
        sort_order: 1,
      },
    ] satisfies ReleaseArtistItem[]);
    expect(setReleaseArtistsActionMock).toHaveBeenCalledWith('release-1', [
      { artistId: 'artist-2', sortOrder: 0 },
      { artistId: 'artist-1', sortOrder: 1 },
    ]);
  });
});
