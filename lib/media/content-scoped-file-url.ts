export type ContentScopedFileOwnerType = 'post' | 'page' | 'work' | 'program_event';

export interface ContentScopedFileUrlInput {
  ownerType: ContentScopedFileOwnerType;
  ownerId: string;
  blockId: string;
  fileName: string;
}

export function buildContentScopedFileUrl({
  ownerType,
  ownerId,
  blockId,
  fileName,
}: ContentScopedFileUrlInput): string {
  return `/files/${ownerType}/${encodeURIComponent(ownerId)}/${encodeURIComponent(blockId)}/${encodeURIComponent(fileName)}`;
}
