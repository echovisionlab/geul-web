import 'server-only';

import { logServerFailure } from '@/lib/logging/logger';

import { createPublicPostClientWithAuth } from '@/lib/api/server-client';
import {
  listPublishedPostsByTaxonomyWith,
  type PublishedPostsByTaxonomyInput,
  type TaxonomyPostRow,
} from '@/lib/queries/post-taxonomy-list';
import type { PaginatedQueryResult } from '@/lib/types/repository/result';

/**
 * First page of a public category/tag listing for the server render. Same request as the browser query
 * (`listPublishedPostsByTaxonomy`), with the visitor's cookies and Accept-Language like `/api/rpc`.
 * Returns undefined on failure so the page falls back to the browser query and its loading/error states.
 */
export async function getPublishedPostsByTaxonomyFirstPage(
  input: PublishedPostsByTaxonomyInput,
): Promise<{ result: PaginatedQueryResult<TaxonomyPostRow>; updatedAt: number } | undefined> {
  try {
    const result = await listPublishedPostsByTaxonomyWith(await createPublicPostClientWithAuth(), input);
    return { result, updatedAt: Date.now() };
  } catch (error) {
    logServerFailure('post-taxonomy-list', 'getPublishedPostsByTaxonomyFirstPage', error);
    return undefined;
  }
}
