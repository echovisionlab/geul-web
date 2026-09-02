import { create } from '@bufbuild/protobuf';
import { FilterOp, FilterSpecSchema } from '@echovisionlab/geul-proto/common/common_pb.ts';
import { FormStatus } from '@echovisionlab/geul-proto/secure/form_pb.ts';
import { createFormClient } from '@/lib/api/browser-client';
import { createClientLogger, serializeClientLogError } from '@/lib/utils/client-logger';

const logger = createClientLogger('form-browser');

const fromBytes = (bytes: Uint8Array): string => new TextDecoder().decode(bytes);

/**
 * Search published forms (browser-side).
 * For use in Client Components that need real-time search.
 */
export async function searchPublishedForms(search: string, limit: number = 5) {
  const client = createFormClient();
  const filters = [
    create(FilterSpecSchema, {
      field: 'status',
      op: FilterOp.EQ,
      value: 'FORM_STATUS_PUBLISHED',
    }),
  ];
  if (search) {
    filters.push(
      create(FilterSpecSchema, {
        field: 'search',
        op: FilterOp.ILIKE,
        value: search,
      }),
    );
  }
  const response = await client.listFormsAdmin({
    pagination: { limit, offset: 0 },
    filters,
  });
  return (response.forms ?? []).map((f) => ({
    id: f.id,
    title: f.title,
    slug: f.slug,
  }));
}

/**
 * List published forms (browser-side).
 * For use in Client Components.
 */
export async function listPublishedForms(limit: number = 5) {
  const client = createFormClient();
  const response = await client.listFormsAdmin({
    pagination: { limit, offset: 0 },
    filters: [
      create(FilterSpecSchema, {
        field: 'status',
        op: FilterOp.EQ,
        value: 'FORM_STATUS_PUBLISHED',
      }),
    ],
  });
  return (response.forms ?? []).map((f) => ({
    id: f.id,
    title: f.title,
    slug: f.slug,
  }));
}

/**
 * Get public form by ID (browser-side).
 * For use in Client Components.
 */
export async function getPublicFormById(id: string) {
  const client = createFormClient();
  const form = await client.getForm({ id });
  if (form.status !== FormStatus.PUBLISHED) {
    return null;
  }
  return {
    id: form.id,
    title: form.title,
    slug: form.slug,
    schema: JSON.parse(fromBytes(form.schema)),
    status: 'published' as const,
    isPublic: form.isPublic,
  };
}

export async function checkFormSlugAvailable(slug: string, excludeId?: string): Promise<{ available: boolean }> {
  try {
    const client = createFormClient();
    const response = await client.checkFormSlugAvailable({
      slug,
      excludeId,
    });
    return { available: response.available };
  } catch (err) {
    logger.error('Failed to check form slug', { error: serializeClientLogError(err) });
    return { available: false };
  }
}
