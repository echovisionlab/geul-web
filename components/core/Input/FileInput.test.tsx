// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FileInput } from './FileInput';

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

describe('FileInput accessible selection', () => {
  it('separates field name, displayed value, help and invalid state without changing visible copy', () => {
    const selected = new File(['sample'], 'recording.wav', { type: 'audio/wav' });
    act(() =>
      root.render(
        <FileInput label="Attachment" value={selected} description="WAV or MP3" error="File is too large" required />,
      ),
    );
    const button = host.querySelector('button')!;
    expect(button).toHaveAccessibleName('Attachment recording.wav');
    expect(button).toHaveAccessibleDescription('WAV or MP3 File is too large');
    expect(host.querySelector('[role="group"]')).toHaveAccessibleDescription('WAV or MP3 File is too large');
    expect(button).not.toHaveAttribute('aria-invalid');
    expect(button).not.toHaveAttribute('aria-required');
    expect(button.textContent).toBe('recording.wav');
    expect(host.querySelector('label')?.textContent).toBe('Attachment');
  });

  it('retains an external field label and skips missing boolean-error references', () => {
    act(() =>
      root.render(
        <>
          <span id="file-label">Recording</span>
          <span id="file-help">Audio files only</span>
          <FileInput aria-labelledby="file-label" aria-describedby="file-help" placeholder="Choose file" error />
        </>,
      ),
    );
    const button = host.querySelector('button')!;
    expect(button).toHaveAccessibleName('Recording Choose file');
    expect(button).toHaveAccessibleDescription('Audio files only');
    expect(button).toHaveAttribute('aria-describedby', 'file-help');
  });

  it('updates the displayed filename after a native selection and clears it through the accessible action', () => {
    const changed = vi.fn();
    act(() => root.render(<FileInput label="Attachment" clearable onChange={changed} />));
    const picker = host.querySelector<HTMLInputElement>('input[type="file"]')!;
    const file = new File(['sample'], 'recording.wav');
    Object.defineProperty(picker, 'files', { value: [file], configurable: true });
    act(() => picker.dispatchEvent(new Event('change', { bubbles: true })));
    expect(host.querySelector('button')).toHaveAccessibleName('Attachment recording.wav');
    act(() => host.querySelectorAll<HTMLButtonElement>('button')[1].click());
    expect(changed).toHaveBeenLastCalledWith(null);
    expect(host.querySelector('button')).toHaveAccessibleName('Attachment');
    expect(host.querySelector('button')?.textContent).toBe('Attachment');
  });
});
