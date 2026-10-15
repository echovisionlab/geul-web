import type { LocalBackupDocumentKind } from '@/lib/collab/local-backups';
import { buildPageEditPath } from './page-route';

export interface LocalBackupEditorTarget {
  documentKind: LocalBackupDocumentKind;
  entityId: string;
  locale: string;
}

/** Existing editor entry points use canonical IDs, including the catch-all Page edit route. */
export function buildLocalBackupEditorRoute(target: LocalBackupEditorTarget): string {
  const id = encodeURIComponent(target.entityId);
  const search = new URLSearchParams({ lang: target.locale });
  if (target.documentKind === 'page') {
    return buildPageEditPath(target.entityId, search);
  }
  const publicPaths = {
    post: 'posts',
    work: 'works',
    artist: 'artists',
    release: 'releases',
    label: 'labels',
    'program-event': 'events',
  };
  if (target.documentKind in publicPaths) {
    search.set('edit', 'true');
    return `/${publicPaths[target.documentKind as keyof typeof publicPaths]}/${id}?${search}`;
  }
  const paths = {
    campaign: `/campaigns/${id}`,
    'email-template': `/admin/email-templates/${id}`,
    'email-layout': `/admin/email-layouts/${id}`,
    'terms-history': `/terms/history/${id}`,
    'privacy-history': `/privacy/history/${id}`,
    form: `/admin/forms/${id}/builder`,
    'map-theme': `/admin/map/themes/${id}`,
    menu: '/admin/menus',
    'post-series': `/my/series/${id}`,
  };
  if (target.documentKind === 'terms-history' || target.documentKind === 'privacy-history') {
    search.set('edit', 'true');
  }
  if (target.documentKind === 'menu') {
    search.set('menu', target.entityId);
  }
  return `${paths[target.documentKind as keyof typeof paths]}?${search}`;
}
