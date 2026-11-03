// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@/test/render';
import { LogoCropper } from './LogoCropper';
const prepare = vi.hoisted(() => vi.fn());
vi.mock('@/lib/utils/upload-pipeline', () => ({ prepareImageFileForPreview: prepare }));
const file = () => new File(['png'], 'logo.png', { type: 'image/png' });
const callbacks = () => ({ onUpload: vi.fn(), onImageChange: vi.fn() });
describe('LogoCropper preparation', () => {
  it('shows shared upload preparation, recovers from failure, and allows another selection', async () => {
    let fail!: (error: Error) => void;
    prepare.mockReturnValue(
      new Promise((_resolve, reject) => {
        fail = reject;
      }),
    );
    const props = callbacks();
    const { user } = render(<LogoCropper {...props} currentImage={null} name="Studio" />);
    await user.upload(screen.getByLabelText('Upload Logo', { selector: 'input' }), file());
    expect(screen.getByText('Preparing image')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Upload Logo' })).not.toBeInTheDocument();
    await act(async () => fail(new Error('Cannot decode image')));
    expect(
      (await screen.findAllByRole('button', { name: 'Upload Logo' })).every(
        (button) => !button.hasAttribute('disabled'),
      ),
    ).toBe(true);
    expect(props.onUpload).not.toHaveBeenCalled();
  });
  it('recovers when the browser file reader fails', async () => {
    prepare.mockResolvedValue(file());
    const read = vi.spyOn(FileReader.prototype, 'readAsDataURL').mockImplementation(function (this: FileReader) {
      this.dispatchEvent(new ProgressEvent('error'));
    });
    const props = callbacks();
    try {
      const { user } = render(<LogoCropper {...props} currentImage={null} />);
      await user.upload(screen.getByLabelText('Upload Logo', { selector: 'input' }), file());
      await waitFor(() => expect(screen.queryByText('Preparing image')).not.toBeInTheDocument());
      expect(
        screen.getAllByRole('button', { name: 'Upload Logo' }).every((button) => !button.hasAttribute('disabled')),
      ).toBe(true);
      expect(props.onUpload).not.toHaveBeenCalled();
    } finally {
      read.mockRestore();
    }
  });

  it.each(['target', 'unmount'])('discards preparation after %s changes', async (change) => {
    let finish!: (file: File) => void;
    prepare.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const props = callbacks();
    const { user, rerender, unmount } = render(<LogoCropper {...props} currentImage={null} />);
    await user.upload(screen.getByLabelText('Upload Logo', { selector: 'input' }), file());
    if (change === 'target') {
      rerender(<LogoCropper {...props} currentImage="/new-logo.png" />);
    } else {
      unmount();
    }
    await act(async () => finish(file()));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(props.onUpload).not.toHaveBeenCalled();
    expect(props.onImageChange).not.toHaveBeenCalled();
    if (change === 'target') {
      expect(screen.getByRole('img', { name: 'Logo' })).toHaveAttribute('src', '/new-logo.png');
    }
  });
});
