// @vitest-environment jsdom

import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PageRowMenu } from './PageRowMenu';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock('@/features/admin/cms-page/PageModalContext', () => ({
  usePageModal: () => ({ openDelete: vi.fn() }),
}));

vi.mock('@/components/core/DataTable', () => ({
  TableRowMenu: ({ items }: { items: Array<{ label: string; href?: string; icon?: ReactNode }> }) => (
    <div>
      {items.map((item) => (
        <a key={item.label} href={item.href}>
          {item.label}
        </a>
      ))}
    </div>
  ),
}));

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

function renderRow(slug: string | null, status = 'published') {
  act(() => {
    root.render(<PageRowMenu page={{ id: 'page-uuid', title: 'Page', slug, status }} />);
  });
}

describe('PageRowMenu', () => {
  it('links a published Page through its slug when present', () => {
    renderRow('about');
    expect(container.querySelector<HTMLAnchorElement>('a[href="/about"]')).not.toBeNull();
  });

  it('preserves nested Page route separators', () => {
    renderRow('some/where');
    expect(container.querySelector<HTMLAnchorElement>('a[href="/some/where"]')).not.toBeNull();
  });

  it('links a slugless published Page through its UUID', () => {
    renderRow(null);
    expect(container.querySelector<HTMLAnchorElement>('a[href="/page-uuid"]')).not.toBeNull();
  });

  it('does not expose a public view action for a draft Page', () => {
    renderRow(null, 'draft');
    expect(container.querySelector('a[href]')).toBeNull();
  });
});
