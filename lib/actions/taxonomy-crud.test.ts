import { timestampFromDate } from '@bufbuild/protobuf/wkt';
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
  loggerError: vi.fn(),
  revalidatePath: vi.fn(),
}));

const categoryClient = vi.hoisted(() => ({
  createCategory: vi.fn(),
  deleteCategory: vi.fn(),
  listCategories: vi.fn(),
  listCategoriesAdmin: vi.fn(),
  updateCategory: vi.fn(),
}));

const tagClient = vi.hoisted(() => ({
  createTag: vi.fn(),
  deleteTag: vi.fn(),
  listTags: vi.fn(),
  listTagsAdmin: vi.fn(),
  updateTag: vi.fn(),
}));

const genreClient = vi.hoisted(() => ({
  createGenre: vi.fn(),
  deleteGenre: vi.fn(),
  listGenres: vi.fn(),
  listGenresAdmin: vi.fn(),
  updateGenre: vi.fn(),
}));

const formatClient = vi.hoisted(() => ({
  createFormat: vi.fn(),
  deleteFormat: vi.fn(),
  listFormats: vi.fn(),
  listFormatsAdmin: vi.fn(),
  updateFormat: vi.fn(),
}));

const styleClient = vi.hoisted(() => ({
  createStyle: vi.fn(),
  deleteStyle: vi.fn(),
  listStyles: vi.fn(),
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

vi.mock('@/lib/utils/logger', () => ({
  createLogger: () => ({ error: mocks.loggerError }),
}));

const date = timestampFromDate(new Date('2026-01-01T00:00:00Z'));

describe('taxonomy CRUD actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createCategoryClient.mockResolvedValue(categoryClient);
    mocks.createTagClient.mockResolvedValue(tagClient);
    mocks.createGenreClient.mockResolvedValue(genreClient);
    mocks.createFormatClient.mockResolvedValue(formatClient);
    mocks.createStyleClient.mockResolvedValue(styleClient);

    categoryClient.listCategoriesAdmin.mockResolvedValue({
      categories: [
        {
          category: { id: 'cat-1', name: 'Category', slug: 'category', createdAt: date },
          postCount: 2,
        },
      ],
      pagination: { total: 1 },
    });
    categoryClient.listCategories.mockResolvedValue({
      categories: [{ id: 'cat-1', name: 'Category', slug: 'category' }],
    });
    categoryClient.createCategory.mockResolvedValue({
      id: 'cat-1',
      name: 'Category',
      slug: 'category',
    });

    tagClient.listTagsAdmin.mockResolvedValue({
      tags: [{ tag: { id: 'tag-1', name: 'Tag', slug: 'tag', createdAt: date }, postCount: 3 }],
      pagination: { total: 1 },
    });
    tagClient.listTags.mockResolvedValue({ tags: [{ id: 'tag-1', name: 'Tag', slug: 'tag' }] });
    tagClient.createTag.mockResolvedValue({ id: 'tag-1', name: 'Tag', slug: 'tag' });

    genreClient.listGenresAdmin.mockResolvedValue({
      genres: [
        {
          genre: { id: 'genre-1', name: 'Genre', slug: 'genre', createdAt: date },
          releaseCount: 4,
        },
      ],
      pagination: { total: 1 },
    });
    genreClient.listGenres.mockResolvedValue({
      genres: [{ id: 'genre-1', name: 'Genre', slug: 'genre' }],
    });
    genreClient.createGenre.mockResolvedValue({ id: 'genre-1', name: 'Genre', slug: 'genre' });

    formatClient.listFormatsAdmin.mockResolvedValue({
      formats: [{ format: { id: 'format-1', name: 'Format', slug: 'format' }, releaseCount: 5 }],
      pagination: { total: 1 },
    });
    formatClient.listFormats.mockResolvedValue({
      formats: [{ id: 'format-1', name: 'Format', slug: 'format' }],
    });
    formatClient.createFormat.mockResolvedValue({ id: 'format-1', name: 'Format', slug: 'format' });

    styleClient.listStylesAdmin.mockResolvedValue({
      styles: [
        {
          style: { id: 'style-1', name: 'Style', slug: 'style', createdAt: date },
          releaseCount: 6,
        },
      ],
      pagination: { total: 1 },
    });
    styleClient.listStyles.mockResolvedValue({
      styles: [{ id: 'style-1', name: 'Style', slug: 'style' }],
    });
    styleClient.createStyle.mockResolvedValue({ id: 'style-1', name: 'Style', slug: 'style' });
  });

  it('maps category and tag selector/admin lists and mutations', async () => {
    await expect(
      category.listCategoriesAdminAction({
        page: 2,
        pageSize: 5,
        search: 'cat',
        sort: [{ field: 'name', order: 'desc' }],
      }),
    ).resolves.toMatchObject({ data: [{ id: 'cat-1', postCount: 2 }], total: 1, page: 2 });
    await expect(category.listCategoriesAction()).resolves.toEqual([
      { id: 'cat-1', name: 'Category', slug: 'category' },
    ]);
    await expect(category.createCategoryAction({ name: 'Category' })).resolves.toEqual({
      data: { id: 'cat-1', name: 'Category', slug: 'category' },
    });
    await expect(category.updateCategoryAction('cat-1', { name: 'New' })).resolves.toEqual({
      success: true,
    });
    await expect(category.deleteCategoryAction('cat-1')).resolves.toEqual({ success: true });

    await expect(tag.listTagsAdminAction({ search: 'tag' })).resolves.toMatchObject({
      data: [{ id: 'tag-1', postCount: 3 }],
    });
    await expect(tag.listTagsAction()).resolves.toEqual([{ id: 'tag-1', name: 'Tag', slug: 'tag' }]);
    await expect(tag.createTagAction('Tag')).resolves.toEqual({
      data: { id: 'tag-1', name: 'Tag', slug: 'tag' },
    });
    await expect(tag.updateTagAction('tag-1', 'New')).resolves.toEqual({ success: true });
    await expect(tag.deleteTagAction('tag-1')).resolves.toEqual({ success: true });

    expect(mocks.revalidatePath).toHaveBeenCalledWith('/admin/categories');
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/admin/tags');
  });

  it('maps genre, format, and style selector/admin lists and mutations', async () => {
    await expect(genre.listGenresAdminAction({ search: 'genre' })).resolves.toMatchObject({
      data: [{ id: 'genre-1', releaseCount: 4 }],
    });
    await expect(genre.listGenresAction()).resolves.toEqual([{ id: 'genre-1', name: 'Genre', slug: 'genre' }]);
    await expect(genre.createGenreAction('Genre', 'Description')).resolves.toEqual({
      data: { id: 'genre-1', name: 'Genre', slug: 'genre' },
    });
    await expect(genre.updateGenreAction('genre-1', { description: null })).resolves.toEqual({
      success: true,
    });
    await expect(genre.deleteGenreAction('genre-1')).resolves.toEqual({ success: true });

    await expect(format.listFormatsAdminAction({ search: 'format' })).resolves.toMatchObject({
      data: [{ id: 'format-1', releaseCount: 5 }],
    });
    await expect(format.listFormatsAction()).resolves.toEqual([{ id: 'format-1', name: 'Format', slug: 'format' }]);
    await expect(format.createFormatAction('Format')).resolves.toEqual({
      data: { id: 'format-1', name: 'Format', slug: 'format' },
    });
    await expect(format.updateFormatAction('format-1', { name: 'New' })).resolves.toEqual({
      success: true,
    });
    await expect(format.deleteFormatAction('format-1')).resolves.toEqual({ success: true });

    await expect(style.listStylesAdminAction({ search: 'style' })).resolves.toMatchObject({
      data: [{ id: 'style-1', releaseCount: 6 }],
      total: 1,
    });
    await expect(style.listStylesAction()).resolves.toEqual([{ id: 'style-1', name: 'Style', slug: 'style' }]);
    await expect(style.createStyleAction('Style', 'Description')).resolves.toEqual({
      data: { id: 'style-1', name: 'Style', slug: 'style' },
    });
    await expect(style.updateStyleAction('style-1', { description: null })).resolves.toEqual({
      success: true,
    });
    await expect(style.deleteStyleAction('style-1')).resolves.toEqual({ success: true });
  });

  it('returns empty lists when selector backends fail', async () => {
    categoryClient.listCategories.mockRejectedValueOnce(new Error('offline'));
    tagClient.listTags.mockRejectedValueOnce(new Error('offline'));
    genreClient.listGenres.mockRejectedValueOnce(new Error('offline'));
    formatClient.listFormats.mockRejectedValueOnce(new Error('offline'));
    styleClient.listStyles.mockRejectedValueOnce(new Error('offline'));

    await expect(category.listCategoriesAction()).resolves.toEqual([]);
    await expect(tag.listTagsAction()).resolves.toEqual([]);
    await expect(genre.listGenresAction()).resolves.toEqual([]);
    await expect(format.listFormatsAction()).resolves.toEqual([]);
    await expect(style.listStylesAction()).resolves.toEqual([]);
  });
});
