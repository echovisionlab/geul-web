import { expect, it } from 'vitest';
import { deleteSelectedItems } from './useBulkDeletion';

it('retains successful IDs across domain errors, rejected requests and synchronous failures', async () => {
  const result = await deleteSelectedItems(
    ['ok', 'blocked', 'offline', 'throws'],
    (id) => {
      if (id === 'throws') {
        throw new Error('Connection lost');
      }
      if (id === 'offline') {
        return Promise.reject(new Error());
      }
      return Promise.resolve(id === 'blocked' ? { error: 'Still in use' } : {});
    },
    'Request failed',
  );
  expect(result).toEqual({ successfulIds: ['ok'], errors: ['Still in use', 'Request failed', 'Connection lost'] });
});
