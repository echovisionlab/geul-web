// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TestProviders } from '@/test/TestProviders';
import { ArtistWorkSection } from './ArtistWorkSection';
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), prefetch: vi.fn() }) }));
let host: HTMLDivElement;
let root: Root;
afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
});
describe('artist works search', () => {
  it('names the search independently of its placeholder, identifies its collection and filters without focus loss', async () => {
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
    await act(async () =>
      root.render(
        <TestProviders>
          <ArtistWorkSection
            works={[
              { id: 'night', slug: 'night', title: 'Night Signals', type: 'music_project', featured_image_url: null },
              { id: 'quiet', slug: 'quiet', title: 'Quiet Room', type: 'portfolio', featured_image_url: null },
            ]}
          />
        </TestProviders>,
      ),
    );
    const input = host.querySelector<HTMLInputElement>('input')!;
    expect(input).toHaveAttribute('aria-label', 'Search...');
    const collection = document.getElementById(input.getAttribute('aria-describedby')!);
    expect(collection).toHaveTextContent('Works');
    expect(collection).toHaveAttribute('role', 'heading');
    expect(collection).toHaveAttribute('aria-level', '2');
    act(() => input.focus());
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, 'Night');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(host.querySelector('a[href="/works/night"]')).not.toBeNull();
    expect(host.querySelector('a[href="/works/quiet"]')).toBeNull();
    expect(document.activeElement).toBe(input);
  });
});
