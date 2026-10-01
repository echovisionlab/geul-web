// @vitest-environment jsdom

import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  id: 'new',
  createClientAction: vi.fn(),
  updateClientAction: vi.fn(),
  invalidateQueries: vi.fn(),
  client: {
    id: 'client-1',
    name: 'Client One',
    website: 'https://client.example',
    logoLightUrl: null,
    logoDarkUrl: null,
  },
  mutations: [] as Array<{ mutate: (values: unknown) => Promise<unknown> }>,
}));

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: mocks.id }),
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
vi.mock('@tanstack/react-query', () => ({
  useMutation: (options: { mutationFn: (values: unknown) => Promise<unknown> }) => {
    const mutate = (values: unknown) => options.mutationFn(values);
    mocks.mutations.push({ mutate });
    return { mutate, isPending: false };
  },
  useQuery: () => ({
    data: mocks.client,
    isLoading: false,
  }),
  useQueryClient: () => ({ invalidateQueries: mocks.invalidateQueries }),
}));
vi.mock('@mantine/notifications', () => ({ notifications: { show: vi.fn() } }));
vi.mock('@mantine/core', () => ({
  Group: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Stack: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/components/core/Button', () => ({
  Button: ({ children, onClick, disabled }: { children: ReactNode; onClick?: () => void; disabled?: boolean }) => (
    <button type="button" onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
}));
vi.mock('@/components/core/Input', () => ({
  TextInput: ({
    label,
    value,
    onChange,
  }: {
    label: string;
    value: string;
    onChange: (event: { currentTarget: HTMLInputElement }) => void;
  }) => (
    <label>
      {label}
      <input aria-label={label} value={value} onChange={onChange} />
    </label>
  ),
}));
vi.mock('@/features/editor/EditorHeader', () => ({ EditorHeader: () => null }));
vi.mock('@/features/site/PageLoader', () => ({ PageLoader: () => null }));
vi.mock('@/features/client/ClientLogoUploader', () => ({ ClientLogoUploader: () => null }));
vi.mock('@/lib/actions/client', () => ({
  createClientAction: mocks.createClientAction,
  updateClientAction: mocks.updateClientAction,
}));
vi.mock('@/lib/queries/client-browser', () => ({ getClient: vi.fn() }));

import AdminClientDetailPage from './page';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  mocks.id = 'new';
  mocks.client = {
    id: 'client-1',
    name: 'Client One',
    website: 'https://client.example',
    logoLightUrl: null,
    logoDarkUrl: null,
  };
  mocks.createClientAction.mockReset().mockResolvedValue({ data: { id: 'client-1' } });
  mocks.updateClientAction.mockReset().mockResolvedValue({ success: true });
  mocks.invalidateQueries.mockReset();
  mocks.mutations = [];
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function renderPage(id: string) {
  mocks.id = id;
  act(() => root.render(<AdminClientDetailPage />));
}

function setValue(input: HTMLInputElement, value: string) {
  const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  valueSetter?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

describe('Admin client detail form', () => {
  it('forwards the website when creating a client', async () => {
    renderPage('new');
    act(() => {
      setValue(container.querySelector<HTMLInputElement>('[aria-label="labels.name"]')!, 'Client One');
      setValue(container.querySelector<HTMLInputElement>('[aria-label="labels.website"]')!, 'https://client.example');
    });

    await act(async () => {
      container.querySelector<HTMLButtonElement>('button:last-child')?.click();
      await Promise.resolve();
    });

    expect(mocks.createClientAction).toHaveBeenCalledWith('Client One', 'https://client.example');
  });

  it('forwards a cleared website on update', async () => {
    renderPage('client-1');
    await act(async () => Promise.resolve());
    act(() => {
      setValue(container.querySelector<HTMLInputElement>('[aria-label="labels.website"]')!, '');
    });

    await act(async () => {
      container.querySelector<HTMLButtonElement>('button:last-child')?.click();
      await Promise.resolve();
    });

    expect(mocks.updateClientAction).toHaveBeenCalledWith('client-1', { website: null });
  });

  it('keeps a dirty draft through a refreshed query and submits only the changed field', async () => {
    renderPage('client-1');
    await act(async () => Promise.resolve());
    act(() => {
      setValue(container.querySelector<HTMLInputElement>('[aria-label="labels.name"]')!, 'Local draft');
    });

    mocks.client = {
      ...mocks.client,
      name: 'Remote name',
      website: 'https://remote.example',
    };
    renderPage('client-1');

    expect(container.querySelector<HTMLInputElement>('[aria-label="labels.name"]')?.value).toBe('Local draft');
    expect(container.querySelector<HTMLInputElement>('[aria-label="labels.website"]')?.value).toBe(
      'https://client.example',
    );

    await act(async () => {
      container.querySelector<HTMLButtonElement>('button:last-child')?.click();
      await Promise.resolve();
    });

    expect(mocks.updateClientAction).toHaveBeenCalledWith('client-1', { name: 'Local draft' });
  });
});
