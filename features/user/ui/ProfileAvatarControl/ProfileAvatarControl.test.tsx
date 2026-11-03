// @vitest-environment jsdom
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@/test/render';
import { PageLoaderView } from '@/components/core/LoadingSurface';
import { ProfileAvatarControl, type ProfileAvatarControlProps } from './ProfileAvatarControl';
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
  loadFailed: 'Failed to load data.',
  retry: 'Try again',
};
const props: ProfileAvatarControlProps = {
  imageUrl: null,
  accept: ['image/png'],
  maxSize: 20 * 1024 * 1024,
  labels,
  loadingSurface: <PageLoaderView imageAlt="Loading" message="Loading" placement="flow" />,
  onSave: async () => true,
};
beforeEach(() => {
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:avatar-crop') });
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
});
afterEach(() => vi.restoreAllMocks());
describe('ProfileAvatarControl', () => {
  it('renders the asset image and exposes one remove action', async () => {
    const onRemove = vi.fn(async () => true);
    const { user } = render(
      <ProfileAvatarControl {...props} imageUrl="/asset/avatar-id/avatar.webp" onRemove={onRemove} />,
    );
    expect(screen.getByRole('img', { name: labels.alt })).toHaveAttribute('src', '/asset/avatar-id/avatar.webp');
    expect(screen.getAllByRole('button', { name: labels.remove })).toHaveLength(1);
    expect(screen.getByRole('button', { name: labels.remove })).toHaveAttribute('data-tone', 'danger');
    expect(screen.getByRole('button', { name: labels.remove })).toHaveAttribute('data-emphasis', 'strong');
    await user.click(screen.getByRole('button', { name: labels.remove }));
    expect(onRemove).toHaveBeenCalledOnce();
  });
  it('keeps upload policy outside the view and reports validation failures', async () => {
    const onValidationError = vi.fn();
    const { user } = render(
      <ProfileAvatarControl {...props} validateFile={() => 'Invalid image'} onValidationError={onValidationError} />,
    );
    await user.upload(
      screen.getByLabelText(labels.upload, { selector: 'input' }),
      new File(['bad'], 'bad.png', { type: 'image/png' }),
    );
    expect(onValidationError).toHaveBeenCalledWith('Invalid image');
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });
  it('passes cropped bytes through the real cropper to the controller', async () => {
    const blob = new Blob(['crop'], { type: 'image/webp' });
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => callback(blob));
    const onSave = vi.fn(async () => true);
    const { user } = render(<ProfileAvatarControl {...props} onSave={onSave} />);
    await user.upload(
      screen.getByLabelText(labels.upload, { selector: 'input' }),
      new File(['image'], 'avatar.png', { type: 'image/png' }),
    );
    const image = await screen.findByRole('img', { name: labels.cropPreview });
    Object.defineProperties(image, {
      width: { configurable: true, value: 100 },
      height: { configurable: true, value: 100 },
      naturalWidth: { configurable: true, value: 100 },
      naturalHeight: { configurable: true, value: 100 },
    });
    fireEvent.load(image);
    await user.click(screen.getByRole('button', { name: labels.confirm }));
    expect(onSave).toHaveBeenCalledWith(blob);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:avatar-crop');
  });
  it('uses controller preprocessing and ignores a result after unmount', async () => {
    let finish!: (file: File) => void;
    const prepareFile = vi.fn(
      () =>
        new Promise<File>((resolve) => {
          finish = resolve;
        }),
    );
    const { user, unmount } = render(
      <ProfileAvatarControl {...props} prepareFile={prepareFile} accept={['image/heic']} />,
    );
    const source = new File(['heic'], 'avatar.heic', { type: 'image/heic' });
    await user.upload(screen.getByLabelText(labels.upload, { selector: 'input' }), source);
    expect(prepareFile).toHaveBeenCalledWith(source);
    expect(screen.queryByRole('button', { name: labels.upload })).not.toBeInTheDocument();
    unmount();
    await act(async () => finish(new File(['webp'], 'avatar.webp', { type: 'image/webp' })));
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });
});

it('opens the prepared file rather than the selected source', async () => {
  const prepared = new File(['webp'], 'avatar.webp', { type: 'image/webp' });
  const prepareFile = vi.fn(async () => prepared);
  const { user } = render(<ProfileAvatarControl {...props} prepareFile={prepareFile} accept={['image/heic']} />);
  const source = new File(['heic'], 'avatar.heic', { type: 'image/heic' });
  await user.upload(screen.getByLabelText(labels.upload, { selector: 'input' }), source);
  expect(prepareFile).toHaveBeenCalledWith(source);
  expect(URL.createObjectURL).toHaveBeenCalledWith(prepared);
});
