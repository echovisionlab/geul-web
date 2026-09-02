import { SegmentType } from '@echovisionlab/geul-proto/secure/audience_pb.ts';
import { TranscodeEntityType } from '@echovisionlab/geul-proto/secure/events_pb.ts';
import { FileDownloadAudience } from '@echovisionlab/geul-proto/secure/file_pb.ts';
import { FilterOp } from '@echovisionlab/geul-proto/common/common_pb.ts';
import { Code, ConnectError } from '@connectrpc/connect';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createAudienceClient, createFileClient } from '@/lib/api/server-client';
import {
  getFileDownloadPolicyAction,
  listAudienceSegmentsForAuthenticatedAccessAction,
  updateFileDownloadPolicyAction,
} from './file-download-access';

vi.mock('@/lib/api/server-client', () => ({
  createAudienceClient: vi.fn(),
  createFileClient: vi.fn(),
}));

beforeEach(() => {
  vi.mocked(createAudienceClient).mockReset();
  vi.mocked(createFileClient).mockReset();
});

describe('file download access actions', () => {
  it('returns stable error codes for invalid typed relationships', async () => {
    await expect(
      getFileDownloadPolicyAction({
        entityType: TranscodeEntityType.UNSPECIFIED,
        entityId: '',
        expectedFileId: '',
      }),
    ).resolves.toEqual({ errorCode: 'invalidTarget' });

    expect(createFileClient).not.toHaveBeenCalled();
    expect(createAudienceClient).not.toHaveBeenCalled();
  });

  it.each([TranscodeEntityType.WORK, TranscodeEntityType.PROGRAM_EVENT])(
    'rejects a content target %s without its exact Block selector',
    async (entityType) => {
      await expect(
        getFileDownloadPolicyAction({
          entityType,
          entityId: 'entity-1',
          expectedFileId: 'file-1',
        }),
      ).resolves.toEqual({ errorCode: 'invalidTarget' });

      expect(createFileClient).not.toHaveBeenCalled();
    },
  );

  it('maps backend failures to stable codes without returning backend details', async () => {
    vi.mocked(createFileClient).mockRejectedValue(new Error('private backend detail'));

    const result = await getFileDownloadPolicyAction({
      entityType: TranscodeEntityType.POST,
      entityId: 'post-1',
      blockId: 'block-1',
      referencePath: 'file',
      expectedFileId: 'file-1',
    });

    expect(result).toEqual({ errorCode: 'loadFailed' });
    expect(result).not.toHaveProperty('error');
  });

  it('maps expected File CAS replacement races to an explicit reload-required result', async () => {
    const updateFileDownloadPolicy = vi
      .fn()
      .mockRejectedValue(new ConnectError('attachment changed; reload', Code.FailedPrecondition));
    vi.mocked(createFileClient).mockResolvedValue({ updateFileDownloadPolicy } as never);

    await expect(
      updateFileDownloadPolicyAction(
        {
          entityType: TranscodeEntityType.POST,
          entityId: 'post-1',
          blockId: 'block-1',
          referencePath: 'file',
          expectedFileId: 'file-old',
        },
        'public',
        [],
      ),
    ).resolves.toEqual({ errorCode: 'staleTarget' });
  });

  it('maps the canonical Audience summaries returned with a file policy', async () => {
    const getFileDownloadPolicy = vi.fn().mockResolvedValue({
      policy: {
        entityType: TranscodeEntityType.POST,
        entityId: 'post-1',
        blockId: 'block-1',
        referencePath: 'file',
        fileId: 'file-1',
        audience: FileDownloadAudience.RESTRICTED,
        audienceSegments: [
          {
            id: 'audience-1',
            name: 'Members',
            description: 'Registered members',
            segmentType: SegmentType.MEMBERS_BY_FILTER,
          },
        ],
      },
    });
    vi.mocked(createFileClient).mockResolvedValue({ getFileDownloadPolicy } as never);

    await expect(
      getFileDownloadPolicyAction({
        entityType: TranscodeEntityType.POST,
        entityId: 'post-1',
        blockId: 'block-1',
        referencePath: 'file',
        expectedFileId: 'file-1',
      }),
    ).resolves.toEqual({
      data: {
        entityType: TranscodeEntityType.POST,
        entityId: 'post-1',
        blockId: 'block-1',
        referencePath: 'file',
        fileId: 'file-1',
        audience: 'restricted',
        audienceSegments: [
          {
            id: 'audience-1',
            name: 'Members',
            description: 'Registered members',
            segmentType: SegmentType.MEMBERS_BY_FILTER,
          },
        ],
      },
    });
    expect(getFileDownloadPolicy).toHaveBeenCalledWith({
      entityType: TranscodeEntityType.POST,
      entityId: 'post-1',
      blockId: 'block-1',
      referencePath: 'file',
    });
  });

  it.each([
    ['UNSPECIFIED', FileDownloadAudience.UNSPECIFIED],
    ['unknown', 999 as FileDownloadAudience],
  ])('rejects a persisted %s audience instead of normalizing it to disabled', async (_label, audience) => {
    const getFileDownloadPolicy = vi.fn().mockResolvedValue({
      policy: {
        entityType: TranscodeEntityType.POST,
        entityId: 'post-1',
        blockId: 'block-1',
        referencePath: 'file',
        fileId: 'file-1',
        audience,
        audienceSegments: [],
      },
    });
    vi.mocked(createFileClient).mockResolvedValue({ getFileDownloadPolicy } as never);

    await expect(
      getFileDownloadPolicyAction({
        entityType: TranscodeEntityType.POST,
        entityId: 'post-1',
        blockId: 'block-1',
        referencePath: 'file',
        expectedFileId: 'file-1',
      }),
    ).resolves.toEqual({ errorCode: 'loadFailed' });
  });

  it('writes only normalized audienceSegmentIds for restricted policies', async () => {
    const updateFileDownloadPolicy = vi.fn().mockResolvedValue({
      policy: {
        entityType: TranscodeEntityType.POST,
        entityId: 'post-1',
        blockId: 'block-1',
        referencePath: 'file',
        fileId: 'file-1',
        audience: FileDownloadAudience.RESTRICTED,
        audienceSegments: [],
      },
    });
    vi.mocked(createFileClient).mockResolvedValue({ updateFileDownloadPolicy } as never);

    await updateFileDownloadPolicyAction(
      {
        entityType: TranscodeEntityType.POST,
        entityId: 'post-1',
        blockId: 'block-1',
        referencePath: 'file',
        expectedFileId: 'file-1',
      },
      'restricted',
      [' audience-1 ', 'audience-1', 'audience-2'],
    );

    expect(updateFileDownloadPolicy).toHaveBeenCalledWith({
      entityType: TranscodeEntityType.POST,
      entityId: 'post-1',
      blockId: 'block-1',
      referencePath: 'file',
      expectedFileId: 'file-1',
      audience: FileDownloadAudience.RESTRICTED,
      audienceSegmentIds: ['audience-1', 'audience-2'],
    });
  });

  it('persists restricted with no Audience segments as explicit deny-all', async () => {
    const updateFileDownloadPolicy = vi.fn().mockResolvedValue({
      policy: {
        entityType: TranscodeEntityType.POST,
        entityId: 'post-1',
        blockId: 'block-1',
        referencePath: 'file',
        fileId: 'file-1',
        audience: FileDownloadAudience.RESTRICTED,
        audienceSegments: [],
      },
    });
    vi.mocked(createFileClient).mockResolvedValue({ updateFileDownloadPolicy } as never);

    await expect(
      updateFileDownloadPolicyAction(
        {
          entityType: TranscodeEntityType.POST,
          entityId: 'post-1',
          blockId: 'block-1',
          referencePath: 'file',
          expectedFileId: 'file-1',
        },
        'restricted',
        [],
      ),
    ).resolves.toEqual({
      data: {
        entityType: TranscodeEntityType.POST,
        entityId: 'post-1',
        blockId: 'block-1',
        referencePath: 'file',
        fileId: 'file-1',
        audience: 'restricted',
        audienceSegments: [],
      },
    });
    expect(updateFileDownloadPolicy).toHaveBeenCalledWith({
      entityType: TranscodeEntityType.POST,
      entityId: 'post-1',
      blockId: 'block-1',
      referencePath: 'file',
      expectedFileId: 'file-1',
      audience: FileDownloadAudience.RESTRICTED,
      audienceSegmentIds: [],
    });
  });

  it('loads paginated Audience summaries through the author-safe Audience RPC', async () => {
    const listSegmentsForAuthenticatedAccess = vi.fn().mockResolvedValue({
      segments: [
        {
          id: 'audience-51',
          name: 'Audience 51',
          description: '',
          segmentType: SegmentType.MEMBER_TAGS,
        },
      ],
      pagination: { total: 525, hasMore: true },
    });
    vi.mocked(createAudienceClient).mockResolvedValue({
      listSegmentsForAuthenticatedAccess,
    } as never);

    const result = await listAudienceSegmentsForAuthenticatedAccessAction({
      page: 3,
      pageSize: 25,
    });

    expect(listSegmentsForAuthenticatedAccess).toHaveBeenCalledWith({
      pagination: expect.objectContaining({ limit: 25, offset: 50 }),
      filters: [],
    });
    expect(result.data).toEqual(
      expect.objectContaining({
        page: 3,
        pageSize: 25,
        total: 525,
        totalPages: 21,
        hasMore: true,
      }),
    );
    expect(result.data?.items[0]).toEqual({
      id: 'audience-51',
      name: 'Audience 51',
      description: '',
      segmentType: SegmentType.MEMBER_TAGS,
    });
  });

  it('passes normalized server search to the author-safe Audience RPC', async () => {
    const listSegmentsForAuthenticatedAccess = vi.fn().mockResolvedValue({
      segments: [],
      pagination: { total: 0, hasMore: false },
    });
    vi.mocked(createAudienceClient).mockResolvedValue({
      listSegmentsForAuthenticatedAccess,
    } as never);

    await listAudienceSegmentsForAuthenticatedAccessAction({
      page: 2,
      pageSize: 50,
      search: '  Press  ',
    });

    expect(listSegmentsForAuthenticatedAccess).toHaveBeenCalledWith({
      pagination: expect.objectContaining({ limit: 50, offset: 50 }),
      filters: [
        expect.objectContaining({
          field: 'search',
          op: FilterOp.ILIKE,
          value: 'Press',
        }),
      ],
    });
  });
});
