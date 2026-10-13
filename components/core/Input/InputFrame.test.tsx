// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it } from 'vitest';
import { InputFrame, type InputFrameProps } from './InputFrame';

it('hosts a custom editable surface in the shared input chrome without caller styling', () => {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  const hostile = { className: 'local', style: { borderColor: 'red' } } as unknown as InputFrameProps;
  act(() =>
    root.render(
      <InputFrame {...hostile} invalid data-testid="frame">
        <div role="textbox" aria-label="Description" />
      </InputFrame>,
    ),
  );
  const frame = host.querySelector<HTMLElement>('[data-testid="frame"]')!;
  expect(frame.classList.contains('local')).toBe(false);
  expect(frame.getAttribute('style')).toBeNull();
  expect(frame.dataset.invalid).toBe('true');
  expect(frame.querySelector('[data-geul-input-frame]')?.querySelector('[role="textbox"]')).not.toBeNull();
  act(() => root.unmount());
  host.remove();
});
