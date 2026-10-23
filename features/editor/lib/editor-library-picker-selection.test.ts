import { describe, expect, it } from 'vitest';
import type { FileManagerFileRow } from '@/lib/actions/file';
import { eligibleLibrarySelection, toggleLibraryFileSelection } from './editor-library-picker-selection';

function file(id: string): FileManagerFileRow {
  return {
    kind: 'file',
    id,
    fileName: id,
    extension: 'wav',
    mimeType: 'audio/wav',
    fileSize: 4096,
    createdAt: null,
    updatedAt: null,
    usageCount: 0,
  };
}

const first = file('first');
const second = file('second');
const unavailable = file('unavailable');
const isDisabled = (candidate: FileManagerFileRow) => candidate.id === unavailable.id;

describe('toggleLibraryFileSelection', () => {
  it('picks the activated File alone when only one can be picked', () => {
    expect(toggleLibraryFileSelection([first], second, false)).toEqual([second]);
    expect(toggleLibraryFileSelection([first], first, false)).toEqual([first]);
  });

  it('adds a File in picking order when several can be picked', () => {
    expect(toggleLibraryFileSelection([first], second, true)).toEqual([first, second]);
  });

  it('removes a picked File when several can be picked', () => {
    expect(toggleLibraryFileSelection([first, second], first, true)).toEqual([second]);
  });

  it('leaves the given selection unchanged', () => {
    const current = [first];
    toggleLibraryFileSelection(current, second, true);
    expect(current).toEqual([first]);
  });
});

describe('eligibleLibrarySelection', () => {
  it('drops Files that cannot be picked', () => {
    expect(eligibleLibrarySelection([first, unavailable, second], true, isDisabled)).toEqual([first, second]);
    expect(eligibleLibrarySelection([unavailable], true, isDisabled)).toEqual([]);
  });

  it('keeps only the first available File when one can be picked', () => {
    expect(eligibleLibrarySelection([unavailable, second, first], false, isDisabled)).toEqual([second]);
  });
});
