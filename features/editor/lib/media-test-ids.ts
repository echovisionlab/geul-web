export type EditorMediaTestBlockType = 'file';
export type EditorBodyEntityKind = 'post' | 'page' | 'work' | 'program_event';

function buildMediaId(prefix: string, blockType: EditorMediaTestBlockType, blockId: string): string {
  return `${prefix}-${blockType}-${blockId}`;
}

export function getEditorMediaEmptySurfaceId(blockType: EditorMediaTestBlockType, blockId: string): string {
  return buildMediaId('editor-media-empty', blockType, blockId);
}

export function getEditorMediaProcessingSurfaceId(blockType: EditorMediaTestBlockType, blockId: string): string {
  return buildMediaId('editor-media-processing', blockType, blockId);
}

export function getEditorMediaFailedSurfaceId(blockType: EditorMediaTestBlockType, blockId: string): string {
  return buildMediaId('editor-media-failed', blockType, blockId);
}

export function getEditorMediaResumeActionId(blockType: EditorMediaTestBlockType, blockId: string): string {
  return buildMediaId('editor-media-resume-action', blockType, blockId);
}

export function getEditorMediaCancelActionId(blockType: EditorMediaTestBlockType, blockId: string): string {
  return buildMediaId('editor-media-cancel-action', blockType, blockId);
}

export function getEditorMediaIngestDialogId(blockType: EditorMediaTestBlockType, blockId: string): string {
  return buildMediaId('editor-media-ingest-dialog', blockType, blockId);
}

export function getEditorMediaIngestFileInputId(blockType: EditorMediaTestBlockType, blockId: string): string {
  return buildMediaId('editor-media-ingest-file-input', blockType, blockId);
}

export function getEditorMediaIngestBrowseButtonId(blockType: EditorMediaTestBlockType, blockId: string): string {
  return buildMediaId('editor-media-ingest-browse', blockType, blockId);
}

function buildEditorBodyId(prefix: string, entityKind: EditorBodyEntityKind, entityId: string): string {
  return `${prefix}-${entityKind}-${entityId}`;
}

export function getEditorBodyReadyId(entityKind: EditorBodyEntityKind, entityId: string): string {
  return buildEditorBodyId('editor-body-ready', entityKind, entityId);
}

export function getEditorBodyLoadingId(entityKind: EditorBodyEntityKind, entityId: string): string {
  return buildEditorBodyId('editor-body-loading', entityKind, entityId);
}
