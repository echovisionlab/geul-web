import {
  FileDownloadAction,
  FileDownloadAvailability,
  PublicMediaEntityType,
} from '@echovisionlab/geul-proto/public/file_pb.ts';
import { FILE_DOWNLOAD_ACTION, FILE_DOWNLOAD_AVAILABILITY, PUBLIC_MEDIA_ENTITY_TYPE } from './download-wire-values';

const members = (generated: object) =>
  Object.fromEntries(Object.entries(generated).filter(([name]) => Number.isNaN(Number(name))));

describe('download wire values', () => {
  it('mirror every generated enum member', () => {
    expect(PUBLIC_MEDIA_ENTITY_TYPE).toEqual(members(PublicMediaEntityType));
    expect(FILE_DOWNLOAD_AVAILABILITY).toEqual(members(FileDownloadAvailability));
    expect(FILE_DOWNLOAD_ACTION).toEqual(members(FileDownloadAction));
  });
});
