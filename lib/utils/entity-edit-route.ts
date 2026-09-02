import { buildSearchSuffix, type SearchParamRecord } from './request-path';

export function isEntityEditView(query: SearchParamRecord): boolean {
  return query.edit === 'true';
}

export function buildEntityEditHref(pathname: string, query: SearchParamRecord): string {
  return `${pathname}${buildSearchSuffix({ ...query, edit: 'true' })}`;
}
