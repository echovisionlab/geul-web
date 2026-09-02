// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { notifications } from '@mantine/notifications';
import { useCopyToClipboard } from './useCopyToClipboard';

vi.mock('@mantine/notifications', () => ({
  notifications: {
    show: vi.fn(),
  },
}));

function CopyButton({ value = 'copy-value' }: { value?: string }) {
  const { copy } = useCopyToClipboard();

  return (
    <button
      type="button"
      onClick={() =>
        copy(value, {
          successMessage: 'Copied',
          errorMessage: 'Copy failed',
        })
      }
    >
      Copy
    </button>
  );
}

describe('useCopyToClipboard', () => {
  let container: HTMLDivElement;
  let root: Root;
  let writeText: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    vi.mocked(notifications.show).mockReset();
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  async function clickCopy() {
    const button = container.querySelector('button');
    expect(button).not.toBeNull();

    await act(async () => {
      button?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });
  }

  it('shows a success notification after a copy succeeds', async () => {
    act(() => {
      root.render(<CopyButton />);
    });

    await clickCopy();

    expect(writeText).toHaveBeenCalledWith('copy-value');
    expect(notifications.show).toHaveBeenCalledWith({
      message: 'Copied',
      color: 'blue',
    });
  });

  it('shows success for repeated copies before the copied timeout resets', async () => {
    act(() => {
      root.render(<CopyButton />);
    });

    await clickCopy();
    await clickCopy();

    expect(writeText).toHaveBeenCalledTimes(2);
    expect(notifications.show).toHaveBeenCalledTimes(2);
  });

  it('shows an error notification when clipboard copy fails', async () => {
    writeText.mockRejectedValueOnce(new Error('denied'));
    act(() => {
      root.render(<CopyButton />);
    });

    await clickCopy();

    expect(notifications.show).toHaveBeenCalledWith({
      message: 'Copy failed',
      color: 'red',
    });
  });
});
