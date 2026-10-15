// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import meta from '@/features/auth/ui/VerificationFlowView.stories';
import { TestProviders } from '@/test/TestProviders';

let host: HTMLDivElement;
let root: Root;
const EditableState = meta.render;
beforeEach(() => {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});
function edit(input: HTMLInputElement, value: string) {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}
describe('editable verification stories', () => {
  it('keeps consecutive email edits immediately and accepts external Controls changes', () => {
    act(() =>
      root.render(
        <TestProviders>
          <EditableState {...meta.args} />
        </TestProviders>,
      ),
    );
    const email = host.querySelector<HTMLInputElement>('input[type="email"]')!;
    for (const value of ['t', 'ty', 'typed', 'typed@example.com']) {
      act(() => edit(email, value));
      expect(email.value).toBe(value);
    }
    act(() =>
      root.render(
        <TestProviders>
          <EditableState {...meta.args} email="controls@example.com" />
        </TestProviders>,
      ),
    );
    expect(email.value).toBe('controls@example.com');
  });

  it('supports PIN editing, resend clearing and starting over in the same story', () => {
    act(() =>
      root.render(
        <TestProviders>
          <EditableState {...meta.args} state="sent_email" code="123" />
        </TestProviders>,
      ),
    );
    const inputs = [...host.querySelectorAll<HTMLInputElement>('input')];
    act(() => edit(inputs[1], '9'));
    expect(inputs.map((input) => input.value).join('')).toBe('193');
    act(() => inputs[2].dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true })));
    expect(inputs[2].value).toBe('');
    const button = (label: string) => [...host.querySelectorAll('button')].find((item) => item.textContent === label)!;
    act(() => button(meta.args.labels.code.resend).click());
    expect(inputs.every((input) => input.value === '')).toBe(true);
    act(() => button(meta.args.labels.code.startOver).click());
    expect(host.querySelector('input[type="email"]')).not.toBeNull();
  });
});
