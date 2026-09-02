import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { removeLegacyPostMetaFields } from '../post-meta';
import { removeLegacyWorkMetaFields } from '../work-meta';
import { DEFAULT_POST_META, PostMetaSchema } from './post-meta.schema';
import { DEFAULT_WORK_META, WorkMetaSchema } from './work-meta.schema';

describe('collaborative media contracts', () => {
  it('accepts an absent or explicit post file ID and rejects UI-only fields', () => {
    expect(PostMetaSchema.safeParse(DEFAULT_POST_META).success).toBe(true);
    expect(PostMetaSchema.safeParse({ ...DEFAULT_POST_META, featuredImageFileId: 'post-file-id' }).success).toBe(true);
    expect(PostMetaSchema.safeParse({ ...DEFAULT_POST_META, featuredImageFileId: null }).success).toBe(true);
    expect(PostMetaSchema.safeParse({ ...DEFAULT_POST_META, featuredImageUrl: '/media/post.webp' }).success).toBe(
      false,
    );
    expect(PostMetaSchema.safeParse({ ...DEFAULT_POST_META, slug: 'post-slug' }).success).toBe(false);
  });

  it('accepts an absent or explicit work file ID and rejects display URLs', () => {
    expect(WorkMetaSchema.safeParse(DEFAULT_WORK_META).success).toBe(true);
    expect(WorkMetaSchema.safeParse({ ...DEFAULT_WORK_META, featuredImageFileId: 'work-file-id' }).success).toBe(true);
    expect(WorkMetaSchema.safeParse({ ...DEFAULT_WORK_META, featuredImageFileId: null }).success).toBe(true);
    expect(WorkMetaSchema.safeParse({ ...DEFAULT_WORK_META, featuredImageUrl: '/media/work.webp' }).success).toBe(
      false,
    );
  });

  it('removes legacy UI fields without materializing missing file IDs', () => {
    const postDoc = new Y.Doc();
    const postMeta = postDoc.getMap('post-meta');
    postMeta.set('featuredImageUrl', '/media/legacy-post.webp');
    postMeta.set('slug', 'legacy-post');

    removeLegacyPostMetaFields(postDoc);

    expect(postMeta.has('featuredImageUrl')).toBe(false);
    expect(postMeta.has('slug')).toBe(false);
    expect(postMeta.has('featuredImageFileId')).toBe(false);

    const workDoc = new Y.Doc();
    const workMeta = workDoc.getMap('work-meta');
    workMeta.set('featuredImageUrl', '/media/legacy-work.webp');
    workMeta.set('status', 'archived');

    removeLegacyWorkMetaFields(workDoc);

    expect(workMeta.has('featuredImageUrl')).toBe(false);
    expect(workMeta.has('status')).toBe(false);
    expect(workMeta.has('featuredImageFileId')).toBe(false);

    postDoc.destroy();
    workDoc.destroy();
  });
});
