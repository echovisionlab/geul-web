// @vitest-environment jsdom

import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MantineProvider } from '@mantine/core';
import type { FileRejection } from '@mantine/dropzone';
import { ImageUploadField, type ImageUploadFieldProps, type ImageUploadRejectionReason } from './ImageUploadField';

const { getDropzoneProps, setDropzoneProps } = vi.hoisted(() => {
  let dropzoneProps: {
    onReject: (rejections: FileRejection[]) => void;
  } | null = null;

  return {
    getDropzoneProps: () => dropzoneProps,
    setDropzoneProps: (value: typeof dropzoneProps) => {
      dropzoneProps = value;
    },
  };
});

vi.mock('@mantine/dropzone', () => {
  const Dropzone = Object.assign(
    (props: { children?: ReactNode; onReject: (rejections: FileRejection[]) => void }) => {
      setDropzoneProps(props);
      return <div data-testid="dropzone">{props.children}</div>;
    },
    {
      Accept: () => null,
      Reject: () => null,
      Idle: () => null,
    },
  );

  return { Dropzone };
});

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

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
  setDropzoneProps(null);
  vi.clearAllMocks();
});

describe('ImageUploadField rejection boundary', () => {
  it('preserves the legacy onReject FileRejection array and its errors', () => {
    const onReject = vi.fn<NonNullable<ImageUploadFieldProps['onReject']>>();
    const onValidationReject = vi.fn();
    act(() => {
      root.render(
        <MantineProvider>
          <ImageUploadField
            alt="Preview"
            emptyTitle="Upload image"
            preview={{ mode: 'fixed', width: 200, height: 100 }}
            onFileSelect={vi.fn()}
            onReject={onReject}
            onValidationReject={onValidationReject}
          />
        </MantineProvider>,
      );
    });

    const dropzoneProps = getDropzoneProps();
    if (!dropzoneProps) {
      throw new Error('Expected ImageUploadField to render a dropzone');
    }

    const file = new File(['image'], 'image.png', { type: 'image/png' });
    const rejections: FileRejection[] = [
      {
        file,
        errors: [
          { code: 'file-invalid-type', message: 'Unsupported image type' },
          { code: 'custom-policy', message: 'Custom policy failure' },
        ],
      },
    ];
    act(() => dropzoneProps.onReject(rejections));

    expect(onReject).toHaveBeenCalledOnce();
    expect(onReject.mock.calls[0]?.[0]).toBe(rejections);
    expect(onReject.mock.calls[0]?.[0][0]?.errors).toEqual(rejections[0]?.errors);
    expect(onValidationReject).toHaveBeenCalledWith([{ file, reason: 'invalid-type' }]);
  });

  it.each([
    ['file-too-large', 'too-large'],
    ['file-invalid-type', 'invalid-type'],
    ['too-many-files', 'unknown'],
  ] as const)('maps Mantine rejection code %s to the Core reason %s', (code, reason) => {
    const onValidationReject = vi.fn();
    act(() => {
      root.render(
        <MantineProvider>
          <ImageUploadField
            alt="Preview"
            emptyTitle="Upload image"
            preview={{ mode: 'fixed', width: 200, height: 100 }}
            onFileSelect={vi.fn()}
            onValidationReject={onValidationReject}
          />
        </MantineProvider>,
      );
    });

    const dropzoneProps = getDropzoneProps();
    if (!dropzoneProps) {
      throw new Error('Expected ImageUploadField to render a dropzone');
    }

    const file = new File(['image'], 'image.png', { type: 'image/png' });
    act(() => {
      dropzoneProps.onReject([{ file, errors: [{ code, message: code }] }]);
    });

    expect(onValidationReject).toHaveBeenCalledWith([{ file, reason: reason satisfies ImageUploadRejectionReason }]);
  });
});
