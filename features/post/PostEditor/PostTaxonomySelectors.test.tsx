// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Category, Tag } from '@/lib/collab/post-meta';
import { CategorySelector } from './CategorySelector';
import { TagSelector } from './TagSelector';

interface SelectorProps {
  canEdit: boolean;
  canCreateNew: boolean;
  onSelect: (item: Category | Tag) => void;
  onDeselect: (item: Category | Tag) => void;
  onCreate: (name: string) => void;
}

const mocks = vi.hoisted(() => ({
  latestProps: null as SelectorProps | null,
  mutate: vi.fn(),
  setCategoryIds: vi.fn(),
  setTagIds: vi.fn(),
}));

vi.mock('@/features/post/MultiSelectCombobox', () => ({
  MultiSelectCombobox: (props: SelectorProps) => {
    mocks.latestProps = props;
    return null;
  },
}));

vi.mock('@/lib/contexts/PostMetaContext', () => ({
  usePostMeta: () => ({
    categoryIds: ['category-1'],
    tagIds: ['tag-1'],
    setCategoryIds: mocks.setCategoryIds,
    setTagIds: mocks.setTagIds,
  }),
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: ({ initialData }: { initialData: unknown }) => ({
    data: initialData,
    isLoading: false,
  }),
  useMutation: () => ({ mutate: mocks.mutate, isPending: false }),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock('@mantine/notifications', () => ({
  notifications: { show: vi.fn() },
}));

vi.mock('@/lib/actions/category', () => ({
  createCategoryAction: vi.fn(),
  listCategoriesAction: vi.fn(),
}));

vi.mock('@/lib/actions/tag', () => ({
  createTagAction: vi.fn(),
  listTagsAction: vi.fn(),
}));

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  mocks.latestProps = null;
  vi.clearAllMocks();
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('Post taxonomy selector sync boundary', () => {
  it.each([
    [
      'category',
      () => (
        <CategorySelector
          postId="post-1"
          canEdit={false}
          isAdmin
          categories={[{ id: 'category-1', name: 'Category', slug: 'category' }]}
        />
      ),
      mocks.setCategoryIds,
      { id: 'category-2', name: 'Next category', slug: 'next-category' },
    ],
    [
      'tag',
      () => <TagSelector postId="post-1" canEdit={false} isAdmin tags={[{ id: 'tag-1', name: 'Tag', slug: 'tag' }]} />,
      mocks.setTagIds,
      { id: 'tag-2', name: 'Next tag', slug: 'next-tag' },
    ],
  ])('does not write %s relations before shared sync', (_kind, renderSelector, setter, item) => {
    act(() => root.render(renderSelector()));

    expect(mocks.latestProps?.canEdit).toBe(false);
    expect(mocks.latestProps?.canCreateNew).toBe(false);
    act(() => {
      mocks.latestProps?.onSelect(item);
      mocks.latestProps?.onDeselect(item);
      mocks.latestProps?.onCreate('New');
    });

    expect(setter).not.toHaveBeenCalled();
    expect(mocks.mutate).not.toHaveBeenCalled();
  });
});
