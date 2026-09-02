import { AsyncLocalStorage } from 'node:async_hooks';
import { describe, expect, it, vi } from 'vitest';
import { create } from '@bufbuild/protobuf';
import { Code, ConnectError } from '@connectrpc/connect';
import {
  MeshOptimizationCompressionMethod,
  MeshOptimizationProfile,
  TranscodeEntityType,
} from '@echovisionlab/geul-proto/secure/events_pb.ts';
import {
  GenerateMeshOptimizationCandidateResponseSchema,
  ListMeshOptimizationCandidatesResponseSchema,
  MeshOptimizationCandidateSchema,
  MeshOptimizationCandidateStatus,
} from '@echovisionlab/geul-proto/secure/file_pb.ts';
import { createFileClient } from '@/lib/api/server-client';
import { MESH_OPTIMIZATION_METHOD_DRACO } from '@/lib/types/mesh-optimization';
import {
  clearImmersiveSceneMeshOptimizationCandidatesAction,
  generateImmersiveSceneMeshOptimizationCandidateAction,
  isImmersiveSceneMeshOptimizationApiAvailableAction,
  listImmersiveSceneMeshOptimizationCandidatesAction,
  useImmersiveSceneMeshOptimizationCandidateAction,
} from './immersive-scene-optimization';

const meshOptimizationContext = {
  sourceFileId: 'mesh-file',
  entityId: 'page-1',
  entityType: TranscodeEntityType.PAGE,
};

vi.mock('@/lib/api/server-client', () => ({
  createFileClient: vi.fn(),
}));

type FileClient = Awaited<ReturnType<typeof createFileClient>>;
type MeshOptimizationFileClient = Pick<
  FileClient,
  | 'listMeshOptimizationCandidates'
  | 'generateMeshOptimizationCandidate'
  | 'useMeshOptimizationCandidate'
  | 'clearMeshOptimizationCandidates'
>;

const fileClientStore = new AsyncLocalStorage<MeshOptimizationFileClient | Error>();

vi.mocked(createFileClient).mockImplementation(async () => {
  const fileClient = fileClientStore.getStore();
  if (!fileClient) {
    throw new Error('missing mocked file client');
  }
  if (fileClient instanceof Error) {
    throw fileClient;
  }
  return fileClient as FileClient;
});

function createMockFileClient(): MeshOptimizationFileClient {
  return {
    listMeshOptimizationCandidates: vi.fn<FileClient['listMeshOptimizationCandidates']>(),
    generateMeshOptimizationCandidate: vi.fn<FileClient['generateMeshOptimizationCandidate']>(),
    useMeshOptimizationCandidate: vi.fn<FileClient['useMeshOptimizationCandidate']>(),
    clearMeshOptimizationCandidates: vi.fn<FileClient['clearMeshOptimizationCandidates']>(),
  };
}

function withMockFileClient<T>(fileClient: MeshOptimizationFileClient | Error, callback: () => Promise<T>): Promise<T> {
  return fileClientStore.run(fileClient, callback);
}

describe.concurrent('immersive scene mesh optimization actions', () => {
  it('reports API availability when the generated file client can be created', async () => {
    await withMockFileClient(new Error('missing session'), () =>
      expect(isImmersiveSceneMeshOptimizationApiAvailableAction()).resolves.toBe(false),
    );

    await withMockFileClient(createMockFileClient(), () =>
      expect(isImmersiveSceneMeshOptimizationApiAvailableAction()).resolves.toBe(true),
    );
  });

  it('normalizes completed DRACO candidates returned by the file client', async () => {
    const fileClient = createMockFileClient();
    vi.mocked(fileClient.listMeshOptimizationCandidates).mockResolvedValue(
      create(ListMeshOptimizationCandidatesResponseSchema, {
        candidates: [
          create(MeshOptimizationCandidateSchema, {
            id: 'candidate-1',
            sourceFileId: 'mesh-file',
            fileId: 'mesh-file-draco',
            fileName: 'scene.draco.glb',
            delivery: {
              fileId: 'mesh-file-draco',
              fileName: 'scene.draco.glb',
              fileSize: BigInt(1024),
              inline: {
                fileId: 'mesh-file-draco',
                url: '/media/token/mesh-file-draco.glb',
                extension: 'glb',
                mimeType: 'model/gltf-binary',
              },
            },
            originalFileSize: BigInt(4096),
            optimizedFileSize: BigInt(1024),
            method: MeshOptimizationCompressionMethod.DRACO,
            targetRatioPercent: 70,
            status: MeshOptimizationCandidateStatus.READY,
            originalTriangleCount: BigInt(2880),
            optimizedTriangleCount: BigInt(1440),
            originalVertexCount: BigInt(1440),
            optimizedVertexCount: BigInt(720),
          }),
        ],
      }),
    );

    await withMockFileClient(fileClient, () =>
      expect(listImmersiveSceneMeshOptimizationCandidatesAction(meshOptimizationContext)).resolves.toEqual({
        candidates: [
          {
            id: 'candidate-1',
            sourceFileId: 'mesh-file',
            fileId: 'mesh-file-draco',
            url: '/media/token/mesh-file-draco.glb',
            fileName: 'scene.draco.glb',
            fileSize: 1024,
            originalFileSize: 4096,
            method: MESH_OPTIMIZATION_METHOD_DRACO,
            targetRatioPercent: 70,
            status: 'completed',
            triangleCount: 1440,
            vertexCount: 720,
            originalTriangleCount: 2880,
            originalVertexCount: 1440,
            createdAt: undefined,
          },
        ],
      }),
    );
    expect(fileClient.listMeshOptimizationCandidates).toHaveBeenCalledWith({
      ...meshOptimizationContext,
      profile: MeshOptimizationProfile.PARTICLE_MESH_V1,
    });
  });

  it('normalizes failed candidates with error messages without treating output keys as files', async () => {
    const fileClient = createMockFileClient();
    vi.mocked(fileClient.listMeshOptimizationCandidates).mockResolvedValue(
      create(ListMeshOptimizationCandidatesResponseSchema, {
        candidates: [
          create(MeshOptimizationCandidateSchema, {
            id: 'candidate-failed',
            sourceFileId: 'mesh-file',
            method: MeshOptimizationCompressionMethod.DRACO,
            targetRatioPercent: 40,
            status: MeshOptimizationCandidateStatus.FAILED,
            errorMessage: 'mesh optimization publisher is not configured',
          }),
        ],
      }),
    );

    await withMockFileClient(fileClient, () =>
      expect(listImmersiveSceneMeshOptimizationCandidatesAction(meshOptimizationContext)).resolves.toEqual({
        candidates: [
          {
            id: 'candidate-failed',
            sourceFileId: 'mesh-file',
            fileId: '',
            url: '',
            fileName: '',
            fileSize: 0,
            originalFileSize: undefined,
            method: MESH_OPTIMIZATION_METHOD_DRACO,
            targetRatioPercent: 40,
            status: 'failed',
            triangleCount: undefined,
            vertexCount: undefined,
            originalTriangleCount: undefined,
            originalVertexCount: undefined,
            errorMessage: 'mesh optimization publisher is not configured',
            createdAt: undefined,
          },
        ],
      }),
    );
  });

  it('returns empty candidates without an error when list sees a stale source file', async () => {
    const fileClient = createMockFileClient();
    vi.mocked(fileClient.listMeshOptimizationCandidates).mockRejectedValue(
      new ConnectError('source_file not found: mesh-file', Code.NotFound),
    );

    await withMockFileClient(fileClient, () =>
      expect(listImmersiveSceneMeshOptimizationCandidatesAction(meshOptimizationContext)).resolves.toEqual({
        candidates: [],
      }),
    );
  });

  it('keeps unrelated not found errors visible when listing candidates', async () => {
    const fileClient = createMockFileClient();
    vi.mocked(fileClient.listMeshOptimizationCandidates).mockRejectedValue(
      new ConnectError('optimization candidate not found', Code.NotFound),
    );

    await withMockFileClient(fileClient, () =>
      expect(listImmersiveSceneMeshOptimizationCandidatesAction(meshOptimizationContext)).resolves.toEqual({
        candidates: [],
        error: '[not_found] optimization candidate not found',
      }),
    );
  });

  it('pins generation to DRACO and one-percent target mesh ratio increments', async () => {
    const fileClient = createMockFileClient();
    vi.mocked(fileClient.generateMeshOptimizationCandidate).mockResolvedValue(
      create(GenerateMeshOptimizationCandidateResponseSchema, {
        candidate: create(MeshOptimizationCandidateSchema, {
          id: 'candidate-1',
          sourceFileId: 'mesh-file',
          fileId: 'mesh-file-draco',
          fileName: 'scene.draco.glb',
          delivery: {
            fileId: 'mesh-file-draco',
            fileName: 'scene.draco.glb',
            fileSize: BigInt(1024),
            inline: {
              fileId: 'mesh-file-draco',
              url: '/media/token/mesh-file-draco.glb',
              extension: 'glb',
              mimeType: 'model/gltf-binary',
            },
          },
          optimizedFileSize: BigInt(1024),
          method: MeshOptimizationCompressionMethod.DRACO,
          targetRatioPercent: 66,
          status: MeshOptimizationCandidateStatus.READY,
        }),
      }),
    );

    await withMockFileClient(fileClient, () =>
      expect(
        generateImmersiveSceneMeshOptimizationCandidateAction({
          ...meshOptimizationContext,
          method: MESH_OPTIMIZATION_METHOD_DRACO,
          targetRatioPercent: 66,
        }),
      ).resolves.toMatchObject({
        candidate: {
          id: 'candidate-1',
          method: MESH_OPTIMIZATION_METHOD_DRACO,
          targetRatioPercent: 66,
        },
      }),
    );
    expect(fileClient.generateMeshOptimizationCandidate).toHaveBeenCalledWith({
      sourceFileId: 'mesh-file',
      entityId: 'page-1',
      entityType: TranscodeEntityType.PAGE,
      method: MeshOptimizationCompressionMethod.DRACO,
      targetRatioPercent: 66,
      profile: MeshOptimizationProfile.PARTICLE_MESH_V1,
    });
  });

  it('keeps stale source file not found errors visible for mutating actions', async () => {
    const staleSourceFileError = new ConnectError('source_file not found: mesh-file', Code.NotFound);
    const fileClient = createMockFileClient();
    vi.mocked(fileClient.generateMeshOptimizationCandidate).mockRejectedValue(staleSourceFileError);
    vi.mocked(fileClient.useMeshOptimizationCandidate).mockRejectedValue(staleSourceFileError);
    vi.mocked(fileClient.clearMeshOptimizationCandidates).mockRejectedValue(staleSourceFileError);

    await withMockFileClient(fileClient, async () => {
      await expect(
        generateImmersiveSceneMeshOptimizationCandidateAction({
          ...meshOptimizationContext,
          method: MESH_OPTIMIZATION_METHOD_DRACO,
          targetRatioPercent: 70,
        }),
      ).resolves.toEqual({
        error: '[not_found] source_file not found: mesh-file',
      });
      await expect(
        useImmersiveSceneMeshOptimizationCandidateAction({
          ...meshOptimizationContext,
          candidateId: 'candidate-1',
        }),
      ).resolves.toEqual({
        error: '[not_found] source_file not found: mesh-file',
      });
      await expect(
        clearImmersiveSceneMeshOptimizationCandidatesAction({
          ...meshOptimizationContext,
          candidateId: 'candidate-1',
        }),
      ).resolves.toEqual({
        error: '[not_found] source_file not found: mesh-file',
      });
    });
    expect(fileClient.clearMeshOptimizationCandidates).toHaveBeenCalledWith({
      ...meshOptimizationContext,
      candidateId: 'candidate-1',
      profile: MeshOptimizationProfile.PARTICLE_MESH_V1,
    });
  });

  it('hides raw unimplemented RPC messages from optimization action results', async () => {
    const unimplementedError = new ConnectError('[unimplemented] mesh optimization service', Code.Unimplemented);
    const fileClient = createMockFileClient();
    vi.mocked(fileClient.listMeshOptimizationCandidates).mockRejectedValue(unimplementedError);
    vi.mocked(fileClient.generateMeshOptimizationCandidate).mockRejectedValue(unimplementedError);
    vi.mocked(fileClient.useMeshOptimizationCandidate).mockRejectedValue(unimplementedError);
    vi.mocked(fileClient.clearMeshOptimizationCandidates).mockRejectedValue(unimplementedError);

    await withMockFileClient(fileClient, async () => {
      await expect(listImmersiveSceneMeshOptimizationCandidatesAction(meshOptimizationContext)).resolves.toEqual({
        candidates: [],
        error: 'Mesh optimization is not available.',
      });
      await expect(
        generateImmersiveSceneMeshOptimizationCandidateAction({
          ...meshOptimizationContext,
          method: MESH_OPTIMIZATION_METHOD_DRACO,
          targetRatioPercent: 70,
        }),
      ).resolves.toEqual({
        error: 'Mesh optimization is not available.',
      });
      await expect(
        useImmersiveSceneMeshOptimizationCandidateAction({
          ...meshOptimizationContext,
          candidateId: 'candidate-1',
        }),
      ).resolves.toEqual({
        error: 'Mesh optimization is not available.',
      });
      await expect(
        clearImmersiveSceneMeshOptimizationCandidatesAction({
          ...meshOptimizationContext,
          candidateId: 'candidate-1',
        }),
      ).resolves.toEqual({
        error: 'Mesh optimization is not available.',
      });
    });
  });
});
