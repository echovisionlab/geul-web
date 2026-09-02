import { ReleaseType } from '@echovisionlab/geul-proto/secure/release_pb.ts';
import { ReleaseType as PublicReleaseType } from '@echovisionlab/geul-proto/public/release_pb.ts';
import type { ReleaseType as ReleaseTypeValue } from '@/lib/types/release/model';

export function releaseTypeToString(type: ReleaseType): ReleaseTypeValue {
  switch (type) {
    case ReleaseType.EP:
      return 'ep';
    case ReleaseType.SINGLE:
      return 'single';
    case ReleaseType.COMPILATION:
      return 'compilation';
    default:
      return 'album';
  }
}

export function stringToReleaseType(type?: string): ReleaseType {
  switch (type) {
    case 'album':
      return ReleaseType.ALBUM;
    case 'ep':
      return ReleaseType.EP;
    case 'single':
      return ReleaseType.SINGLE;
    case 'compilation':
      return ReleaseType.COMPILATION;
    default:
      return ReleaseType.UNSPECIFIED;
  }
}

export function stringToPublicReleaseType(type?: string): PublicReleaseType {
  switch (type) {
    case 'album':
      return PublicReleaseType.ALBUM;
    case 'ep':
      return PublicReleaseType.EP;
    case 'single':
      return PublicReleaseType.SINGLE;
    case 'compilation':
      return PublicReleaseType.COMPILATION;
    default:
      return PublicReleaseType.UNSPECIFIED;
  }
}

export function publicReleaseTypeToString(type: PublicReleaseType): ReleaseTypeValue {
  switch (type) {
    case PublicReleaseType.EP:
      return 'ep';
    case PublicReleaseType.SINGLE:
      return 'single';
    case PublicReleaseType.COMPILATION:
      return 'compilation';
    default:
      return 'album';
  }
}
