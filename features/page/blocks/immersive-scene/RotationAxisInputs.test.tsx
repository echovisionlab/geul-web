// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MantineProvider } from '@mantine/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RotationAxisInputs } from './RotationAxisInputs';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function render(onChange = vi.fn()) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(
      <MantineProvider>
        <RotationAxisInputs
          label="Rotation speed"
          description="Blank inherits the scene value."
          values={{ x: '0', y: undefined, z: '-0.2' }}
          placeholders={{ x: '0.1', y: '0.2', z: '0.3' }}
          min={-2}
          max={2}
          step={0.1}
          testId="rotation-axes"
          onChange={onChange}
        />
      </MantineProvider>,
    );
  });
  return { container, root, onChange };
}

afterEach(() => {
  document.body.replaceChildren();
});

describe('RotationAxisInputs', () => {
  it('renders one compact Core number input per axis with inherited placeholders', () => {
    const { container, root } = render();

    expect(container.querySelectorAll('input')).toHaveLength(3);
    expect(container.querySelector<HTMLInputElement>('input[aria-label="Rotation speed X"]')?.value).toBe('0');
    expect(container.querySelector<HTMLInputElement>('input[aria-label="Rotation speed Y"]')?.placeholder).toBe('0.2');
    expect(container.textContent).toContain('Blank inherits the scene value.');

    act(() => root.unmount());
  });

  it('projects a cleared field as an inherited undefined value', () => {
    const { container, root, onChange } = render();
    const input = container.querySelector<HTMLInputElement>('input[aria-label="Rotation speed Z"]');

    act(() => {
      input?.focus();
      const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      valueSetter?.call(input, '');
      input?.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'deleteContentBackward', data: null }));
    });

    expect(onChange).toHaveBeenCalledWith('z', undefined);
    act(() => root.unmount());
  });
});
