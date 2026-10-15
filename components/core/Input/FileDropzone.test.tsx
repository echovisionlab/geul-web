// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FileDropzone, type FileDropzoneProps } from './FileDropzone';
import classes from './Input.module.css';
let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});
function render(props: Partial<FileDropzoneProps> = {}) {
  act(() => root.render(<FileDropzone label="Choose files" icon="+" onFilesSelected={() => {}} {...props} />));
}
function select(files: File[]) {
  const input = container.querySelector<HTMLInputElement>('input[type="file"]')!;
  Object.defineProperty(input, 'files', { configurable: true, value: files });
  act(() => input.dispatchEvent(new Event('change', { bubbles: true })));
  return input;
}
describe('FileDropzone React Aria contract', () => {
  it('keeps the visible picker title in its name and separates file constraints into its description', () => {
    render({ label: 'Recording attachments', title: 'Choose files', description: 'WAV or MP3, up to 10 MB' });
    const button = container.querySelector(`.${classes.dropzoneButton}`)!;
    expect(button).toHaveAccessibleName('Choose files');
    expect(button).toHaveAccessibleDescription('WAV or MP3, up to 10 MB');
    expect(container.querySelector('button[aria-label="Recording attachments"]')).not.toBeNull();
    expect(button.textContent).toBe('+Choose filesWAV or MP3, up to 10 MB');
  });

  it('forwards accepted files and native MIME/extension constraints', () => {
    const onFilesSelected = vi.fn();
    render({ multiple: true, accept: 'audio/wav, .mp3', onFilesSelected });
    const files = [new File(['a'], 'a.wav', { type: 'audio/wav' }), new File(['b'], 'b.mp3', { type: 'audio/mpeg' })];
    const picker = select(files);
    expect(picker.accept.split(',').map((token) => token.trim())).toEqual(['audio/wav', '.mp3']);
    expect(picker.multiple).toBe(true);
    expect(onFilesSelected).toHaveBeenCalledWith(files);
  });
  it('rejects MIME/extension and size violations for native selections', () => {
    const onFilesSelected = vi.fn();
    const onFilesRejected = vi.fn();
    render({ multiple: true, accept: '.wav', maxSize: 2, onFilesSelected, onFilesRejected });
    const wrong = new File(['a'], 'a.txt');
    const large = new File(['abcd'], 'a.wav');
    const valid = new File(['a'], 'b.wav');
    select([wrong, large, valid]);
    expect(onFilesRejected).toHaveBeenCalledWith([
      { file: wrong, reason: 'invalid-type' },
      { file: large, reason: 'too-large' },
    ]);
    expect(onFilesSelected).toHaveBeenCalledWith([valid]);
  });
  it('rejects an oversized selection atomically', () => {
    const onFilesSelected = vi.fn();
    const onFilesRejected = vi.fn();
    render({ multiple: true, maxFiles: 1, onFilesSelected, onFilesRejected });
    const files = [new File(['a'], 'a.wav'), new File(['b'], 'b.wav')];
    select(files);
    expect(onFilesRejected).toHaveBeenCalledWith(files.map((file) => ({ file, reason: 'too-many' })));
    expect(onFilesSelected).not.toHaveBeenCalled();
  });
  it('disables the actual picker trigger and ignores forged selections', () => {
    const onFilesSelected = vi.fn();
    render({ disabled: true, onFilesSelected });
    expect(container.querySelector<HTMLButtonElement>(`.${classes.dropzoneButton}`)?.disabled).toBe(true);
    select([new File(['a'], 'a.wav')]);
    expect(onFilesSelected).not.toHaveBeenCalled();
  });
  it('opens one native picker through the React Aria pressable button', () => {
    render();
    const click = vi.spyOn(HTMLInputElement.prototype, 'click');
    act(() => container.querySelector<HTMLButtonElement>(`.${classes.dropzoneButton}`)?.click());
    expect(click).toHaveBeenCalledTimes(1);
  });
});
