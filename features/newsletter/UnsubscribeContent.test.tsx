// @vitest-environment jsdom
import { act } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@/test/render';
import en from '@/messages/en.json';
import { UnsubscribeContent } from './UnsubscribeContent';

vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams() }));
vi.mock('@/lib/actions/newsletter', () => ({ unsubscribeNewsletterAction: vi.fn() }));
const unsubscribe = vi.fn();
beforeEach(() => unsubscribe.mockReset());

describe('UnsubscribeContent', () => {
  it('shows the missing-token result without submitting or offering an email form', () => {
    render(<UnsubscribeContent token={null} unsubscribeAction={unsubscribe} />);
    expect(screen.getByText(en.unsubscribe.token.error.title)).toBeVisible();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(unsubscribe).not.toHaveBeenCalled();
  });

  it('submits the signed token and renders success', async () => {
    unsubscribe.mockResolvedValue({ success: true });
    render(<UnsubscribeContent token="signed-token" unsubscribeAction={unsubscribe} />);
    expect(await screen.findByText(en.unsubscribe.token.success.title)).toBeVisible();
    expect(unsubscribe).toHaveBeenCalledWith('signed-token');
  });

  it('shows the new token wait and ignores an older response', async () => {
    let finishFirst!: (value: { success: boolean }) => void;
    let finishSecond!: (value: { success: boolean }) => void;
    unsubscribe
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finishFirst = resolve;
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finishSecond = resolve;
          }),
      );
    const { rerender } = render(<UnsubscribeContent token="first" unsubscribeAction={unsubscribe} />);
    rerender(<UnsubscribeContent token="second" unsubscribeAction={unsubscribe} />);
    await act(async () => finishSecond({ success: true }));
    expect(await screen.findByText(en.unsubscribe.token.success.title)).toBeVisible();
    await act(async () => finishFirst({ success: false }));
    expect(screen.queryByText(en.unsubscribe.token.error.title)).not.toBeInTheDocument();
    rerender(<UnsubscribeContent token="third" unsubscribeAction={() => new Promise(() => {})} />);
    expect(screen.getByRole('status')).toHaveTextContent(en.common.states.loading);
    expect(screen.queryByText(en.unsubscribe.token.success.title)).not.toBeInTheDocument();
  });
});
