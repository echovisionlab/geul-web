// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it } from 'vitest';
import { Button } from './Button';
import { TextButton } from './TextButton';
import { DropdownMenu } from './DropdownMenu';

it('places opening indicators after labels and consumes the real menu expanded state', async () => {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  try {
    await act(async () =>
      root.render(
        <>
          <DropdownMenu>
            <DropdownMenu.Target>
              <Button indicator="menu">Options</Button>
            </DropdownMenu.Target>
            <DropdownMenu.Dropdown>
              <DropdownMenu.Item>Rename</DropdownMenu.Item>
            </DropdownMenu.Dropdown>
          </DropdownMenu>
          <TextButton indicator="disclosure" aria-expanded={false}>
            Details
          </TextButton>
        </>,
      ),
    );
    const buttons = host.querySelectorAll('button');
    for (const button of buttons) {
      const indicator = button.querySelector('[data-control-indicator]')!;
      expect(indicator.getAttribute('aria-hidden')).toBe('true');
      const label = [...button.querySelectorAll('span')].find((span) => span.textContent === button.textContent)!;
      expect(label.compareDocumentPosition(indicator) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
    expect(buttons[0].getAttribute('aria-expanded')).toBe('false');
    await act(async () => buttons[0].click());
    expect(buttons[0].getAttribute('aria-expanded')).toBe('true');
  } finally {
    act(() => root.unmount());
    host.remove();
  }
});
