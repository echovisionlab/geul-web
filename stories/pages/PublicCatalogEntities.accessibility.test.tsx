// @vitest-environment jsdom
import { expect, it, vi } from 'vitest';
import { render, screen } from '@/test/render';
import { PublicCatalogEntityPreview } from './PublicCatalogEntities.stories';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/preview',
  useSearchParams: () => new URLSearchParams(),
}));

it('names label relationship links and retains its body and section headings', async () => {
  render(<PublicCatalogEntityPreview entity="label" />);
  expect(screen.getByRole('heading', { level: 1, name: 'Quiet Records' })).toBeInTheDocument();
  expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(3);
  for (const link of await screen.findAllByRole('link', { name: 'Night Signals' })) {
    expect(link).toHaveAttribute('href', '/releases/night-signals');
  }
  for (const link of await screen.findAllByRole('link', { name: 'Mina Park' })) {
    expect(link).toHaveAttribute('href', '/artists/mina-park');
  }
  expect(await screen.findByText('Recording and sharing the sound of a place.')).toBeInTheDocument();
});
