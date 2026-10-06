// @vitest-environment jsdom

import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { PercentCrop, PixelCrop, ReactCropProps } from 'react-image-crop';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ImageCropper, type AspectRatioConfig } from './ImageCropper';

let cropProps: ReactCropProps;
const drawImage = vi.fn();
const onCrop = vi.fn();

vi.mock('react-image-crop', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-image-crop')>()),
  default: (props: ReactCropProps) => {
    cropProps = props;
    return <div>{props.children}</div>;
  },
}));

vi.mock('@mantine/core', () => {
  const Container = ({ children }: { children: ReactNode }) => <div>{children}</div>;
  return { Box: Container, Group: Container, Loader: Container, Modal: Container, Stack: Container, Text: Container };
});

vi.mock('../Button', () => ({
  Button: ({ children, onClick, disabled }: { children: ReactNode; onClick: () => void; disabled?: boolean }) => (
    <button type="button" onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
}));

let container: HTMLDivElement;
let root: Root;

function renderCropper(aspectRatio: AspectRatioConfig, circularCrop = false) {
  act(() => {
    root.render(
      <ImageCropper
        imageSrc="/test.png"
        opened
        onClose={() => {}}
        onCrop={onCrop}
        title="Crop"
        labels={{ previewAlt: 'Preview', cancel: 'Cancel', confirm: 'Apply' }}
        aspectRatio={aspectRatio}
        circularCrop={circularCrop}
      />,
    );
  });
  const image = container.querySelector('img')!;
  Object.defineProperties(image, {
    naturalWidth: { value: 2000 },
    naturalHeight: { value: 2000 },
    width: { value: 500, configurable: true },
    height: { value: 500, configurable: true },
  });
  act(() => image.dispatchEvent(new Event('load')));
  return image;
}

async function confirm() {
  const button = Array.from(container.querySelectorAll('button')).find((item) => item.textContent === 'Apply')!;
  await act(async () => button.click());
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  drawImage.mockReset();
  onCrop.mockReset();
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    drawImage,
  } as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback, type) => {
    callback(new Blob(['encoded'], { type }));
  });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});

describe('ImageCropper callback and export coordinates', () => {
  it('corrects displayed selection and raw keyboard completion, then exports the same natural region after resize', async () => {
    const image = renderCropper({ min: 9 / 16, max: 16 / 9 });
    const pixels: PixelCrop = { unit: 'px', x: 0, y: 450, width: 400, height: 25 };
    const percent: PercentCrop = { unit: '%', x: 0, y: 90, width: 80, height: 5 };

    act(() => {
      // ReactCrop's keyboard handler emits both callbacks before receiving corrected props.
      cropProps.onChange(pixels, percent);
      cropProps.onComplete?.(pixels, percent);
    });
    expect(cropProps.crop).toMatchObject({ unit: '%', x: 0, y: 90, height: 10 });
    expect(cropProps.crop?.width).toBeCloseTo((10 * 16) / 9);

    Object.defineProperties(image, { width: { value: 250 }, height: { value: 250 } });
    await confirm();

    const [, x, y, width, height, , , outputWidth, outputHeight] = drawImage.mock.calls[0];
    expect(x).toBe(0);
    expect(y).toBe(1800);
    expect(width).toBeCloseTo((200 * 16) / 9);
    expect(height).toBe(200);
    expect(outputWidth).toBe(356);
    expect(outputHeight).toBe(200);
    expect(onCrop.mock.calls[0][0].type).toBe('image/webp');
  });

  it.each([
    [16 / 9, false],
    [1, true],
    ['free', false],
  ] as const)(
    'preserves initial %s crop at natural resolution when the displayed image resizes',
    async (aspect, circular) => {
      const image = renderCropper(aspect, circular);
      const selected = cropProps.crop as PercentCrop;
      expect(cropProps.aspect).toBe(typeof aspect === 'number' ? aspect : undefined);
      expect(cropProps.circularCrop).toBe(circular);
      Object.defineProperties(image, { width: { value: 250 }, height: { value: 250 } });
      await confirm();

      const [, x, y, width, height] = drawImage.mock.calls[0];
      expect(x).toBeCloseTo(selected.x * 20);
      expect(y).toBeCloseTo(selected.y * 20);
      expect(width).toBeCloseTo(selected.width * 20);
      expect(height).toBeCloseTo(selected.height * 20);
    },
  );
});
