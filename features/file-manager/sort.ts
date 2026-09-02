import { FileManagerSortField } from '@echovisionlab/geul-proto/secure/file_pb.ts';

export function parseFileBrowserSort(value: string) {
  switch (value) {
    case 'name:desc':
      return { sortField: FileManagerSortField.NAME, sortOrder: 'desc' as const };
    case 'created:desc':
      return { sortField: FileManagerSortField.CREATED_AT, sortOrder: 'desc' as const };
    case 'created:asc':
      return { sortField: FileManagerSortField.CREATED_AT, sortOrder: 'asc' as const };
    case 'size:desc':
      return { sortField: FileManagerSortField.FILE_SIZE, sortOrder: 'desc' as const };
    case 'size:asc':
      return { sortField: FileManagerSortField.FILE_SIZE, sortOrder: 'asc' as const };
    default:
      return { sortField: FileManagerSortField.NAME, sortOrder: 'asc' as const };
  }
}
