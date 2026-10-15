// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { TestProviders } from '@/test/TestProviders';
import { ArtistImageGalleryView } from './ArtistImageGalleryEditor';

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

it('identifies each image command group without changing the gallery heading or command names', () => {
  const onMove = vi.fn();
  const onRemove = vi.fn();
  const onMakePrimary = vi.fn();
  act(() =>
    root.render(
      <TestProviders>
        <ArtistImageGalleryView
          images={[
            { fileId: 'one', url: null, sortOrder: 0, primary: true },
            { fileId: 'two', url: null, sortOrder: 1, primary: false },
          ]}
          saving={false}
          labels={{
            gallery: 'Gallery',
            makePrimary: 'Make primary',
            moveEarlier: 'Move earlier',
            moveLater: 'Move later',
            remove: 'Remove',
          }}
          onMove={onMove}
          onRemove={onRemove}
          onMakePrimary={onMakePrimary}
        />
      </TestProviders>,
    ),
  );
  const rows = container.querySelectorAll('[role="group"]');
  expect(Array.from(rows).map((row) => row.getAttribute('aria-label'))).toEqual(['Gallery 1', 'Gallery 2']);
  expect(container.textContent).toBe('Gallery');
  const firstEarlier = rows[0].querySelector<HTMLButtonElement>('button[aria-label="Move earlier"]')!;
  const secondLater = rows[1].querySelector<HTMLButtonElement>('button[aria-label="Move later"]')!;
  expect(firstEarlier.disabled).toBe(true);
  expect(secondLater.disabled).toBe(true);
  act(() => rows[1].querySelector<HTMLButtonElement>('button[aria-label="Move earlier"]')!.click());
  expect(onMove).toHaveBeenCalledExactlyOnceWith(1, 0);
  act(() => rows[1].querySelector<HTMLButtonElement>('button[aria-label="Make primary"]')!.click());
  expect(onMakePrimary).toHaveBeenCalledExactlyOnceWith('two');
  act(() => rows[0].querySelector<HTMLButtonElement>('button[aria-label="Remove"]')!.click());
  expect(onRemove).toHaveBeenCalledExactlyOnceWith('one');
});
