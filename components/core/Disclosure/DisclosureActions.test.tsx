// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { Button } from '../Button';
import { IconButton } from '../IconButton';
import { Disclosure } from './Disclosure';
it('keeps sibling actions independent from the disclosure trigger', async () => {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host),
    move = vi.fn();
  try {
    await act(async () =>
      root.render(
        <Disclosure
          label="Scene unit"
          leadingActions={
            <IconButton label="Move first" interaction="drag-handle" onClick={move}>
              +
            </IconButton>
          }
          actions={<Button onClick={move}>Move up</Button>}
        >
          <input aria-label="Name" />
        </Disclosure>,
      ),
    );
    const trigger = host.querySelector<HTMLButtonElement>('button[aria-expanded]')!;
    const action = [...host.querySelectorAll('button')].find((button) => button.textContent?.includes('Move up'))!;
    expect(action.closest('button')).toBe(action);
    expect(trigger.contains(action)).toBe(false);
    const leading = [...host.querySelectorAll('button')].find(
      (button) => button.getAttribute('aria-label') === 'Move first',
    )!;
    expect(trigger.contains(leading)).toBe(false);
    expect(leading.compareDocumentPosition(trigger) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(trigger.lastElementChild?.querySelector('svg')).not.toBeNull();
    await act(async () => leading.click());
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    move.mockClear();
    await act(async () => action.click());
    expect(move).toHaveBeenCalledOnce();
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    await act(async () => trigger.click());
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
  } finally {
    act(() => root.unmount());
    host.remove();
  }
});
