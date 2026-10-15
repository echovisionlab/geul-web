import type { EditorMediaServices } from '@/features/editor/contexts/EditorMediaServicesContext';
import { createEditorMediaRuntimeStore } from '@/features/editor/lib/editor-media-runtime-store';
import type { FileManagerFileRow } from '@/lib/actions/file';

export type AuthorMediaState = 'ready' | 'upload-error' | 'library-loading' | 'library-error' | 'library-empty';
export const authorRecordingId = '40000000-0000-4000-8000-000000000001';
export const authorRecording: FileManagerFileRow = {
  kind: 'file',
  id: authorRecordingId,
  fileName: 'field-recording',
  extension: 'wav',
  mimeType: 'audio/wav',
  fileSize: 84000,
  folderPath: [],
  createdAt: '2026-10-11T00:00:00Z',
  updatedAt: '2026-10-11T00:00:00Z',
  usageCount: 0,
  inlineUrl: '/storybook-fixtures/media-control-preview.wav',
  downloadUrl: '/storybook-fixtures/media-control-preview.wav',
  durationSeconds: 4,
};

/** Deterministic IO feeds the production validation, dialog, insertion and media renderer. */
export function authorMediaFixture(state: AuthorMediaState): EditorMediaServices {
  let failUpload = state === 'upload-error';
  const stores = new Set<ReturnType<typeof createEditorMediaRuntimeStore>>();
  function seed(
    store: ReturnType<typeof createEditorMediaRuntimeStore>,
    fileId: string,
    fileName: string,
    mimeType: string,
  ) {
    store.patchFile(fileId, {
      fileName,
      mimeType,
      size: '84000',
      duration: '4',
      processingStatus: 'ready',
      url: authorRecording.inlineUrl,
      originalUrl: authorRecording.downloadUrl,
    });
  }
  async function rows() {
    if (state === 'library-loading') {
      return new Promise<FileManagerFileRow[]>(() => {});
    }
    if (state === 'library-error') {
      throw new Error('Fixture file library load failed');
    }
    return state === 'library-empty' ? [] : [authorRecording];
  }
  return {
    createRuntimeStore: () => {
      const store = createEditorMediaRuntimeStore();
      seed(store, authorRecordingId, 'field-recording.wav', 'audio/wav');
      stores.add(store);
      return store;
    },
    library: {
      list: async () => {
        const items = await rows();
        return { items, total: items.length, folderNotFound: false };
      },
      search: async ({ query }) => {
        const found = (await rows()).filter((file) => file.fileName?.includes(query));
        return { items: found, total: found.length };
      },
    },
    upload: async (file, options) => {
      options.onProgress?.({ loaded: 0, total: file.size, percentage: 0, stage: 'uploading' });
      await new Promise((resolve) => setTimeout(resolve, 400));
      options.onProgress?.({ loaded: file.size / 2, total: file.size, percentage: 50, stage: 'uploading' });
      await new Promise((resolve) => setTimeout(resolve, 400));
      if (failUpload) {
        failUpload = false;
        throw new Error('Fixture upload failed; choose the file again to retry.');
      }
      const fileId = '40000000-0000-4000-8000-000000000002';
      for (const store of stores) {
        seed(store, fileId, file.name, file.type);
      }
      options.onProgress?.({ loaded: file.size, total: file.size, percentage: 100, stage: 'finalizing' });
      return { fileId, url: authorRecording.inlineUrl ?? '' };
    },
  };
}
