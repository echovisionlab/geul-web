import type { SessionUser } from '@/lib/auth/types';
import { buildSearchSuffix, type SearchParamRecord } from './request-path';

export function isEntityEditView(query: SearchParamRecord): boolean {
  return query.edit === 'true';
}

export function buildEntityEditHref(pathname: string, query: SearchParamRecord): string {
  return `${pathname}${buildSearchSuffix({ ...query, edit: 'true' })}`;
}

/**
 * Whether a member may open an entity's edit route. Whoever may edit the entity opens it, and any Author
 * also opens an archived entity, read-only. The caller decides `canEdit` from its own authority: the Admin
 * role, or the edit action the API granted for a Post. Routes answer every other request as not found.
 */
export function canOpenEntityEditRoute({
  archived,
  role,
  canEdit,
}: {
  archived: boolean;
  role: SessionUser['role'] | undefined;
  canEdit: boolean;
}): boolean {
  return canEdit || (archived && role === 'author');
}
