import { TranscodeEntityType } from '@echovisionlab/geul-proto/secure/events_pb.ts';

type TranscodeEntityLike = TranscodeEntityType | string | null | undefined;

const TRANSCODE_ENTITY_NAME_MAP: Record<string, TranscodeEntityType> = {
  POST: TranscodeEntityType.POST,
  PAGE: TranscodeEntityType.PAGE,
  WORK: TranscodeEntityType.WORK,
  PROGRAM_EVENT: TranscodeEntityType.PROGRAM_EVENT,
};

export function normalizeTranscodeEntityType(value: TranscodeEntityLike): TranscodeEntityType | undefined {
  if (typeof value === 'number') {
    return value === TranscodeEntityType.UNSPECIFIED ? undefined : value;
  }

  if (!value) {
    return undefined;
  }

  return TRANSCODE_ENTITY_NAME_MAP[value.trim().toUpperCase()];
}
