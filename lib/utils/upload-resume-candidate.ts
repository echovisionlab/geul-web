import type { TranscodeEntityType } from '@echovisionlab/geul-proto/secure/events_pb.ts';
import { UploadType } from '@echovisionlab/geul-proto/secure/file_pb.ts';

type FindMultipartUploadCandidateInput = {
  uploadType: UploadType;
  entityId: string;
  entityType?: TranscodeEntityType;
  slotId?: string | undefined;
  expectedCurrentFileId?: string | undefined;
  fileId: string;
  uploadId: string;
};

const RESULT_TTL_MS = 250;

const inFlightLookups = new Map<string, Promise<unknown>>();
const recentResults = new Map<string, { expiresAt: number; value: unknown }>();

export function buildUploadResumeCandidateLookupKey(input: FindMultipartUploadCandidateInput): string {
  return [
    input.uploadType.toString(),
    input.entityId,
    input.entityType?.toString() || '',
    input.slotId || '',
    input.expectedCurrentFileId || '',
    input.fileId,
    input.uploadId,
  ].join(':');
}

export async function findMultipartUploadCandidateShared<T>(
  input: FindMultipartUploadCandidateInput,
  lookup: (input: FindMultipartUploadCandidateInput) => Promise<T>,
): Promise<T> {
  const key = buildUploadResumeCandidateLookupKey(input);
  const now = Date.now();
  const cached = recentResults.get(key);
  if (cached && cached.expiresAt > now) {
    return cached.value as T;
  }

  const inFlight = inFlightLookups.get(key);
  if (inFlight) {
    return inFlight as Promise<T>;
  }

  const request = lookup(input)
    .then((result) => {
      recentResults.set(key, { value: result, expiresAt: Date.now() + RESULT_TTL_MS });
      return result;
    })
    .finally(() => {
      inFlightLookups.delete(key);
    });

  inFlightLookups.set(key, request);
  return request;
}

export function clearMultipartUploadCandidateLookupCache() {
  inFlightLookups.clear();
  recentResults.clear();
}
