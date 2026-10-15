import { describe, expect, it } from 'vitest';
import { FileManagerSortField } from '@echovisionlab/geul-proto/secure/file_pb.ts';
import type { FileManagerFileRow } from '@/lib/actions/file';
import { createLocalFileLibrarySource } from './local-file-library';
describe('local library transport', () => {
  it('uses actual session rows for MIME/query filtering and name/date/size ordering', async () => {
    const row: FileManagerFileRow = {
      kind: 'file',
      id: 'one',
      fileName: 'Zebra',
      extension: 'pdf',
      mimeType: 'application/pdf',
      fileSize: 20,
      createdAt: '2026-10-09T00:00:00Z',
      updatedAt: null,
      usageCount: 1,
    };
    const source = createLocalFileLibrarySource(
      [
        row,
        {
          ...row,
          id: 'two',
          fileName: 'Alpha',
          mimeType: 'image/png',
          extension: 'png',
          fileSize: 10,
          createdAt: '2026-10-10T00:00:00Z',
        },
      ],
      'en',
    );
    expect((await source.list({})).items.map((file) => file.id)).toEqual(['two', 'one']);
    expect(
      (await source.list({ sortField: FileManagerSortField.FILE_SIZE, sortOrder: 'asc' })).items.map((file) => file.id),
    ).toEqual(['two', 'one']);
    expect(
      (await source.list({ sortField: FileManagerSortField.CREATED_AT, sortOrder: 'desc' })).items.map(
        (file) => file.id,
      ),
    ).toEqual(['two', 'one']);
    expect((await source.search({ query: 'ZEB', mimeTypePrefix: 'application/' })).items).toEqual([row]);
    expect((await source.list({ folderId: 'unavailable' })).folderNotFound).toBe(true);
    expect((await createLocalFileLibrarySource([], 'ko').list({})).items).toEqual([]);
  });
});
