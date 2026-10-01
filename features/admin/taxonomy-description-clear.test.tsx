// @vitest-environment jsdom

import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(),
  category: { id: 'category-1', name: 'Category', description: 'Old category description', postCount: 0 },
  genre: { id: 'genre-1', name: 'Genre', slug: 'genre', description: 'Old genre description', releaseCount: 0 },
  style: { id: 'style-1', name: 'Style', slug: 'style', description: 'Old style description', releaseCount: 0 },
  updateCategory: vi.fn(),
  updateGenre: vi.fn(),
  updateStyle: vi.fn(),
}));

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock('next-intl', () => ({
  useTranslations: () => {
    const translate = (key: string) => key;
    Object.assign(translate, { rich: (key: string) => key });
    return translate;
  },
}));
vi.mock('@mantine/notifications', () => ({ notifications: { show: vi.fn() } }));
vi.mock('@mantine/core', () => ({ Text: ({ children }: { children: ReactNode }) => <span>{children}</span> }));
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
  Textarea: ({
    label,
    value,
    onChange,
  }: {
    label: string;
    value: string;
    onChange: (event: { currentTarget: HTMLTextAreaElement }) => void;
  }) => (
    <label>
      {label}
      <textarea aria-label={label} value={value} onChange={onChange} />
    </label>
  ),
}));
vi.mock('@/components/core/Modal', () => ({
  ConfirmModal: () => null,
  FormModal: ({ opened, onSubmit, children }: { opened: boolean; onSubmit: () => void; children: ReactNode }) =>
    opened ? (
      <form
        data-testid="edit-form"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        {children}
        <button type="submit">Save</button>
      </form>
    ) : null,
}));
vi.mock('@/lib/actions/category', () => ({
  createCategoryAction: vi.fn(),
  deleteCategoryAction: vi.fn(),
  updateCategoryAction: mocks.updateCategory,
}));
vi.mock('@/lib/actions/genre', () => ({
  createGenreAction: vi.fn(),
  deleteGenreAction: vi.fn(),
  updateGenreAction: mocks.updateGenre,
}));
vi.mock('@/lib/actions/style', () => ({
  createStyleAction: vi.fn(),
  deleteStyleAction: vi.fn(),
  updateStyleAction: mocks.updateStyle,
}));
vi.mock('./category/CategoryModalContext', () => ({
  useCategoryModal: () => ({
    editingCategory: mocks.category,
    closeEdit: vi.fn(),
    deletingCategory: null,
    closeDelete: vi.fn(),
    isCreateOpen: false,
    closeCreate: vi.fn(),
  }),
}));
vi.mock('./genre/GenreModalContext', () => ({
  useGenreModal: () => ({
    editingGenre: mocks.genre,
    closeEdit: vi.fn(),
    deletingGenre: null,
    closeDelete: vi.fn(),
    isCreateOpen: false,
    closeCreate: vi.fn(),
  }),
}));
vi.mock('./style/StyleModalContext', () => ({
  useStyleModal: () => ({
    editingStyle: mocks.style,
    closeEdit: vi.fn(),
    deletingStyle: null,
    closeDelete: vi.fn(),
    isCreateOpen: false,
    closeCreate: vi.fn(),
  }),
}));

import { CategoryModals } from './category/CategoryModals';
import { GenreModals } from './genre/GenreModals';
import { StyleModals } from './style/StyleModals';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.category = { id: 'category-1', name: 'Category', description: 'Old category description', postCount: 0 };
  mocks.genre = { id: 'genre-1', name: 'Genre', slug: 'genre', description: 'Old genre description', releaseCount: 0 };
  mocks.style = { id: 'style-1', name: 'Style', slug: 'style', description: 'Old style description', releaseCount: 0 };
  mocks.updateCategory.mockResolvedValue({ success: true });
  mocks.updateGenre.mockResolvedValue({ success: true });
  mocks.updateStyle.mockResolvedValue({ success: true });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function setValue(input: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const valueSetter = Object.getOwnPropertyDescriptor(
    input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,
    'value',
  )?.set;
  valueSetter?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

async function submitWithClearedDescription(component: ReactNode) {
  act(() => root.render(component));
  const description = container.querySelector<HTMLTextAreaElement>('[aria-label="labels.description"]');
  expect(description?.value).toMatch(/^Old /);
  act(() => setValue(description!, ''));
  await act(async () => {
    container
      .querySelector<HTMLFormElement>('[data-testid="edit-form"]')
      ?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await Promise.resolve();
  });
}

describe('taxonomy description clearing', () => {
  it('sends an explicit clear from category, genre, and style editors', async () => {
    await submitWithClearedDescription(<CategoryModals />);
    expect(mocks.updateCategory).toHaveBeenCalledWith('category-1', {
      description: null,
    });

    await submitWithClearedDescription(<GenreModals />);
    expect(mocks.updateGenre).toHaveBeenCalledWith('genre-1', {
      description: null,
    });

    await submitWithClearedDescription(<StyleModals />);
    expect(mocks.updateStyle).toHaveBeenCalledWith('style-1', {
      description: null,
    });
  });

  it('preserves a dirty name draft when refreshed taxonomy data arrives and submits only the name', async () => {
    act(() => root.render(<CategoryModals />));
    act(() => {
      setValue(container.querySelector<HTMLInputElement>('[aria-label="labels.name"]')!, 'Local category');
    });

    mocks.category = { ...mocks.category, name: 'Remote category', description: 'Remote description' };
    act(() => root.render(<CategoryModals />));

    expect(container.querySelector<HTMLInputElement>('[aria-label="labels.name"]')?.value).toBe('Local category');
    expect(container.querySelector<HTMLTextAreaElement>('[aria-label="labels.description"]')?.value).toBe(
      'Old category description',
    );

    await act(async () => {
      container
        .querySelector<HTMLFormElement>('[data-testid="edit-form"]')
        ?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await Promise.resolve();
    });

    expect(mocks.updateCategory).toHaveBeenCalledWith('category-1', { name: 'Local category' });
  });
});
