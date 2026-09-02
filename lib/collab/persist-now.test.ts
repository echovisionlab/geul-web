import { describe, expect, it } from 'vitest';
import { persistCollaborativeDocumentNow } from './persist-now';

describe('persistCollaborativeDocumentNow', () => {
  it.each([null, undefined])('fails when the collaboration provider is %s', async (provider) => {
    await expect(persistCollaborativeDocumentNow(provider)).rejects.toThrow(
      'collaborative document provider is unavailable',
    );
  });
});
