import { unwrapQueryResult } from '@/lib/api/query-result';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as category from './category';
import * as format from './format';
import * as genre from './genre';
import * as style from './style';
import * as tag from './tag';

const mocks = vi.hoisted(() => ({
  createCategoryClient: vi.fn(),
  createFormatClient: vi.fn(),
  createGenreClient: vi.fn(),
  createStyleClient: vi.fn(),
  createTagClient: vi.fn(),
  revalidatePath: vi.fn(),
}));

const categoryClient = vi.hoisted(() => ({
  listCategoriesAdmin: vi.fn(),
  updateCategory: vi.fn(),
}));

const tagClient = vi.hoisted(() => ({
  listTagsAdmin: vi.fn(),
}));

const genreClient = vi.hoisted(() => ({
  listGenresAdmin: vi.fn(),
  updateGenre: vi.fn(),
}));

const formatClient = vi.hoisted(() => ({
  listFormatsAdmin: vi.fn(),
}));

const styleClient = vi.hoisted(() => ({
  listStylesAdmin: vi.fn(),
  updateStyle: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidatePath: mocks.revalidatePath,
}));

vi.mock('@/lib/api/server-client', () => ({
  createCategoryClient: mocks.createCategoryClient,
  createFormatClient: mocks.createFormatClient,
  createGenreClient: mocks.createGenreClient,
  createStyleClient: mocks.createStyleClient,
  createTagClient: mocks.createTagClient,
}));

const describedTaxonomies = [
  {
    name: 'category',
    update: category.updateCategoryAction,
    rpc: categoryClient.updateCategory,
  },
  {
    name: 'genre',
    update: genre.updateGenreAction,
    rpc: genreClient.updateGenre,
  },
  {
    name: 'style',
    update: style.updateStyleAction,
    rpc: styleClient.updateStyle,
  },
];

describe('taxonomy CRUD actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createCategoryClient.mockResolvedValue(categoryClient);
    mocks.createTagClient.mockResolvedValue(tagClient);
    mocks.createGenreClient.mockResolvedValue(genreClient);
    mocks.createFormatClient.mockResolvedValue(formatClient);
    mocks.createStyleClient.mockResolvedValue(styleClient);
  });

  it.each(describedTaxonomies)('clears a $name description by sending an empty string', async ({ update, rpc }) => {
    await expect(update('id-1', { description: null })).resolves.toEqual({ ok: true, success: true });

    expect(rpc).toHaveBeenCalledWith({ id: 'id-1', description: '' });
  });

  it.each(describedTaxonomies)('renames a $name without touching its description', async ({ update, rpc }) => {
    await expect(update('id-1', { name: 'New' })).resolves.toEqual({ ok: true, success: true });

    expect(rpc).toHaveBeenCalledWith({ id: 'id-1', name: 'New' });
  });

  it.each([
    {
      name: 'category',
      list: async () => unwrapQueryResult(await category.listCategoriesAdminAction({})),
      arrange: () =>
        categoryClient.listCategoriesAdmin.mockResolvedValue({
          categories: [{ category: { id: 'cat-1', name: 'Category' }, postCount: 2 }],
          pagination: { total: 1 },
        }),
      expected: { id: 'cat-1', postCount: 2 },
    },
    {
      name: 'tag',
      list: async () => unwrapQueryResult(await tag.listTagsAdminAction({})),
      arrange: () =>
        tagClient.listTagsAdmin.mockResolvedValue({
          tags: [{ tag: { id: 'tag-1', name: 'Tag' }, postCount: 3 }],
          pagination: { total: 1 },
        }),
      expected: { id: 'tag-1', postCount: 3 },
    },
    {
      name: 'genre',
      list: async () => unwrapQueryResult(await genre.listGenresAdminAction({})),
      arrange: () =>
        genreClient.listGenresAdmin.mockResolvedValue({
          genres: [{ genre: { id: 'genre-1', name: 'Genre' }, releaseCount: 4 }],
          pagination: { total: 1 },
        }),
      expected: { id: 'genre-1', releaseCount: 4 },
    },
    {
      name: 'format',
      list: async () => unwrapQueryResult(await format.listFormatsAdminAction({})),
      arrange: () =>
        formatClient.listFormatsAdmin.mockResolvedValue({
          formats: [{ format: { id: 'format-1', name: 'Format' }, releaseCount: 5 }],
          pagination: { total: 1 },
        }),
      expected: { id: 'format-1', releaseCount: 5 },
    },
    {
      name: 'style',
      list: async () => unwrapQueryResult(await style.listStylesAdminAction({})),
      arrange: () =>
        styleClient.listStylesAdmin.mockResolvedValue({
          styles: [{ style: { id: 'style-1', name: 'Style' }, releaseCount: 6 }],
          pagination: { total: 1 },
        }),
      expected: { id: 'style-1', releaseCount: 6 },
    },
  ])('shows the usage count on each $name admin row', async ({ list, arrange, expected }) => {
    arrange();

    const result = await list();

    expect(result.data).toEqual([expect.objectContaining(expected)]);
    expect(result.total).toBe(1);
  });
});
