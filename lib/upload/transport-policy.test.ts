import { UploadType } from '@echovisionlab/geul-proto/secure/file_pb.ts';
import { describe, expect, it } from 'vitest';

import { usesDirectS3MultipartTransport } from './transport-policy';

describe('multipart upload transport policy', () => {
  it.each([
    UploadType.GENERAL_FILE,
    UploadType.EDITOR_IMAGE,
    UploadType.EDITOR_VIDEO,
    UploadType.EDITOR_AUDIO,
    UploadType.EDITOR_ATTACHMENT,
    UploadType.EDITOR_MESH,
    UploadType.TRACK_AUDIO,
  ])('allows direct S3 only for editor and large media type %s', (uploadType) => {
    expect(usesDirectS3MultipartTransport(uploadType)).toBe(true);
  });

  it.each([
    UploadType.UNSPECIFIED,
    UploadType.USER_AVATAR,
    UploadType.ARTIST_IMAGE,
    UploadType.FEATURED_IMAGE,
    UploadType.WORK_FEATURED_IMAGE,
    UploadType.SERIES_FEATURED_IMAGE,
    UploadType.FORM_FEATURED_IMAGE,
    UploadType.PROGRAM_EVENT_POSTER,
    UploadType.MAP_IMAGE,
    UploadType.RELEASE_ARTWORK,
    UploadType.LABEL_IMAGE,
    UploadType.CLIENT_LOGO,
    UploadType.SITE_LOGO,
    UploadType.SITE_FAVICON,
    UploadType.SITE_LOADER,
    UploadType.SITE_OG_BACKGROUND,
  ])('keeps managed public asset type %s on the authenticated API relay', (uploadType) => {
    expect(usesDirectS3MultipartTransport(uploadType)).toBe(false);
  });
});
