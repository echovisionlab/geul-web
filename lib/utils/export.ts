/**
 * Download markdown content as a .md file
 */
export function downloadMarkdown(title: string, markdown: string): void {
  const filename = `${title || 'Untitled'}.md`;
  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
