// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MantineProvider } from '@mantine/core';
import { ProfileAvatarControl, type ProfileAvatarControlProps } from './ProfileAvatarControl';

vi.mock('@/components/core/ImageCropper', () => ({
  ImageCropper: ({ onCrop }: { onCrop: (blob: Blob) => Promise<boolean> }) => (
    <button type="button" data-testid="complete-crop" onClick={() => void onCrop(new Blob(['crop']))}>
      Complete crop
    </button>
  ),
}));

const labels = {
  alt: 'Profile image',
  upload: 'Upload profile image',
  change: 'Change profile image',
  remove: 'Remove profile image',
  cropTitle: 'Crop profile image',
  cropPreview: 'Profile image crop preview',
  cancel: 'Cancel',
  confirm: 'Confirm',
  preparing: 'Preparing image',
};

const baseProps: ProfileAvatarControlProps = {
  imageUrl: null,
  accept: ['image/png'],
  maxSize: 20 * 1024 * 1024,
  labels,
  onSave: vi.fn(async () => true),
};

let container: HTMLDivElement;
let root: Root;

function renderControl(props: Partial<ProfileAvatarControlProps> = {}) {
  act(() => {
    root.render(
      <MantineProvider>
        <ProfileAvatarControl {...baseProps} {...props} />
      </MantineProvider>,
    );
  });
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  vi.stubGlobal(
    'ResizeObserver',
    class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  vi.stubGlobal('URL', {
    ...URL,
    createObjectURL: vi.fn(() => 'blob:avatar-crop'),
    revokeObjectURL: vi.fn(),
  });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('ProfileAvatarControl', () => {
  it('renders a canonical asset image and exposes one remove action', async () => {
    const onRemove = vi.fn(async () => true);
    renderControl({ imageUrl: '/asset/avatar-id/avatar.webp', onRemove });

    expect(container.querySelector('img')?.getAttribute('src')).toBe('/asset/avatar-id/avatar.webp');
    const remove = container.querySelector<HTMLButtonElement>('button[aria-label="Remove profile image"]');
    expect(remove).not.toBeNull();

    await act(async () => remove?.click());
    expect(onRemove).toHaveBeenCalledOnce();
  });

  it('keeps upload policy outside the view and reports validation failures', () => {
    const onValidationError = vi.fn();
    renderControl({
      validateFile: () => 'Invalid image',
      onValidationError,
    });

    const input = container.querySelector<HTMLInputElement>('input[type="file"]');
    const file = new File(['bad'], 'bad.txt', { type: 'text/plain' });
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    act(() => input?.dispatchEvent(new Event('change', { bubbles: true })));

    expect(onValidationError).toHaveBeenCalledWith('Invalid image');
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  it('passes cropped bytes to the controller callback', async () => {
    const onSave = vi.fn(async (_blob: Blob) => true);
    renderControl({ onSave });

    const input = container.querySelector<HTMLInputElement>('input[type="file"]');
    const file = new File(['image'], 'avatar.png', { type: 'image/png' });
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    act(() => input?.dispatchEvent(new Event('change', { bubbles: true })));

    const completeCrop = container.querySelector<HTMLButtonElement>('[data-testid="complete-crop"]');
    await act(async () => completeCrop?.click());

    expect(onSave).toHaveBeenCalledOnce();
    expect(onSave.mock.calls[0]?.[0]).toBeInstanceOf(Blob);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:avatar-crop');
  });

  it('uses controller-provided preprocessing before opening the cropper', async () => {
    const prepared = new File(['webp'], 'avatar.webp', { type: 'image/webp' });
    const prepareFile = vi.fn(async () => prepared);
    renderControl({ prepareFile });

    const input = container.querySelector<HTMLInputElement>('input[type="file"]');
    const source = new File(['heic'], 'avatar.heic', { type: 'image/heic' });
    Object.defineProperty(input, 'files', { value: [source], configurable: true });
    await act(async () => input?.dispatchEvent(new Event('change', { bubbles: true })));

    expect(prepareFile).toHaveBeenCalledWith(source);
    expect(URL.createObjectURL).toHaveBeenCalledWith(prepared);
  });
});
