// @vitest-environment jsdom

import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MantineProvider } from '@mantine/core';
import type { FileRejection } from '@mantine/dropzone';
import { FileDropzone, type FileDropzoneProps, type FileDropzoneRejectionReason } from './FileDropzone';

interface CapturedDropzoneProps {
  children?: ReactNode;
  role?: string;
  'aria-label'?: string;
  'aria-disabled'?: boolean;
  tabIndex?: number;
  accept?: string[];
  multiple?: boolean;
  maxFiles?: number;
  disabled?: boolean;
  activateOnClick?: boolean;
  activateOnKeyboard?: boolean;
  inputProps?: React.InputHTMLAttributes<HTMLInputElement>;
  onClick?: () => void;
  onKeyDown?: (event: React.KeyboardEvent<HTMLDivElement>) => void;
  onDragEnter?: () => void;
  onDragLeave?: (event: React.DragEvent<HTMLDivElement>) => void;
  onDrop: (files: File[]) => void;
  onReject: (rejections: FileRejection[]) => void;
}

const { getDropzoneProps, setDropzoneProps } = vi.hoisted(() => {
  let dropzoneProps: CapturedDropzoneProps | null = null;

  return {
    getDropzoneProps: () => dropzoneProps,
    setDropzoneProps: (value: CapturedDropzoneProps | null) => {
      dropzoneProps = value;
    },
  };
});

vi.mock('@mantine/dropzone', () => ({
  Dropzone: (props: CapturedDropzoneProps) => {
    setDropzoneProps(props);
    return (
      <div
        data-testid="mantine-dropzone"
        role={props.role}
        aria-label={props['aria-label']}
        aria-disabled={props['aria-disabled']}
        tabIndex={props.tabIndex}
        onClick={props.onClick}
        onKeyDown={props.onKeyDown}
        onDragEnter={props.onDragEnter}
        onDragLeave={props.onDragLeave}
      >
        <input data-testid="mantine-dropzone-input" {...props.inputProps} />
        {props.children}
      </div>
    );
  },
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

const baseProps: FileDropzoneProps = {
  label: 'Choose files',
  title: 'Drop files here',
  description: 'Drop files or browse',
  icon: <span aria-hidden="true">+</span>,
  onFilesSelected: vi.fn(),
};

function renderDropzone(props: Partial<FileDropzoneProps> = {}) {
  act(() => {
    root.render(
      <MantineProvider>
        <FileDropzone {...baseProps} {...props} />
      </MantineProvider>,
    );
  });
}

function getPicker() {
  const picker = container.querySelector<HTMLInputElement>('[data-file-dropzone-picker]');
  if (!picker) {
    throw new Error('Expected the native file picker input');
  }
  return picker;
}

function getSurface() {
  const surface = container.querySelector<HTMLDivElement>('[role="button"]');
  if (!surface) {
    throw new Error('Expected the dropzone button surface');
  }
  return surface;
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  setDropzoneProps(null);
  vi.clearAllMocks();
});

describe('FileDropzone', () => {
  it('forwards multiple native selections and preserves the exact native accept value', () => {
    const onFilesSelected = vi.fn();
    const nativeAccept = ' audio/wav, .wav,audio/mpeg,.mp3 ';
    renderDropzone({ accept: nativeAccept, multiple: true, maxFiles: 10, onFilesSelected });

    const picker = getPicker();
    const files = [
      new File(['first'], 'first.wav', { type: 'audio/wav' }),
      new File(['second'], 'second.mp3', { type: 'audio/mpeg' }),
    ];
    Object.defineProperty(picker, 'files', { configurable: true, value: files });

    act(() => picker.dispatchEvent(new Event('change', { bubbles: true })));

    expect(onFilesSelected).toHaveBeenCalledWith(files);
    expect(picker.multiple).toBe(true);
    expect(picker.getAttribute('accept')).toBe(nativeAccept);
    expect(getDropzoneProps()).toMatchObject({
      accept: ['audio/wav', 'audio/mpeg'],
      multiple: true,
      maxFiles: 10,
    });
  });

  it('opens only the native picker from Enter, Space, or a surface click', () => {
    renderDropzone();
    const picker = getPicker();
    const surface = getSurface();
    const click = vi.spyOn(picker, 'click').mockImplementation(() => undefined);

    act(() => surface.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter' })));
    act(() => surface.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: ' ' })));
    act(() => surface.click());

    expect(click).toHaveBeenCalledTimes(3);
    expect(getDropzoneProps()).toMatchObject({ activateOnClick: false, activateOnKeyboard: false });
    expect(container.querySelectorAll('[role="button"][aria-label]').length).toBe(1);
    expect(surface.getAttribute('aria-label')).toBe('Choose files');
    expect(container.textContent).toContain('Drop files here');
    expect(container.querySelector('[data-testid="mantine-dropzone-input"]')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('disables the picker, dropzone, and interactive surface', () => {
    renderDropzone({ disabled: true });
    const picker = getPicker();
    const surface = getSurface();
    const click = vi.spyOn(picker, 'click').mockImplementation(() => undefined);

    act(() => surface.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter' })));
    act(() => surface.click());

    expect(click).not.toHaveBeenCalled();
    expect(picker.disabled).toBe(true);
    expect(surface.getAttribute('aria-disabled')).toBe('true');
    expect(surface.tabIndex).toBe(-1);
    expect(getDropzoneProps()?.disabled).toBe(true);
  });

  it.each([
    ['file-too-large', 'too-large'],
    ['file-invalid-type', 'invalid-type'],
    ['too-many-files', 'too-many'],
    ['custom-policy', 'unknown'],
  ] as const)('maps Dropzone rejection code %s to Core reason %s', (code, reason) => {
    const onFilesRejected = vi.fn<NonNullable<FileDropzoneProps['onFilesRejected']>>();
    renderDropzone({ onFilesRejected });
    const dropzoneProps = getDropzoneProps();
    if (!dropzoneProps) {
      throw new Error('Expected FileDropzone to render Mantine Dropzone');
    }

    const file = new File(['content'], 'file.bin', { type: 'application/octet-stream' });
    act(() => dropzoneProps.onReject([{ file, errors: [{ code, message: code }] }]));

    expect(onFilesRejected).toHaveBeenCalledWith([{ file, reason: reason satisfies FileDropzoneRejectionReason }]);
  });

  it('rejects a native selection above maxFiles before calling the selected handler', () => {
    const onFilesSelected = vi.fn();
    const onFilesRejected = vi.fn<NonNullable<FileDropzoneProps['onFilesRejected']>>();
    renderDropzone({ multiple: true, maxFiles: 1, onFilesSelected, onFilesRejected });
    const picker = getPicker();
    const files = [new File(['one'], 'one.txt'), new File(['two'], 'two.txt')];
    Object.defineProperty(picker, 'files', { configurable: true, value: files });

    act(() => picker.dispatchEvent(new Event('change', { bubbles: true })));

    expect(onFilesSelected).not.toHaveBeenCalled();
    expect(onFilesRejected).toHaveBeenCalledWith(
      files.map((file) => ({ file, reason: 'too-many' satisfies FileDropzoneRejectionReason })),
    );
  });

  it('shows drag-active state only while enabled and dragging', () => {
    renderDropzone();
    const dropzoneProps = getDropzoneProps();
    if (!dropzoneProps) {
      throw new Error('Expected FileDropzone to render Mantine Dropzone');
    }

    expect(container.querySelector('[data-drop-active="true"]')).toBeNull();
    act(() => dropzoneProps.onDragEnter?.());
    expect(container.querySelector('[data-drop-active="true"]')).not.toBeNull();
    act(() =>
      dropzoneProps.onDragLeave?.({
        currentTarget: { contains: () => false },
        relatedTarget: null,
      } as unknown as React.DragEvent<HTMLDivElement>),
    );
    expect(container.querySelector('[data-drop-active="true"]')).toBeNull();
  });
});
