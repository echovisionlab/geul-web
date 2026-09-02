import { beforeEach, describe, expect, it, vi } from 'vitest';
import { accessLegalShareAction } from './legal-share-access';

const mocks = vi.hoisted(() => ({
  getLegalShareDocument: vi.fn(),
}));

vi.mock('./legal-share-query', () => ({
  getLegalShareDocument: mocks.getLegalShareDocument,
}));

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) {
    data.set(key, value);
  }
  return data;
}

describe('accessLegalShareAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('submits the password as a server action field and returns the exact scheduled version', async () => {
    mocks.getLegalShareDocument.mockResolvedValue({
      entityType: 'privacy',
      title: 'Upcoming privacy',
      content: '<p>Privacy</p>',
      version: 4,
      effectiveFrom: '2026-09-01T00:00:00.000Z',
    });

    const result = await accessLegalShareAction(
      {},
      form({
        entityType: 'privacy',
        id: 'privacy-version-1',
        token: 'share-token',
        requestedLocale: 'ko',
        password: 'secret',
      }),
    );

    expect(mocks.getLegalShareDocument).toHaveBeenCalledWith(
      'privacy',
      'privacy-version-1',
      'share-token',
      'ko',
      'secret',
    );
    expect(result.document).toEqual({
      entityType: 'privacy',
      title: 'Upcoming privacy',
      content: '<p>Privacy</p>',
      version: 4,
      effectiveFrom: '2026-09-01T00:00:00.000Z',
    });
  });

  it('does not call content authority without a password', async () => {
    const result = await accessLegalShareAction(
      {},
      form({ entityType: 'terms', id: 'terms-version-1', token: 'share-token', password: '' }),
    );

    expect(result).toEqual({ error: 'not_found' });
    expect(mocks.getLegalShareDocument).not.toHaveBeenCalled();
  });

  it('does not expose whether a rejected proof was a missing version or a wrong password', async () => {
    mocks.getLegalShareDocument.mockRejectedValue(new Error('not found'));

    const result = await accessLegalShareAction(
      {},
      form({
        entityType: 'terms',
        id: 'terms-version-1',
        token: 'share-token',
        requestedLocale: 'en',
        password: 'wrong',
      }),
    );

    expect(result).toEqual({ error: 'not_found' });
  });
});
