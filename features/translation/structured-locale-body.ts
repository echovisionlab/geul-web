import { pageContentSchema, type Block, type PageContent } from '@echovisionlab/geul-common/page';
import { postContentSchema } from '@echovisionlab/geul-common/post';

export function parsePageLocaleBody(value: unknown): PageContent | null {
  const result = pageContentSchema.safeParse(value);
  return result.success ? result.data : null;
}

export function parseBlockLocaleBody(entityType: string, value: unknown): Block[] | null {
  if (entityType === 'post') {
    const result = postContentSchema.safeParse(value);
    return result.success ? result.data : null;
  }

  if (
    entityType === 'release' &&
    value &&
    typeof value === 'object' &&
    'description' in value &&
    Array.isArray((value as { description?: unknown }).description)
  ) {
    return (value as { description: Block[] }).description;
  }

  return Array.isArray(value) ? (value as Block[]) : null;
}
