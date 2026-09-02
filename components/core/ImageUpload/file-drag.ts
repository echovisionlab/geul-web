export function isFileDragTransfer(dataTransfer: DataTransfer | null | undefined): boolean {
  if (!dataTransfer) {
    return false;
  }
  if (dataTransfer.files?.length) {
    return true;
  }
  if (dataTransfer.items && Array.from(dataTransfer.items).some((item) => item.kind === 'file')) {
    return true;
  }
  return Array.from(dataTransfer.types ?? []).includes('Files');
}
