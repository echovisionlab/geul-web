import { describe, expect, it } from 'vitest';
import { resolveCommentActions } from './comment-permissions';

describe('resolveCommentActions', () => {
  it('lets a member edit and delete only their own comment', () => {
    expect(resolveCommentActions({ isDeleted: false, isOwnComment: true, canModerate: false })).toEqual({
      canEdit: true,
      canDelete: true,
    });
  });

  it('lets a post moderator delete but not edit another member comment', () => {
    expect(resolveCommentActions({ isDeleted: false, isOwnComment: false, canModerate: true })).toEqual({
      canEdit: false,
      canDelete: true,
    });
  });

  it('offers no mutations for a deleted comment', () => {
    expect(resolveCommentActions({ isDeleted: true, isOwnComment: true, canModerate: true })).toEqual({
      canEdit: false,
      canDelete: false,
    });
  });
});
