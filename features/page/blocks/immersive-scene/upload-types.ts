import type { TranscodeEntityType } from '@echovisionlab/geul-proto/secure/events_pb.ts';
import type { ImmersiveSceneMeshOptimizationControls } from './MeshOptimizationPanel';

interface ImmersiveSceneUploadOptions {
  entityId?: string;
  entityType?: TranscodeEntityType;
  slotId?: string;
  onProgress?: (progress: { percentage: number }) => void;
}

interface ImmersiveSceneUploadResult {
  url: string;
  fileId: string;
}

export interface ImmersiveSceneUploadControls {
  uploadMeshFile: (file: File, options: ImmersiveSceneUploadOptions) => Promise<ImmersiveSceneUploadResult>;
  uploadTextureFile: (file: File, options: ImmersiveSceneUploadOptions) => Promise<ImmersiveSceneUploadResult>;
  isUploadingMesh: boolean;
  isUploadingTexture: boolean;
  meshAcceptString: string;
  textureAcceptString: string;
  abortMeshUpload: () => void;
  abortTextureUpload: () => void;
  deleteUploadedFile?: (fileId: string) => Promise<{ success?: boolean; error?: string }>;
  meshOptimizationControls?: ImmersiveSceneMeshOptimizationControls;
}
