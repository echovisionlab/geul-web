import { DocumentContentHeight, DocumentRegionPlacement } from '@echovisionlab/geul-proto/common/common_pb.ts';
import { Code, ConnectError } from '@connectrpc/connect';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPageClient, createPostClient, createWorkClient } from '@/lib/api/server-client';
import { listVersions, restoreVersion, toVersionErrorResult } from './version-history';

vi.mock('@/lib/api/server-client', () => ({
  createPageClient: vi.fn(),
  createPostClient: vi.fn(),
  createWorkClient: vi.fn(),
}));

const protoDocumentLayout = {
  contentHeight: DocumentContentHeight.VIEWPORT,
  pageChrome: DocumentRegionPlacement.PINNED,
  footer: DocumentRegionPlacement.FLOW,
};

const pageClient = {
  listPageVersions: vi.fn(),
  restorePageVersion: vi.fn(),
};
const postClient = {
  listPostVersions: vi.fn(),
  restorePostVersion: vi.fn(),
};
const workClient = {
  listWorkVersions: vi.fn(),
  restoreWorkVersion: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(createPageClient).mockResolvedValue(pageClient as never);
  vi.mocked(createPostClient).mockResolvedValue(postClient as never);
  vi.mocked(createWorkClient).mockResolvedValue(workClient as never);
});

describe('version restore source boundary', () => {
  it.each([
    ['post', postClient.restorePostVersion, { postId: 'post-1', versionId: 'version-1' }],
    ['page', pageClient.restorePageVersion, { pageId: 'page-1', versionId: 'version-1' }],
    ['work', workClient.restoreWorkVersion, { workId: 'work-1', versionId: 'version-1' }],
  ] as const)('sends the exact %s restore RPC payload', async (entityType, restoreRpc, payload) => {
    await expect(restoreVersion(entityType, `${entityType}-1`, 'version-1')).resolves.toEqual({ success: true });
    expect(restoreRpc).toHaveBeenCalledWith(payload);
  });

  it('bounds service and provider errors while preserving auth categories', () => {
    expect(toVersionErrorResult(new ConnectError('raw secret', Code.Internal), 'Restore failed')).toEqual({
      status: 500,
      error: 'Restore failed',
    });
    expect(toVersionErrorResult(new Error('provider API key'), 'Restore failed')).toEqual({
      status: 500,
      error: 'Restore failed',
    });
    expect(toVersionErrorResult(new ConnectError('denied', Code.PermissionDenied), 'Restore failed')).toEqual({
      status: 403,
      error: 'Forbidden',
    });
  });
});

describe('version history document layout', () => {
  it('returns Page and Post snapshot layout separately from version metadata', async () => {
    pageClient.listPageVersions.mockResolvedValue({
      versions: [
        {
          id: 'page-version',
          version: 1,
          title: 'Page',
          sourceLocale: 'en',
          contributors: [],
          documentLayout: protoDocumentLayout,
        },
      ],
      pagination: { total: 1 },
    });
    postClient.listPostVersions.mockResolvedValue({
      versions: [
        {
          id: 'post-version',
          version: 2,
          title: 'Post',
          sourceLocale: 'ko',
          contributors: [],
          documentLayout: protoDocumentLayout,
        },
      ],
      pagination: { total: 1 },
    });

    await expect(listVersions('page', 'page-1')).resolves.toMatchObject({
      versions: [
        {
          id: 'page-version',
          sourceLocale: 'en',
          documentLayout: { contentHeight: 'viewport', pageChrome: 'pinned', footer: 'flow' },
        },
      ],
    });
    await expect(listVersions('post', 'post-1')).resolves.toMatchObject({
      versions: [
        {
          id: 'post-version',
          sourceLocale: 'ko',
          documentLayout: { contentHeight: 'viewport', pageChrome: 'pinned', footer: 'flow' },
        },
      ],
    });
  });

  it('keeps work versions layout-free and maps every contributor', async () => {
    workClient.listWorkVersions.mockResolvedValue({
      versions: [
        {
          id: 'work-version',
          version: 3,
          title: 'Work',
          sourceLocale: 'fr',
          contributors: [
            { memberId: 'member-1', nickname: 'Mina' },
            { memberId: 'member-2', nickname: 'Jules' },
          ],
        },
      ],
      pagination: { total: 1 },
    });

    const workVersions = await listVersions('work', 'work-1');
    expect(workVersions.versions?.[0]).not.toHaveProperty('documentLayout');
    expect(workVersions.versions?.[0]?.sourceLocale).toBe('fr');
    expect(workVersions.versions?.[0]?.contributors).toEqual([
      { memberId: 'member-1', nickname: 'Mina' },
      { memberId: 'member-2', nickname: 'Jules' },
    ]);
  });
});
