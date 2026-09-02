import { POST_SHARED_FIELD_KEYS, postCollabFieldsSchema } from '@echovisionlab/geul-common/collaboration/post';
import { DEFAULT_DOCUMENT_LAYOUT } from '@echovisionlab/geul-common/collaboration/document-layout';
import { z } from 'zod';

export const categorySchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
});

export const tagSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
});

export const PostMetaSchema = z
  .object({
    title: z.string(),
    summary: z.string(),
    featuredImageFileId: z.string().nullable().optional(),
    categories: z.array(categorySchema),
    tags: z.array(tagSchema),
    commentsEnabled: z.boolean(),
    contentHeight: z.enum(['content', 'viewport']),
    pageChrome: z.enum(['flow', 'pinned']),
    footer: z.enum(['flow', 'pinned']),
  })
  .strict();

export const PostTransientMetaSchema = postCollabFieldsSchema
  .pick({
    categoryIds: true,
    tagIds: true,
  })
  .required();

export type PostMeta = z.infer<typeof PostMetaSchema>;
export type PostTransientMeta = z.infer<typeof PostTransientMetaSchema>;
export type Category = z.infer<typeof categorySchema>;
export type Tag = z.infer<typeof tagSchema>;

export const DEFAULT_POST_META: PostMeta = {
  title: '',
  summary: '',
  categories: [],
  tags: [],
  commentsEnabled: true,
  ...DEFAULT_DOCUMENT_LAYOUT,
};

export const POST_TRANSIENT_META_JSON_KEYS: ReadonlySet<keyof PostTransientMeta> = new Set(POST_SHARED_FIELD_KEYS);
