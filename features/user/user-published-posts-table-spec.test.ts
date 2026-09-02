import { describe, expect, it } from 'vitest';
import {
  buildUserPublishedPostsFilterFields,
  buildUserPublishedPostsSortFields,
  USER_PUBLISHED_POST_ALLOWED_FILTER_FIELDS,
  USER_PUBLISHED_POST_ALLOWED_SORT_FIELDS,
} from './user-published-posts-table-spec';

describe('user published posts table spec', () => {
  it('builds category and tag filter fields with provided labels and options', () => {
    const fields = buildUserPublishedPostsFilterFields(
      {
        categories: [{ value: 'cat-1', label: 'Science' }],
        tags: [{ value: 'tag-1', label: 'Guide' }],
      },
      {
        category: 'Category',
        tag: 'Tag',
      },
    );

    expect(fields).toEqual([
      {
        field: 'category_id',
        label: 'Category',
        type: 'uuid',
        operators: ['in'],
        options: [{ value: 'cat-1', label: 'Science' }],
      },
      {
        field: 'tag_id',
        label: 'Tag',
        type: 'uuid',
        operators: ['in'],
        options: [{ value: 'tag-1', label: 'Guide' }],
      },
    ]);
  });

  it('builds title and published sort fields with provided labels', () => {
    expect(
      buildUserPublishedPostsSortFields({
        title: 'Title',
        published: 'Published',
      }),
    ).toEqual([
      { field: 'published_at', label: 'Published' },
      { field: 'title', label: 'Title' },
    ]);
  });

  it('exports query validation specs for filter and sort fields', () => {
    expect(USER_PUBLISHED_POST_ALLOWED_FILTER_FIELDS).toEqual([
      { field: 'category_id', operators: ['in'] },
      { field: 'tag_id', operators: ['in'] },
    ]);
    expect(USER_PUBLISHED_POST_ALLOWED_SORT_FIELDS).toEqual([{ field: 'published_at' }, { field: 'title' }]);
  });
});
