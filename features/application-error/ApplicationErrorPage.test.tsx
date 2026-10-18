// @vitest-environment jsdom

import { beforeAll, describe, expect, it, vi } from 'vitest';
import koMessages from '@/messages/ko.json';
import { settleInAct } from '@/test/act-wait';
import { render, screen } from '@/test/render';
import { ApplicationErrorPage } from './ApplicationErrorPage';

// The particle visual is a dynamic import; load it once so each render settles inside its own test.
beforeAll(async () => {
  await import('./ErrorCodeParticles');
});

async function renderPage(status: number, retry = vi.fn()) {
  const view = render(<ApplicationErrorPage status={status} onRetry={retry} fullScreen />, {
    locale: 'ko',
    messages: koMessages,
  });
  await settleInAct();
  return view;
}

describe('shared application error surface', () => {
  it.each([
    [404, '페이지를 찾을 수 없습니다'],
    [500, '문제가 발생했습니다'],
  ])('shows the %s status number, its own heading and a way home', async (status, title) => {
    await renderPage(status);

    expect(screen.getByText(String(status))).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: title })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '홈으로 가기' })).toHaveAttribute('href', '/');
  });

  it('preserves a working retry on server failures', async () => {
    const retry = vi.fn();
    const { user } = await renderPage(503, retry);
    await user.click(screen.getByRole('button'));
    expect(retry).toHaveBeenCalledOnce();
  });

  it('provides login for 401 and does not retry denied access', async () => {
    const { rerender } = await renderPage(401);
    expect(screen.getByRole('link', { name: /로그인/ })).toHaveAttribute('href', '/login');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();

    rerender(<ApplicationErrorPage status={403} onRetry={vi.fn()} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /로그인/ })).not.toBeInTheDocument();
  });
});
