import { FileManagerSortField } from '@echovisionlab/geul-proto/secure/file_pb.ts';
import type { FileManagerFileRow } from '@/lib/actions/file';
import type { EditorFileLibraryDataSource } from '@/features/editor/components/EditorFileLibraryPicker';
/** Flat local browser-session directory, using the production library transport contract. */
export function createLocalFileLibrarySource(
  files: readonly FileManagerFileRow[],
  locale: string,
): EditorFileLibraryDataSource {
  const read = (input: Parameters<EditorFileLibraryDataSource['list']>[0]) =>
    files
      .filter(
        (file) =>
          !input.folderId &&
          `${file.fileName}.${file.extension}`
            .toLocaleLowerCase(locale)
            .includes((input.query ?? '').toLocaleLowerCase(locale)) &&
          file.mimeType.startsWith(input.mimeTypePrefix ?? ''),
      )
      .sort((left, right) => {
        const direction = input.sortOrder === 'desc' ? -1 : 1;
        if (input.sortField === FileManagerSortField.FILE_SIZE) {
          return direction * (left.fileSize - right.fileSize);
        }
        if (input.sortField === FileManagerSortField.CREATED_AT) {
          return direction * (left.createdAt ?? '').localeCompare(right.createdAt ?? '');
        }
        return (
          direction * `${left.fileName}.${left.extension}`.localeCompare(`${right.fileName}.${right.extension}`, locale)
        );
      });
  return {
    list: async (input) => {
      const items = read(input);
      return { items, total: items.length, folderNotFound: Boolean(input.folderId) };
    },
    search: async (input) => {
      const items = read(input);
      return { items, total: items.length };
    },
  };
}
