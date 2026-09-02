import { UploadType } from '@echovisionlab/geul-proto/secure/file_pb.ts';

const DIRECT_S3_UPLOAD_TYPES = new Set<UploadType>([
  UploadType.GENERAL_FILE,
  UploadType.EDITOR_IMAGE,
  UploadType.EDITOR_VIDEO,
  UploadType.EDITOR_AUDIO,
  UploadType.EDITOR_ATTACHMENT,
  UploadType.EDITOR_MESH,
  UploadType.TRACK_AUDIO,
]);

export function usesDirectS3MultipartTransport(uploadType: UploadType): boolean {
  return DIRECT_S3_UPLOAD_TYPES.has(uploadType);
}
