import type {
  FileDownloadAction,
  FileDownloadAvailability,
  PublicMediaEntityType,
} from '@echovisionlab/geul-proto/public/file_pb.ts';

// Wire values of the `api.open.v1` file download enums for client code. Importing the generated enums
// would also load `file_pb`'s descriptor, its dependencies and the protobuf registry on public view pages.
// `download-wire-values.test.ts` asserts these equal the generated enums.

export const PUBLIC_MEDIA_ENTITY_TYPE = {
  UNSPECIFIED: 0 as PublicMediaEntityType.UNSPECIFIED,
  POST: 1 as PublicMediaEntityType.POST,
  PAGE: 2 as PublicMediaEntityType.PAGE,
  WORK: 3 as PublicMediaEntityType.WORK,
  PROGRAM_EVENT: 4 as PublicMediaEntityType.PROGRAM_EVENT,
  RELEASE: 5 as PublicMediaEntityType.RELEASE,
} as const;

export const FILE_DOWNLOAD_AVAILABILITY = {
  UNSPECIFIED: 0 as FileDownloadAvailability.UNSPECIFIED,
  AVAILABLE: 1 as FileDownloadAvailability.AVAILABLE,
  UNAVAILABLE: 2 as FileDownloadAvailability.UNAVAILABLE,
} as const;

export const FILE_DOWNLOAD_ACTION = {
  UNSPECIFIED: 0 as FileDownloadAction.UNSPECIFIED,
  DOWNLOAD: 1 as FileDownloadAction.DOWNLOAD,
  SIGN_IN: 2 as FileDownloadAction.SIGN_IN,
  NONE: 3 as FileDownloadAction.NONE,
} as const;
