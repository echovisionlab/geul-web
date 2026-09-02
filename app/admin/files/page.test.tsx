import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/features/file-manager', () => ({
  FileManager: ({ viewerRole }: { viewerRole: string }) => <div data-role={viewerRole}>File Manager</div>,
}));

import AdminFilesPage from './page';

describe('AdminFilesPage', () => {
  it('mounts the full manager with Admin capabilities', () => {
    const html = renderToStaticMarkup(<AdminFilesPage />);

    expect(html).toContain('data-role="admin"');
    expect(html).toContain('File Manager');
  });
});
