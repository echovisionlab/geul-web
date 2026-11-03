import { MemberCriteriaKind } from '@echovisionlab/geul-proto/secure/member_criteria_pb.ts';
import { TranscodeEntityType } from '@echovisionlab/geul-proto/secure/events_pb.ts';
import { FileDownloadAccess } from '@echovisionlab/geul-proto/secure/file_pb.ts';
import { FilterOp } from '@echovisionlab/geul-proto/common/common_pb.ts';
import { Code, ConnectError } from '@connectrpc/connect';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemberCriteriaClient, createFileClient } from '@/lib/api/server-client';
import {
  getFileDownloadPolicyAction,
  listMemberCriteriaForAuthenticatedAccessAction,
  updateFileDownloadPolicyAction,
} from './file-download-access';

vi.mock('@/lib/api/server-client', () => ({
  createMemberCriteriaClient: vi.fn(),
  createFileClient: vi.fn(),
}));

beforeEach(() => {
  vi.mocked(createMemberCriteriaClient).mockReset();
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
    expect(createMemberCriteriaClient).not.toHaveBeenCalled();
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
        { access: 'disabled', memberCriteriaIds: [] },
      ),
    ).resolves.toEqual({ errorCode: 'staleTarget' });
  });

  it('rejects a missing policy baseline before creating the file client', async () => {
    await expect(
      updateFileDownloadPolicyAction(
        {
          entityType: TranscodeEntityType.POST,
          entityId: 'post-1',
          blockId: 'block-1',
          referencePath: 'file',
          expectedFileId: 'file-1',
        },
        'public',
        [],
        undefined as never,
      ),
    ).resolves.toEqual({ errorCode: 'invalidPolicyBaseline' });

    expect(createFileClient).not.toHaveBeenCalled();
  });

  it('maps the canonical Access summaries returned with a file policy', async () => {
    const getFileDownloadPolicy = vi.fn().mockResolvedValue({
      policy: {
        entityType: TranscodeEntityType.POST,
        entityId: 'post-1',
        blockId: 'block-1',
        referencePath: 'file',
        fileId: 'file-1',
        access: FileDownloadAccess.RESTRICTED,
        memberCriteria: [
          {
            id: 'access-1',
            name: 'Members',
            description: 'Registered members',
            kind: MemberCriteriaKind.FILTER,
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
        access: 'restricted',
        memberCriteria: [
          {
            id: 'access-1',
            name: 'Members',
            description: 'Registered members',
            kind: MemberCriteriaKind.FILTER,
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
    ['UNSPECIFIED', FileDownloadAccess.UNSPECIFIED],
    ['unknown', 999 as FileDownloadAccess],
  ])('rejects a persisted %s access instead of normalizing it to disabled', async (_label, access) => {
    const getFileDownloadPolicy = vi.fn().mockResolvedValue({
      policy: {
        entityType: TranscodeEntityType.POST,
        entityId: 'post-1',
        blockId: 'block-1',
        referencePath: 'file',
        fileId: 'file-1',
        access,
        memberCriteria: [],
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

  it('writes only normalized memberCriteriaIds for restricted policies', async () => {
    const updateFileDownloadPolicy = vi.fn().mockResolvedValue({
      policy: {
        entityType: TranscodeEntityType.POST,
        entityId: 'post-1',
        blockId: 'block-1',
        referencePath: 'file',
        fileId: 'file-1',
        access: FileDownloadAccess.RESTRICTED,
        memberCriteria: [],
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
      [' access-1 ', 'access-1', 'access-2'],
      { access: 'public', memberCriteriaIds: ['access-0', ' access-0 '] },
    );

    expect(updateFileDownloadPolicy).toHaveBeenCalledWith({
      entityType: TranscodeEntityType.POST,
      entityId: 'post-1',
      blockId: 'block-1',
      referencePath: 'file',
      expectedFileId: 'file-1',
      access: FileDownloadAccess.RESTRICTED,
      memberCriteriaIds: ['access-1', 'access-2'],
      observedPolicy: {
        access: FileDownloadAccess.PUBLIC,
        memberCriteriaIds: ['access-0'],
      },
    });
  });

  it('persists restricted with no Access criteriaList as explicit deny-all', async () => {
    const updateFileDownloadPolicy = vi.fn().mockResolvedValue({
      policy: {
        entityType: TranscodeEntityType.POST,
        entityId: 'post-1',
        blockId: 'block-1',
        referencePath: 'file',
        fileId: 'file-1',
        access: FileDownloadAccess.RESTRICTED,
        memberCriteria: [],
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
        { access: 'disabled', memberCriteriaIds: [] },
      ),
    ).resolves.toEqual({
      data: {
        entityType: TranscodeEntityType.POST,
        entityId: 'post-1',
        blockId: 'block-1',
        referencePath: 'file',
        fileId: 'file-1',
        access: 'restricted',
        memberCriteria: [],
      },
    });
    expect(updateFileDownloadPolicy).toHaveBeenCalledWith({
      entityType: TranscodeEntityType.POST,
      entityId: 'post-1',
      blockId: 'block-1',
      referencePath: 'file',
      expectedFileId: 'file-1',
      access: FileDownloadAccess.RESTRICTED,
      memberCriteriaIds: [],
      observedPolicy: {
        access: FileDownloadAccess.DISABLED,
        memberCriteriaIds: [],
      },
    });
  });

  it('loads paginated Access summaries through the author-safe Access RPC', async () => {
    const listMemberCriteriaForAuthenticatedAccess = vi.fn().mockResolvedValue({
      memberCriteria: [
        {
          id: 'access-51',
          name: 'Access 51',
          description: '',
          kind: MemberCriteriaKind.MEMBER_TAGS,
        },
      ],
      pagination: { total: 525, hasMore: true },
    });
    vi.mocked(createMemberCriteriaClient).mockResolvedValue({
      listMemberCriteriaForAuthenticatedAccess,
    } as never);

    const result = await listMemberCriteriaForAuthenticatedAccessAction({
      page: 3,
      pageSize: 25,
    });

    expect(listMemberCriteriaForAuthenticatedAccess).toHaveBeenCalledWith({
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
      id: 'access-51',
      name: 'Access 51',
      description: '',
      kind: MemberCriteriaKind.MEMBER_TAGS,
    });
  });

  it('passes normalized server search to the author-safe Access RPC', async () => {
    const listMemberCriteriaForAuthenticatedAccess = vi.fn().mockResolvedValue({
      memberCriteria: [],
      pagination: { total: 0, hasMore: false },
    });
    vi.mocked(createMemberCriteriaClient).mockResolvedValue({
      listMemberCriteriaForAuthenticatedAccess,
    } as never);

    await listMemberCriteriaForAuthenticatedAccessAction({
      page: 2,
      pageSize: 50,
      search: '  Press  ',
    });

    expect(listMemberCriteriaForAuthenticatedAccess).toHaveBeenCalledWith({
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
