import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from './[entityType]/[entityId]/route';
import { POST } from './[entityType]/[entityId]/restore/route';
const mocks = vi.hoisted(() => ({ list: vi.fn(), restore: vi.fn() }));
vi.mock('@/lib/server/version-history', () => ({
  parseVersionEntityType: (type: string) => (['page', 'post', 'work'].includes(type) ? type : null),
  listVersions: mocks.list,
  restoreVersion: mocks.restore,
  toVersionErrorResult: () => ({ status: 500, error: 'Failed' }),
}));
const params = () => ({ params: Promise.resolve({ entityType: 'page', entityId: 'owner' }) });
beforeEach(() => {
  vi.resetAllMocks();
  mocks.list.mockResolvedValue({ versions: [] });
  mocks.restore.mockResolvedValue({});
});
describe('version history input boundaries', () => {
  it.each([
    'page=0',
    'page=-1',
    'page=1.5',
    'page=NaN',
    'page=Infinity',
    'pageSize=0',
    'pageSize=101',
    'pageSize=1.5',
    'page=2147483649&pageSize=1',
    'page=9007199254740992',
  ])('rejects invalid pagination %s before RPC', async (query) => {
    const response = await GET(new Request(`https://www.dsub.io/api/versions?${query}`), params());
    expect(response.status).toBe(400);
    expect(mocks.list).not.toHaveBeenCalled();
  });
  it('accepts the largest signed int32 offset', async () => {
    const response = await GET(new Request('https://www.dsub.io/api/versions?page=2147483648&pageSize=1'), params());
    expect(response.status).toBe(200);
    expect(mocks.list).toHaveBeenCalledWith('page', 'owner', 2147483648, 1);
  });
  it.each(['null', '[]', '{}', '{"versionId":7}', '{"versionId":"  "}', 'bad JSON'])(
    'rejects an invalid restore body before RPC',
    async (body) => {
      const response = await POST(new Request('https://www.dsub.io/api/versions', { method: 'POST', body }), params());
      expect(response.status).toBe(400);
      expect(mocks.restore).not.toHaveBeenCalled();
    },
  );
});
