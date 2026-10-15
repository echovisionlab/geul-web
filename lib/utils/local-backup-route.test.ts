import { describe, expect, it } from 'vitest';
import { buildLocalBackupEditorRoute } from './local-backup-route';

describe('local backup editor routes', () => {
  it.each([
    ['post', '/posts/id?lang=ko&edit=true'],
    ['work', '/works/id?lang=ko&edit=true'],
    ['artist', '/artists/id?lang=ko&edit=true'],
    ['release', '/releases/id?lang=ko&edit=true'],
    ['label', '/labels/id?lang=ko&edit=true'],
    ['program-event', '/events/id?lang=ko&edit=true'],
    ['campaign', '/campaigns/id?lang=ko'],
    ['email-template', '/admin/email-templates/id?lang=ko'],
    ['email-layout', '/admin/email-layouts/id?lang=ko'],
    ['terms-history', '/terms/history/id?lang=ko&edit=true'],
    ['privacy-history', '/privacy/history/id?lang=ko&edit=true'],
    ['form', '/admin/forms/id/builder?lang=ko'],
    ['map-theme', '/admin/map/themes/id?lang=ko'],
    ['menu', '/admin/menus?lang=ko&menu=id'],
    ['post-series', '/my/series/id?lang=ko'],
  ] as const)('opens the existing %s editor with the journal locale', (documentKind, expected) => {
    expect(buildLocalBackupEditorRoute({ documentKind, entityId: 'id', locale: 'ko' })).toBe(expected);
  });
  it('opens Pages by their canonical UUID even when their public slug changed or is empty', () => {
    const target = { documentKind: 'page', entityId: 'id', locale: 'en' } as const;
    expect(buildLocalBackupEditorRoute(target)).toBe('/id?lang=en&edit=true');
  });
});
