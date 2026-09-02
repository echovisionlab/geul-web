// @vitest-environment jsdom

import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PostRowMenu } from './PostRowMenu';

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(),
  republish: vi.fn(),
  showNotification: vi.fn(),
}));

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
vi.mock('@mantine/notifications', () => ({ notifications: { show: mocks.showNotification } }));
vi.mock('@/lib/actions/post', () => ({ republishPostAction: mocks.republish }));
vi.mock('./PostModalContext', () => ({ usePostModal: () => ({ openDelete: vi.fn() }) }));
vi.mock('@/components/core/DataTable', () => ({
  TableRowMenu: ({
    items,
  }: {
    items: Array<{ label: string; href?: string; icon?: ReactNode; onClick?: () => void }>;
  }) => (
    <div>
      {items.map((item) =>
        item.href ? (
          <a key={item.label} href={item.href}>
            {item.label}
          </a>
        ) : (
          <button key={item.label} type="button" onClick={item.onClick}>
            {item.label}
          </button>
        ),
      )}
    </div>
  ),
}));

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.republish.mockResolvedValue({ success: true });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function renderRow(status: string, slug?: string) {
  act(() => {
    root.render(<PostRowMenu post={{ id: 'post-uuid', title: 'Post', slug, status }} />);
  });
}

describe('PostRowMenu', () => {
  it('opens published and archived Posts through the public route', () => {
    renderRow('archived', 'field-notes');
    expect(container.querySelector<HTMLAnchorElement>('a[href="/posts/field-notes"]')).not.toBeNull();
  });

  it('republishes an archived Post', async () => {
    renderRow('archived');

    await act(async () => {
      container.querySelector<HTMLButtonElement>('button')?.click();
    });

    expect(mocks.republish).toHaveBeenCalledWith('post-uuid');
    expect(mocks.refresh).toHaveBeenCalledOnce();
  });

  it('does not expose view or republish actions for a draft Post', () => {
    renderRow('draft');
    expect(container.querySelector('a[href]')).toBeNull();
    expect(container.textContent).not.toContain('statusActions.republish');
  });
});
