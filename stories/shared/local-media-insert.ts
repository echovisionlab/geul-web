import type { Editor } from '@tiptap/core';
import { TranscodeEntityType } from '@echovisionlab/geul-proto/secure/events_pb.ts';
import { captureInsertPosition, insertBlockAtPosition } from '@/features/editor/lib/block-insert';
import { createTiptapEditorMediaCommandPort } from '@/features/editor/lib/media-block-updates';
import { insertMediaFilesAtPosition } from '@/features/editor/lib/media-file-insert';
import type { EditorMediaRuntimeStore } from '@/features/editor/lib/editor-media-runtime-store';
import { UPLOAD_ABORTED_MESSAGE } from '@/lib/upload/failure';
/** Browser-only delivery adapter. The canonical production insertion pipeline remains unchanged. */
export async function insertLocalPreviewFiles({
  editor,
  runtimeStore,
  signal,
  files,
  retainUrl,
  onError,
  onDelivered,
}: {
  editor: Editor;
  runtimeStore: EditorMediaRuntimeStore;
  signal: AbortSignal;
  files: File[];
  retainUrl: (url: string) => void;
  onError: (fileName: string, message: string) => void;
  onDelivered?: (fileId: string, file: File, url: string) => void;
}) {
  const isActive = () => !signal.aborted && !editor.isDestroyed;
  if (!isActive()) return;
  const requireActiveOwner = () => {
    if (!isActive()) throw new Error(UPLOAD_ABORTED_MESSAGE);
  };
  const port = createTiptapEditorMediaCommandPort(editor, { runtimeStore });
  await insertMediaFilesAtPosition(
    port,
    files,
    {
      entityType: TranscodeEntityType.POST,
      entityId: '10000000-0000-4000-8000-000000000401',
      upload: async (file) => {
        requireActiveOwner();
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
        requireActiveOwner();
        const fileId = crypto.randomUUID();
        const url = URL.createObjectURL(file);
        if (!isActive()) {
          URL.revokeObjectURL(url);
          throw new Error(UPLOAD_ABORTED_MESSAGE);
        }
        retainUrl(url);
        requireActiveOwner();
        runtimeStore.patchFile(fileId, {
          fileName: file.name,
          mimeType: file.type || 'application/octet-stream',
          size: String(file.size),
          url,
          processingStatus: 'ready',
        });
        if (isActive()) onDelivered?.(fileId, file, url);
        return { fileId, url };
      },
      insertBlockAtPosition: (block, position) =>
        isActive() ? insertBlockAtPosition(port, block, position) : { ok: false, reason: 'unavailable' },
      onUploadStart() {},
      onUploadProgress() {},
      onUploadEnd() {},
      onUploadError: (fileName, message) => {
        if (isActive()) onError(fileName, message);
      },
    },
    captureInsertPosition(port),
  );
}
