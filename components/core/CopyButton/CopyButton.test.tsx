// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { I18nProvider } from 'react-aria-components';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CopyButton, copyButtonConfirmationMs, type CopyButtonProps } from './CopyButton';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
const writeText = vi.fn<(text: string) => Promise<void>>();

beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  writeText.mockReset().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
});

function render(props: Partial<CopyButtonProps> = {}) {
  act(() =>
    root.render(
      <I18nProvider locale="en-US">
        <CopyButton value="https://example.com/a" label="Copy URL" copiedLabel="Copied" {...props} />
      </I18nProvider>,
    ),
  );
  return container.querySelector<HTMLButtonElement>('button')!;
}

describe('Core CopyButton', () => {
  it('keeps a stable name, writes the value, confirms with the positive tone and announces success', async () => {
    vi.useFakeTimers();
    const onCopy = vi.fn();
    const button = render({ onCopy, 'data-testid': 'copy' });
    expect(button).toHaveAccessibleName('Copy URL');
    expect(button.dataset.tone).toBe('neutral');
    expect(button.dataset.testid).toBe('copy');
    expect(container.querySelector('[role="status"]')).toBeEmptyDOMElement();

    await act(async () => button.click());
    expect(writeText).toHaveBeenCalledWith('https://example.com/a');
    expect(onCopy).toHaveBeenCalledWith('https://example.com/a');
    expect(button).toHaveAccessibleName('Copy URL');
    expect(button.dataset.tone).toBe('positive');
    expect(button.dataset.copied).toBe('true');
    expect(container.querySelector('[role="status"]')).toHaveTextContent('Copied');

    act(() => vi.advanceTimersByTime(copyButtonConfirmationMs));
    expect(button.dataset.tone).toBe('neutral');
    expect(container.querySelector('[role="status"]')).toBeEmptyDOMElement();
  });

  it('reads a lazy value at press time', async () => {
    let current = 'first';
    const button = render({ value: () => current });
    current = 'second';
    await act(async () => button.click());
    expect(writeText).toHaveBeenCalledWith('second');
  });

  it('reports clipboard failure without confirming', async () => {
    const failure = new Error('denied');
    writeText.mockRejectedValue(failure);
    const onCopy = vi.fn();
    const onCopyError = vi.fn();
    const button = render({ onCopy, onCopyError });
    await act(async () => button.click());
    expect(onCopy).not.toHaveBeenCalled();
    expect(onCopyError).toHaveBeenCalledWith(failure);
    expect(button.dataset.tone).toBe('neutral');
    expect(container.querySelector('[role="status"]')).toBeEmptyDOMElement();
  });

  it('reports an unavailable clipboard API', async () => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });
    const onCopyError = vi.fn();
    const button = render({ onCopyError });
    await act(async () => button.click());
    expect(onCopyError).toHaveBeenCalledOnce();
  });

  it('keeps disabled and described relationships on the actual control', () => {
    const button = render({ disabled: true, 'aria-describedby': 'context' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-describedby', 'context');
  });

  it('rejects blank names', () => {
    expect(() => render({ label: ' ' })).toThrow('nonempty label and copiedLabel');
    expect(() => render({ copiedLabel: '' })).toThrow('nonempty label and copiedLabel');
  });
});
