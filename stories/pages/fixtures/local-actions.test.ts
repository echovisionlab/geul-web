import { describe, expect, it } from 'vitest';
import { createLocalOgPreview } from './local-og-preview';
import { createLocalTokenBindings } from './personal-access-tokens';
import { transportRows } from './transport-query';

describe('local story transport results', () => {
  it('regenerates an OG image with the current title and safely escaped summary', () => {
    const before = createLocalOgPreview('First title', 'A < B & C');
    const after = createLocalOgPreview('Revised title', 'Updated summary');
    expect(after).not.toBe(before);
    expect(decodeURIComponent(before)).toContain('A &lt; B &amp; C');
    expect(decodeURIComponent(after)).toContain('Revised title');
  });
  it('creates, regenerates and deletes the same local token through the controller bindings', async () => {
    const bindings = createLocalTokenBindings();
    const first = await bindings.createMyPersonalAccessTokenAction();
    expect(first.personalAccessToken?.id).toMatch(/^preview-/);
    const second = await bindings.regenerateMyPersonalAccessTokenAction(first.personalAccessToken!.id);
    expect(second.secret).not.toBe(first.secret);
    expect(second.personalAccessToken?.id).not.toBe(first.personalAccessToken?.id);
    expect(await bindings.deleteMyPersonalAccessTokenAction(second.personalAccessToken!.id)).toEqual({ deleted: true });
    expect(await bindings.regenerateMyPersonalAccessTokenAction(second.personalAccessToken!.id)).toEqual({
      error: 'invalid_request',
    });
  });
  it('applies transported relationship filters and numeric sorting before pagination', () => {
    const rows = [
      { id: 'one', tags: [{ id: 'music' }], releaseCount: 2 },
      { id: 'two', tags: [{ id: 'music' }], releaseCount: 12 },
      { id: 'three', tags: [{ id: 'other' }], releaseCount: 20 },
    ];
    const result = transportRows(
      rows,
      {
        filter: [{ field: 'tags', op: 'eq', value: 'music' }],
        sort: [{ field: 'release_count', order: 'desc' }],
        pageSize: 1,
      },
      (row) => row.id,
    );
    expect(result.data.map((row) => row.id)).toEqual(['two']);
    expect(result.total).toBe(2);
  });
});
