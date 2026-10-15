/** Generate the preview image from the current document values, without a service request. */
export function createLocalOgPreview(title: string, summary: string): string {
  const escape = (value: string) =>
    value.replace(
      /[&<>"']/g,
      (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[char]!,
    );
  const lines = (value: string, width: number, count: number) =>
    Array.from(value).reduce<string[]>((result, char, index) => {
      const line = Math.floor(index / width);
      if (line < count) {
        result[line] = (result[line] ?? '') + char;
      }
      return result;
    }, []);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630"><rect width="1200" height="630" fill="#18181b"/><g fill="#fafafa" font-family="sans-serif"><text x="80" y="100" font-size="24">STORYBOOK · LOCAL DOCUMENT PREVIEW</text>${lines(
    title,
    26,
    3,
  )
    .map(
      (line, index) => `<text x="80" y="${220 + index * 75}" font-size="60" font-weight="700">${escape(line)}</text>`,
    )
    .join('')}${lines(summary, 55, 2)
    .map((line, index) => `<text x="80" y="${490 + index * 40}" font-size="28" fill="#d4d4d8">${escape(line)}</text>`)
    .join('')}</g></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
