// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@/test/render';
import { TiptapEmojiPicker } from './TiptapEmojiPicker';
const mocks = vi.hoisted(() => ({ load: vi.fn() }));
vi.mock('./emoji-runtime', () => ({
  loadTiptapEmojiData: mocks.load,
  getTiptapEmojiData: () => null,
  subscribeTiptapEmojiData: () => () => undefined,
}));

describe('Emoji picker chunk wait', () => {
  it('keeps a visible, dismissible loading surface and retries a failed chunk without a false empty result', async () => {
    let fail!: (error: Error) => void;
    let failRetry!: (error: Error) => void;
    mocks.load
      .mockReturnValueOnce(
        new Promise((_resolve, reject) => {
          fail = reject;
        }),
      )
      .mockReturnValueOnce(
        new Promise((_resolve, reject) => {
          failRetry = reject;
        }),
      );
    const onClose = vi.fn();
    const props = {
      opened: true,
      title: 'Emoji',
      searchPlaceholder: 'Search Emoji',
      noResults: 'No Emoji found',
      closeLabel: 'Close',
      onClose,
      onSelect: vi.fn(),
    };
    const { user, rerender } = render(<TiptapEmojiPicker {...props} />);
    expect(screen.getByRole('status', { name: 'Loading...' })).toHaveTextContent('Loading...');
    expect(screen.queryByText(props.noResults)).not.toBeInTheDocument();
    await act(async () => fail(new Error('chunk failed')));
    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong. Please try again.');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(screen.getByRole('status', { name: 'Loading...' })).toHaveTextContent('Loading...');
    expect(mocks.load).toHaveBeenCalledTimes(2);
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledOnce();
    rerender(<TiptapEmojiPicker {...props} opened={false} />);
    await act(async () => failRetry(new Error('late failure')));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(props.onSelect).not.toHaveBeenCalled();
  });
});
