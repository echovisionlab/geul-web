// @vitest-environment jsdom

import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MantineProvider } from '@mantine/core';
import { MyArtistsTableCellView, type MyArtistsTableRowViewModel } from './MyArtistsTableCellView';

const row: MyArtistsTableRowViewModel = {
  id: 'artist-1',
  name: 'Mina Park',
  slugLabel: '/mina-park',
  imageUrl: 'https://cdn.example.com/mina.jpg?w=96',
  avatarFallback: 'M',
  href: '/artists/artist-1?edit=true',
  statusLabel: 'Published',
  createdLabel: '7/4/2026',
};

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function render(node: ReactNode) {
  act(() => {
    root.render(<MantineProvider>{node}</MantineProvider>);
  });
}

describe('MyArtistsTableCellView', () => {
  it('renders only the supplied serializable row display values', () => {
    render(
      <>
        <MyArtistsTableCellView cell="avatar" row={row} />
        <MyArtistsTableCellView cell="name" row={row} />
        <MyArtistsTableCellView cell="status" row={row} />
        <MyArtistsTableCellView cell="created" row={row} />
      </>,
    );

    expect(container.querySelector<HTMLAnchorElement>(`a[href="${row.href}"]`)?.textContent).toBe(row.name);
    expect(container.textContent).toContain(row.slugLabel);
    expect(container.textContent).toContain(row.statusLabel);
    expect(container.textContent).toContain(row.createdLabel);
    expect(container.querySelector<HTMLImageElement>('img')?.src).toContain(row.imageUrl);
  });

  it('omits optional slug and image values without deriving replacements', () => {
    const sparseRow = { ...row, slugLabel: null, imageUrl: null };
    render(
      <>
        <MyArtistsTableCellView cell="avatar" row={sparseRow} />
        <MyArtistsTableCellView cell="name" row={sparseRow} />
      </>,
    );

    expect(container.textContent).not.toContain('/mina-park');
    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toContain('M');
  });
});
