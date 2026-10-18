// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PinInput, type PinInputProps } from './PinInput';

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});
function ControlledPin(props: PinInputProps) {
  const [value, setValue] = useState(props.defaultValue ?? '');
  return <PinInput {...props} length={6} value={value} onChange={setValue} />;
}
function digits() {
  return [...host.querySelectorAll<HTMLInputElement>('input')];
}
function inputValue(input: HTMLInputElement, value: string) {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}
describe('Core PIN editing', () => {
  it('names the group and every digit from the unchanged visible label and connects guidance and errors', () => {
    act(() =>
      root.render(
        <PinInput
          label={<span>로그인 코드</span>}
          description="메일에서 확인"
          error="코드가 만료되었습니다"
          required
        />,
      ),
    );
    const group = host.querySelector('[role="group"][data-geul-pin-length]');
    expect(group).toHaveAccessibleName('로그인 코드');
    expect(host.querySelector('label')).toHaveAttribute('for', digits()[0].id);
    for (const [index, input] of digits().entries()) {
      expect(input).toHaveAccessibleName(`로그인 코드 ${index + 1}`);
      expect(input).toHaveAccessibleDescription('메일에서 확인 코드가 만료되었습니다');
      expect(input).toHaveAttribute('aria-invalid', 'true');
      expect(input).toHaveAttribute('aria-required', 'true');
    }
    expect(host.querySelector('label')?.textContent).toBe('로그인 코드');
  });

  it('retains an external label and helper for every digit without rendering duplicate visible copy', () => {
    act(() =>
      root.render(
        <>
          <span id="otp-label">SMS code</span>
          <span id="otp-help">Six digits</span>
          <PinInput length={6} aria-labelledby="otp-label" aria-describedby="otp-help" error />
        </>,
      ),
    );
    for (const [index, input] of digits().entries()) {
      expect(input).toHaveAccessibleName(`SMS code ${index + 1}`);
      expect(input).toHaveAccessibleDescription('Six digits');
      for (const id of input.getAttribute('aria-describedby')?.split(/\s+/) ?? []) {
        expect(document.getElementById(id)).not.toBeNull();
      }
    }
  });

  it('forwards an external invalid state to digits without changing the visual error state', () => {
    act(() => root.render(<PinInput ariaLabel="Login code" aria-invalid aria-describedby="expired-code" />));
    for (const input of digits()) {
      expect(input).toHaveAttribute('aria-invalid', 'true');
      expect(input).toHaveAttribute('aria-describedby', 'expired-code');
    }
    expect(host.querySelector('[data-geul-pin-length]')).not.toHaveAttribute('data-invalid');
    expect(host.querySelectorAll('div[data-invalid]')).toHaveLength(0);
  });

  it('replaces a focused digit, deletes current/previous digits and preserves arrow navigation', () => {
    const completed = vi.fn();
    act(() => root.render(<ControlledPin defaultValue="123" align="center" onComplete={completed} />));
    const inputs = digits();
    act(() => inputs[1].focus());
    expect([inputs[1].selectionStart, inputs[1].selectionEnd]).toEqual([0, 1]);
    act(() => inputValue(inputs[1], '9'));
    expect(inputs.map((input) => input.value)).toEqual(['1', '9', '3', '', '', '']);
    expect(document.activeElement).toBe(inputs[2]);
    act(() =>
      inputs[2].dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true, cancelable: true })),
    );
    expect(inputs[2].value).toBe('');
    act(() =>
      inputs[2].dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true, cancelable: true })),
    );
    expect(inputs[1].value).toBe('');
    expect(document.activeElement).toBe(inputs[1]);
    act(() =>
      inputs[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true })),
    );
    expect(document.activeElement).toBe(inputs[0]);
    expect(completed).not.toHaveBeenCalled();
    expect(host.querySelector('[data-geul-pin-align]')?.getAttribute('data-geul-pin-align')).toBe('center');
  });

  it('accepts a pasted OTP once and submits the exact filtered value', () => {
    const completed = vi.fn();
    act(() => root.render(<ControlledPin onComplete={completed} />));
    const paste = new Event('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(paste, 'clipboardData', { value: { getData: () => '12-34 56' } });
    act(() => digits()[0].dispatchEvent(paste));
    expect(
      digits()
        .map((input) => input.value)
        .join(''),
    ).toBe('123456');
    expect(completed).toHaveBeenCalledExactlyOnceWith('123456');
  });

  it('protects read-only values from editing commands', () => {
    act(() => root.render(<ControlledPin defaultValue="123" readOnly />));
    act(() =>
      digits()[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true, cancelable: true })),
    );
    expect(
      digits()
        .map((input) => input.value)
        .join(''),
    ).toBe('123');
  });

  it('rejects unsupported runtime alignment', () => {
    expect(() => act(() => root.render(<PinInput {...({ align: 'left' } as unknown as PinInputProps)} />))).toThrow(
      'Invalid PIN input alignment',
    );
  });

  it('rejects unsupported runtime lengths rather than opening arbitrary grid geometry', () => {
    expect(() => act(() => root.render(<PinInput {...({ length: 9 } as unknown as PinInputProps)} />))).toThrow(
      'Invalid PIN input length',
    );
  });
});
