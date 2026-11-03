// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@/test/render';
import { ServerDataTableSearch } from './ServerDataTableSearch';
import { ServerDataTableMultiFilter } from './ServerDataTableMultiFilter';
import { ServerDataTableMultiSort } from './ServerDataTableMultiSort';
const chunks = vi.hoisted(() => {
  const releases: Record<string, () => void> = {};
  const gates = Object.fromEntries(
    ['search', 'filter', 'sort'].map((key) => [
      key,
      new Promise<void>((resolve) => {
        releases[key] = resolve;
      }),
    ]),
  );
  return { gates, releases };
});
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/test',
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('./ServerDataTableSearchRuntime', async (original) => {
  await chunks.gates.search;
  return original();
});
vi.mock('./ServerDataTableMultiFilterRuntime', async (original) => {
  await chunks.gates.filter;
  return original();
});
vi.mock('./ServerDataTableMultiSortRuntime', async (original) => {
  await chunks.gates.sort;
  return original();
});
describe('cold client toolbar chunks', () => {
  it.each(['search', 'filter', 'sort'] as const)(
    'keeps a named common control visible while the %s chunk waits',
    async (kind) => {
      render(
        kind === 'search' ? (
          <ServerDataTableSearch namespace="cold" />
        ) : kind === 'filter' ? (
          <ServerDataTableMultiFilter namespace="cold" fields={[]} />
        ) : (
          <ServerDataTableMultiSort namespace="cold" fields={[]} />
        ),
      );
      const role = kind === 'search' ? 'searchbox' : 'button';
      const name = kind === 'search' ? 'Search...' : kind === 'filter' ? 'Filter' : 'Sort';
      const pending = screen.getByRole(role, { name });
      expect(pending).toHaveAttribute('aria-busy', 'true');
      if (kind === 'search') {
        expect(pending).toBeDisabled();
      }
      await act(async () => chunks.releases[kind]());
      await waitFor(() => expect(screen.getByRole(role, { name })).not.toHaveAttribute('aria-busy', 'true'));
    },
  );
});
