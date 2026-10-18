// @vitest-environment jsdom
import { expect, it, vi } from 'vitest';
import { render, screen, within } from '@/test/render';
import { PublicCatalogEntityPreview } from './PublicCatalogEntities.stories';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/preview',
  useSearchParams: () => new URLSearchParams(),
}));

it('names label relationship links and retains its body and section headings', async () => {
  render(<PublicCatalogEntityPreview entity="label" />);
  expect(screen.getByRole('heading', { level: 1, name: 'Quiet Records' })).toBeInTheDocument();
  const releases = screen.getByRole('heading', { level: 2, name: /^Releases/ });
  const artists = screen.getByRole('heading', { level: 2, name: /^Artists/ });
  expect(releases).toBeVisible();
  expect(artists).toBeVisible();
  expect(screen.queryByRole('heading', { name: 'Description' })).not.toBeInTheDocument();
  // Role queries over the whole document are slow on shared CI runners; each section holds its own links.
  for (const link of await within(screen.getByRole('region', { name: /^Releases/ })).findAllByRole('link', {
    name: 'Night Signals',
  })) {
    expect(link).toHaveAttribute('href', '/releases/night-signals');
  }
  for (const link of await within(screen.getByRole('region', { name: /^Artists/ })).findAllByRole('link', {
    name: 'Mina Park',
  })) {
    expect(link).toHaveAttribute('href', '/artists/mina-park');
  }
  expect(await screen.findByText('Recording and sharing the sound of a place.')).toBeInTheDocument();
});
