import type { Editor } from '@tiptap/core';
import { TranscodeEntityType } from '@echovisionlab/geul-proto/secure/events_pb.ts';
import { captureInsertPosition } from '@/features/editor/lib/block-insert';
import { createTiptapEditorMediaCommandPort } from '@/features/editor/lib/media-block-updates';
import { insertMediaFilesAtPosition } from '@/features/editor/lib/media-file-insert';
import type { EditorMediaRuntimeStore } from '@/features/editor/lib/editor-media-runtime-store';
/** Browser-only delivery adapter. The canonical production insertion pipeline remains unchanged. */
export async function insertLocalPreviewFiles({
  editor,
  runtimeStore,
  files,
  retainUrl,
  onError,
  onDelivered,
}: {
  editor: Editor;
  runtimeStore: EditorMediaRuntimeStore;
  files: File[];
  retainUrl: (url: string) => void;
  onError: (fileName: string, message: string) => void;
  onDelivered?: (fileId: string, file: File, url: string) => void;
}) {
  const port = createTiptapEditorMediaCommandPort(editor, { runtimeStore });
  await insertMediaFilesAtPosition(
    port,
    files,
    {
      entityType: TranscodeEntityType.POST,
      entityId: '10000000-0000-4000-8000-000000000401',
      upload: async (file) => {
        // Reading bytes is actual local I/O; there is no server upload or fabricated progress.
        if (typeof file.arrayBuffer === 'function') {
          await file.arrayBuffer();
        } else {
          await new Promise<ArrayBuffer>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as ArrayBuffer);
            reader.onerror = () => reject(reader.error);
            reader.readAsArrayBuffer(file);
          });
        }
        const fileId = crypto.randomUUID();
        const url = URL.createObjectURL(file);
        retainUrl(url);
        runtimeStore.patchFile(fileId, {
          fileName: file.name,
          mimeType: file.type || 'application/octet-stream',
          size: String(file.size),
          url,
          processingStatus: 'ready',
        });
        onDelivered?.(fileId, file, url);
        return { fileId, url };
      },
      onUploadStart() {},
      onUploadProgress() {},
      onUploadEnd() {},
      onUploadError: onError,
    },
    captureInsertPosition(port),
  );
}
