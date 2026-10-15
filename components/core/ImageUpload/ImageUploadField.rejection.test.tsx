// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from 'react-aria-components';
import { ImageUploadField, type ImageUploadFieldProps } from './ImageUploadField';
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
function render(props: Partial<ImageUploadFieldProps>) {
  act(() =>
    root.render(
      <I18nProvider locale="en">
        <ImageUploadField
          alt="Preview"
          emptyTitle="Upload"
          preview={{ mode: 'fixed', width: 200, height: 100 }}
          onFileSelect={() => {}}
          {...props}
        />
      </I18nProvider>,
    ),
  );
}
function pick(file: File) {
  const input = host.querySelector<HTMLInputElement>('input[type="file"]')!;
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  act(() => input.dispatchEvent(new Event('change', { bubbles: true })));
}
describe('Image upload content policy', () => {
  it.each([
    ['image.txt', 'text/plain', 10, 'invalid-type', 'file-invalid-type'],
    ['image.png', 'image/png', 100, 'too-large', 'file-too-large'],
  ] as const)('rejects %s from the actual picker before invoking upload', (name, type, size, reason, code) => {
    const onFileSelect = vi.fn(),
      onReject = vi.fn(),
      onValidationReject = vi.fn();
    render({ onFileSelect, onReject, onValidationReject, accept: ['image/png'], maxSize: 50 });
    const file = new File(['x'.repeat(size)], name, { type });
    pick(file);
    expect(onFileSelect).not.toHaveBeenCalled();
    expect(onValidationReject).toHaveBeenCalledWith([{ file, reason }]);
    expect(onReject).toHaveBeenCalledWith([{ file, errors: [{ code, message: reason }] }]);
  });
  it('accepts extensions when a browser omits MIME and ignores selections while disabled', () => {
    const onFileSelect = vi.fn();
    render({ onFileSelect, accept: { 'image/png': ['.png'] } });
    const file = new File(['x'], 'PICTURE.PNG');
    pick(file);
    expect(onFileSelect).toHaveBeenCalledWith(file);
    onFileSelect.mockClear();
    render({ onFileSelect, disabled: true });
    pick(file);
    expect(onFileSelect).not.toHaveBeenCalled();
    expect(host.querySelector('button')?.disabled).toBe(true);
  });
  it('keeps removal separate from the keyboard-operable replacement trigger', () => {
    const onRemove = vi.fn();
    render({ imageUrl: '/image.png', onRemove, removeButtonAriaLabel: 'Remove', dropzoneAriaLabel: 'Replace' });
    const replace = host.querySelector('button[aria-label="Replace"]')!,
      remove = host.querySelector<HTMLButtonElement>('button[aria-label="Remove"]')!;
    expect(replace.contains(remove)).toBe(false);
    act(() => remove.click());
    expect(onRemove).toHaveBeenCalledOnce();
  });
});
