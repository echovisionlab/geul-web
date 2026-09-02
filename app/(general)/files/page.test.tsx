import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  buildLoginRedirectHref: vi.fn(),
  getRequestHeaders: vi.fn(),
  getRequestPathWithSearchFromHeaders: vi.fn(),
  getSession: vi.fn(),
  notFound: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  notFound: mocks.notFound,
  redirect: mocks.redirect,
}));

vi.mock('@/lib/auth/login-page', () => ({
  buildLoginRedirectHref: mocks.buildLoginRedirectHref,
}));

vi.mock('@/lib/utils/header.server', () => ({
  getRequestHeaders: mocks.getRequestHeaders,
}));

vi.mock('@/lib/utils/request-path', () => ({
  getRequestPathWithSearchFromHeaders: mocks.getRequestPathWithSearchFromHeaders,
}));

vi.mock('@/lib/utils/session.server', () => ({
  getSession: mocks.getSession,
}));

import FilesPage from './page';

describe('legacy File Manager route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getRequestHeaders.mockResolvedValue(new Headers());
    mocks.getRequestPathWithSearchFromHeaders.mockReturnValue('/files?view=list');
    mocks.buildLoginRedirectHref.mockReturnValue('/login?returnTo=%2Ffiles%3Fview%3Dlist');
    mocks.notFound.mockImplementation(() => {
      throw new Error('notFound');
    });
    mocks.redirect.mockImplementation((href: string) => {
      throw new Error(`redirect:${href}`);
    });
  });

  it('preserves an anonymous login return path', async () => {
    mocks.getSession.mockResolvedValue(null);

    await expect(FilesPage()).rejects.toThrow('redirect:/login?returnTo=%2Ffiles%3Fview%3Dlist');
    expect(mocks.getRequestPathWithSearchFromHeaders).toHaveBeenCalledWith(expect.any(Headers), '/files');
  });

  it('does not expose the standalone manager to an Author', async () => {
    mocks.getSession.mockResolvedValue({ user: { role: 'author' } });

    await expect(FilesPage()).rejects.toThrow('notFound');
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it('redirects an Admin bookmark to the Site Admin route', async () => {
    mocks.getSession.mockResolvedValue({ user: { role: 'admin' } });

    await expect(FilesPage()).rejects.toThrow('redirect:/admin/files');
    expect(mocks.redirect).toHaveBeenCalledWith('/admin/files');
  });
});
