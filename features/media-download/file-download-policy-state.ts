import { TranscodeEntityType } from '@echovisionlab/geul-proto/secure/events_pb.ts';
import type {
  FileDownloadPolicyModel,
  FileDownloadPolicyObservedState,
  FileDownloadPolicyTarget,
} from '@/lib/types/file-download-access';

export const ACCESS_SCOPE_VALUES = {
  disabled: 'scope:disabled',
  public: 'scope:public',
  authenticated: 'scope:authenticated',
  restricted: 'scope:restricted',
} as const;

type AccessScopeValue = (typeof ACCESS_SCOPE_VALUES)[keyof typeof ACCESS_SCOPE_VALUES];

function isAccessScopeValue(value: string): value is AccessScopeValue {
  return Object.values(ACCESS_SCOPE_VALUES).includes(value as AccessScopeValue);
}

export function policyMatchesTarget(policy: FileDownloadPolicyModel, target: FileDownloadPolicyTarget): boolean {
  return (
    policy.entityType === target.entityType &&
    policy.entityId === target.entityId &&
    policy.blockId === target.blockId &&
    policy.referencePath === target.referencePath &&
    policy.fileId === target.expectedFileId
  );
}

export function policyChangeDocument(target: FileDownloadPolicyTarget): string {
  return `file-policy:${target.expectedFileId}:${target.entityType}:${target.entityId}:${target.blockId ?? ''}:${target.referencePath ?? ''}`;
}

export function policyOwnerDocument(target: FileDownloadPolicyTarget, releaseId?: string): string | null {
  if (target.entityType === TranscodeEntityType.TRACK) {
    return releaseId ? `release:${releaseId}` : null;
  }
  const ownerType = {
    [TranscodeEntityType.POST]: 'post',
    [TranscodeEntityType.PAGE]: 'page',
    [TranscodeEntityType.WORK]: 'work',
    [TranscodeEntityType.PROGRAM_EVENT]: 'program-event',
  }[
    target.entityType as
      TranscodeEntityType.POST | TranscodeEntityType.PAGE | TranscodeEntityType.WORK | TranscodeEntityType.PROGRAM_EVENT
  ];
  return ownerType ? `${ownerType}:${target.entityId}` : null;
}

export function accessSelectionChange(
  selectedValues: string[],
  nextValues: string[],
): FileDownloadPolicyObservedState | null {
  const addedValue = nextValues.find((value) => !selectedValues.includes(value));
  if (addedValue && isAccessScopeValue(addedValue)) {
    if (addedValue === ACCESS_SCOPE_VALUES.restricted) {
      return null;
    }
    const access =
      addedValue === ACCESS_SCOPE_VALUES.disabled
        ? 'disabled'
        : addedValue === ACCESS_SCOPE_VALUES.public
          ? 'public'
          : 'authenticated';
    return { access, memberCriteriaIds: [] };
  }
  const memberCriteriaIds = nextValues.filter((value) => !isAccessScopeValue(value));
  return {
    access: memberCriteriaIds.length === 0 ? 'disabled' : 'restricted',
    memberCriteriaIds,
  };
}
