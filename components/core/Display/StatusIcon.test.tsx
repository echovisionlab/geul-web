// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { IconAlertTriangle, IconCheck } from '@tabler/icons-react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { StatusIcon, type StatusIconProps } from './StatusIcon';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});
function render(props: Partial<StatusIconProps> = {}) {
  act(() => root.render(<StatusIcon icon={IconCheck} tone="positive" {...props} />));
  return container.firstElementChild as HTMLElement;
}

describe('Core StatusIcon', () => {
  it('is decorative by default with Core-owned tone and size', () => {
    const glyph = render();
    expect(glyph).toHaveAttribute('aria-hidden', 'true');
    expect(glyph).not.toHaveAttribute('role');
    expect(glyph.dataset.tone).toBe('positive');
    expect(glyph.dataset.size).toBe('sm');
    expect(glyph.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('names a glyph that alone carries a value', () => {
    const glyph = render({ label: 'Yes', icon: IconAlertTriangle, tone: 'danger', size: 'md', id: 'status' });
    expect(glyph).toHaveAttribute('role', 'img');
    expect(glyph).toHaveAccessibleName('Yes');
    expect(glyph).not.toHaveAttribute('aria-hidden');
    expect(glyph).toHaveAttribute('id', 'status');
  });

  it('rejects unsupported tones, sizes and blank names', () => {
    expect(() => render({ tone: 'brand' as 'accent' })).toThrow('Invalid status icon tone');
    expect(() => render({ size: 'xl' as 'lg' })).toThrow('Invalid status icon size');
    expect(() => render({ label: ' ' })).toThrow('nonempty label');
  });
});
