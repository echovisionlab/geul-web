import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { AdminShellViewProps } from '@/features/admin/ui/AdminShell';

const mocks = vi.hoisted(() => ({
  viewProps: null as AdminShellViewProps | null,
}));

vi.mock('next-intl', () => {
  const translate = (key: string) => key;
  return { useTranslations: () => translate };
});

vi.mock('next/navigation', () => ({
  usePathname: () => '/admin/posts',
}));

vi.mock('@/lib/providers/DesignSystemProvider', () => ({
  useComputedColorScheme: () => 'light',
  useColorScheme: () => ({ computedColorScheme: 'light', toggleColorScheme: () => {} }),
}));

vi.mock('@mantine/hooks', () => ({
  useMediaQuery: () => true,
  useMounted: () => true,
}));

vi.mock('@/features/site/SiteLogo', () => ({
  SiteLogo: () => null,
}));

vi.mock('@/features/admin/ui/AdminShell', () => ({
  AdminShellView: (props: AdminShellViewProps) => {
    mocks.viewProps = props;
    return props.children;
  },
}));

import { AdminShell } from './AdminShell';

describe('AdminShell navigation', () => {
  it('does not prefetch the server-rendered Member administration response', () => {
    renderToStaticMarkup(
      <AdminShell>
        <main>Admin content</main>
      </AdminShell>,
    );

    const memberAdministration = mocks.viewProps?.navSections
      .flatMap((section) => section.items)
      .find((item) => item.href === '/admin/users');

    expect(memberAdministration?.prefetch).toBe(false);
  });
});
