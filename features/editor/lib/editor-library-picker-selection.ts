import type { FileManagerFileRow } from '@/lib/actions/file';

/** Activating a File picks it alone, or adds or removes it when several Files can be picked. */
export function toggleLibraryFileSelection(
  current: readonly FileManagerFileRow[],
  file: FileManagerFileRow,
  allowMultiple: boolean,
): FileManagerFileRow[] {
  if (!allowMultiple) {
    return [file];
  }
  return current.some((selected) => selected.id === file.id)
    ? current.filter((selected) => selected.id !== file.id)
    : [...current, file];
}

/** The Files that can be picked, limited to the first one unless several can be picked. */
export function eligibleLibrarySelection(
  files: readonly FileManagerFileRow[],
  allowMultiple: boolean,
  isDisabled: (file: FileManagerFileRow) => boolean,
): FileManagerFileRow[] {
  const eligible = files.filter((file) => !isDisabled(file));
  return allowMultiple ? eligible : eligible.slice(0, 1);
}
