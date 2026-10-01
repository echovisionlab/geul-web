// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReleaseTrackItem } from '@/lib/collab/schemas/release-fields.schema';
import { TrackCreditsEditorSection } from './TrackCreditsEditorSection';

const mocks = vi.hoisted(() => ({
  setTrackCreditsAction: vi.fn(),
}));

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
vi.mock('@mantine/hooks', () => ({ useMediaQuery: () => false }));
vi.mock('@mantine/notifications', () => ({ notifications: { show: vi.fn() } }));
vi.mock('@tanstack/react-query', () => ({
  useMutation: ({ mutationFn }: { mutationFn: (value: unknown) => Promise<unknown> }) => ({
    mutate: async (value: unknown, options?: { onSuccess?: (result: unknown) => void }) => {
      const result = await mutationFn(value);
      options?.onSuccess?.(result);
    },
    isPending: false,
  }),
  useQuery: ({ queryKey }: { queryKey: unknown[] }) => ({
    data: queryKey[0] === 'artist' ? [] : { data: [] },
  }),
}));
vi.mock('@/lib/actions/track', () => ({ setTrackCreditsAction: mocks.setTrackCreditsAction }));
vi.mock('@/lib/actions/artist', () => ({ listArtistsAction: vi.fn() }));
vi.mock('@/lib/actions/user', () => ({ listUsersAdminAction: vi.fn() }));
vi.mock('@/components/core/Button', () => ({
  Button: ({
    children,
    onClick,
    disabled,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
  }) => (
    <button type="button" onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
}));
vi.mock('@/components/core/IconButton', () => ({
  IconButton: ({
    children,
    onClick,
    ...props
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    [key: string]: unknown;
  }) => (
    <button type="button" onClick={onClick} {...props}>
      {children}
    </button>
  ),
}));
vi.mock('@/components/core/Input', () => ({
  SegmentedControl: ({
    data,
    onChange,
  }: {
    data: Array<{ value: string; label: React.ReactNode }>;
    onChange?: (value: string) => void;
  }) => (
    <div>
      {data.map((item) => (
        <button key={item.value} data-segment={item.value} type="button" onClick={() => onChange?.(item.value)}>
          {item.label}
        </button>
      ))}
    </div>
  ),
  Select: () => null,
  TextInput: ({
    id,
    value,
    onChange,
  }: {
    id?: string;
    value: string;
    onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
  }) => <input id={id} value={value} onChange={onChange} />,
}));
vi.mock('@mantine/core', () => ({
  Box: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Divider: () => <hr />,
  Group: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Stack: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Table: Object.assign(({ children }: { children: React.ReactNode }) => <table>{children}</table>, {
    Thead: ({ children }: { children: React.ReactNode }) => <thead>{children}</thead>,
    Tbody: ({ children }: { children: React.ReactNode }) => <tbody>{children}</tbody>,
    Tr: ({ children }: { children: React.ReactNode }) => <tr>{children}</tr>,
    Th: ({ children }: { children?: React.ReactNode }) => <th>{children}</th>,
    Td: ({ children }: { children?: React.ReactNode }) => <td>{children}</td>,
  }),
  Text: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement | null = null;
let root: Root | null = null;

function render(credits: ReleaseTrackItem['credits'], onCreditsChange = vi.fn()) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root?.render(
      <TrackCreditsEditorSection
        releaseId="release-1"
        idPrefix="track"
        trackId="track-1"
        credits={credits}
        onCreditsChange={onCreditsChange}
      />,
    );
  });
  return onCreditsChange;
}

async function click(element: Element) {
  await act(async () => {
    element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await Promise.resolve();
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.setTrackCreditsAction.mockResolvedValue({ success: true });
});

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  container = null;
  root = null;
});

describe('TrackCreditsEditorSection', () => {
  it('sends the visible stable-credit snapshot when adding a credit', async () => {
    const credits: ReleaseTrackItem['credits'] = [
      {
        id: 'credit-1',
        credit_type: 'text',
        artist_id: null,
        artist_name: null,
        artist_slug: null,
        member_id: null,
        member_name: null,
        credited_name: 'Existing',
        credit_role: 'Writer',
        sort_order: 0,
      },
    ];
    const onCreditsChange = render(credits);

    await click(document.querySelector('[data-segment="text"]')!);
    const nameInput = document.getElementById('track-track-credit-name-track-1') as HTMLInputElement;
    await act(async () => {
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set?.call(nameInput, 'New credit');
      nameInput.dispatchEvent(new Event('input', { bubbles: true }));
      nameInput.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await click(
      Array.from(document.querySelectorAll('button')).find((button) => button.textContent === 'actions.add')!,
    );

    expect(mocks.setTrackCreditsAction).toHaveBeenCalledWith(
      'track-1',
      expect.arrayContaining([expect.objectContaining({ credited_name: 'New credit' })]),
      [expect.objectContaining({ id: 'credit-1', credited_name: 'Existing', credit_role: 'Writer' })],
    );
    expect(onCreditsChange).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ id: 'credit-1' }),
        expect.objectContaining({ credited_name: 'New credit' }),
      ]),
    );
  });
});
