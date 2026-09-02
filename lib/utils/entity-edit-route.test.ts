import { describe, expect, it } from 'vitest';
import { buildEntityEditHref, isEntityEditView } from './entity-edit-route';

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
});
