import { describe, expect, it } from 'vitest';
import { buildEntityEditHref, canOpenEntityEditRoute, isEntityEditView } from './entity-edit-route';

describe('entity edit route', () => {
  it('enters edit mode only for the literal edit=true value', () => {
    expect(isEntityEditView({ edit: 'true' })).toBe(true);
    expect(isEntityEditView({ edit: 'false' })).toBe(false);
    expect(isEntityEditView({ edit: ['true'] })).toBe(false);
    expect(isEntityEditView({})).toBe(false);
  });

  it('preserves the query while forcing the canonical edit marker', () => {
    expect(buildEntityEditHref('/posts/post-1', { edit: 'true', lang: ['ko', 'en'], tab: 'body' })).toBe(
      '/posts/post-1?edit=true&lang=ko&lang=en&tab=body',
    );
  });

  it.each([
    ['opens for a member who may edit a live entity', false, 'author', true, true],
    ['opens for a member who may edit an archived entity', true, 'admin', true, true],
    ['opens an archived entity read-only for an Author who may not edit it', true, 'author', false, true],
    ['hides a live entity from an Author who may not edit it', false, 'author', false, false],
    ['hides an archived entity from a member without the Author role', true, 'user', false, false],
    ['hides an archived entity from a visitor without a session', true, undefined, false, false],
    ['hides an archived entity from an Admin the caller did not allow to edit it', true, 'admin', false, false],
  ] as const)('%s', (_case, archived, role, canEdit, opens) => {
    expect(canOpenEntityEditRoute({ archived, role, canEdit })).toBe(opens);
  });
});
