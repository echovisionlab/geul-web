import { TranscodeEntityType } from '@echovisionlab/geul-proto/secure/events_pb.ts';
import { describe, expect, it } from 'vitest';
import type { FileDownloadPolicyModel, FileDownloadPolicyTarget } from '@/lib/types/file-download-access';
import { accessSelectionChange, policyMatchesTarget, policyOwnerDocument } from './file-download-policy-state';

const target: FileDownloadPolicyTarget = {
  entityType: TranscodeEntityType.POST,
  entityId: 'entity-1',
  blockId: 'block-1',
  referencePath: 'file',
  expectedFileId: 'file-1',
};
const policy: FileDownloadPolicyModel = {
  entityType: target.entityType,
  entityId: target.entityId,
  blockId: target.blockId,
  referencePath: target.referencePath,
  fileId: target.expectedFileId,
  access: 'public',
  memberCriteria: [],
};

describe('file download policy identity', () => {
  it.each([
    ['exact selector', {}, true],
    ['missing block selector', { blockId: undefined }, false],
    ['missing reference selector', { referencePath: undefined }, false],
    ['another block', { blockId: 'block-2' }, false],
    ['another reference', { referencePath: 'attachment' }, false],
    ['another entity', { entityId: 'entity-2' }, false],
    ['another file', { fileId: 'file-2' }, false],
  ] as const)('accepts only the exact policy relation: %s', (_label, echo, matches) => {
    expect(policyMatchesTarget({ ...policy, ...echo }, target)).toBe(matches);
  });

  it.each([
    [TranscodeEntityType.POST, undefined, 'post:entity-1'],
    [TranscodeEntityType.PAGE, undefined, 'page:entity-1'],
    [TranscodeEntityType.WORK, undefined, 'work:entity-1'],
    [TranscodeEntityType.PROGRAM_EVENT, undefined, 'program-event:entity-1'],
    [TranscodeEntityType.TRACK, 'release-1', 'release:release-1'],
    [TranscodeEntityType.TRACK, undefined, null],
  ] as const)('uses the owning document for entity type %s and release %s', (entityType, releaseId, document) => {
    expect(policyOwnerDocument({ ...target, entityType }, releaseId)).toBe(document);
  });
});

describe('download access selection', () => {
  it.each([
    ['remove the last Access', ['members'], [], { access: 'disabled', memberCriteriaIds: [] }],
    [
      'add an Access',
      ['scope:public'],
      ['scope:public', 'members'],
      { access: 'restricted', memberCriteriaIds: ['members'] },
    ],
    ['choose Public', ['members'], ['members', 'scope:public'], { access: 'public', memberCriteriaIds: [] }],
    [
      'choose signed-in users',
      ['members'],
      ['members', 'scope:authenticated'],
      { access: 'authenticated', memberCriteriaIds: [] },
    ],
    ['choose Disabled', ['members'], ['members', 'scope:disabled'], { access: 'disabled', memberCriteriaIds: [] }],
    ['ignore the restricted placeholder', [], ['scope:restricted'], null],
  ] satisfies Array<[string, string[], string[], { access: string; memberCriteriaIds: string[] } | null]>)(
    '%s',
    (_label, selected, next, expected) => {
      expect(accessSelectionChange(selected, next)).toEqual(expected);
    },
  );
});
