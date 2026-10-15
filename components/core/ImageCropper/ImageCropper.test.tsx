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

// Crop coordinate tests isolate the overlay portal; overlay focus/locking is tested by Core Modal.
vi.mock('../Modal', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../Modal')>()),
  ContentModal: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

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
  it('uses separate localized crop control names, selection values and instructions without changing displayed actions', () => {
    const ariaLabels = {
      cropArea: '선택 영역',
      nwDragHandle: '왼쪽 위',
      nDragHandle: '위',
      neDragHandle: '오른쪽 위',
      eDragHandle: '오른쪽',
      seDragHandle: '오른쪽 아래',
      sDragHandle: '아래',
      swDragHandle: '왼쪽 아래',
      wDragHandle: '왼쪽',
    };
    act(() =>
      root.render(
        <ImageCropper
          imageSrc="/test.png"
          opened
          onClose={() => {}}
          onCrop={onCrop}
          title="Crop"
          labels={{ previewAlt: 'Preview', cancel: 'Cancel', confirm: 'Apply' }}
          helpText="Visible help"
          cropAccessibility={{
            labels: ariaLabels,
            instructions: 'Use arrow keys',
            describeSelection: (value) =>
              `x ${value.x}%, y ${value.y}%, width ${value.width}%, height ${value.height}%`,
          }}
        />,
      ),
    );
    const crop = { unit: '%', x: 5, y: 10, width: 80, height: 60 } as const;
    act(() => cropProps.onComplete?.({ ...crop, unit: 'px' }, crop));
    expect(cropProps.ariaLabels).toEqual(ariaLabels);
    expect(container.querySelector('[role="status"]')?.textContent).toBe('x 5%, y 10%, width 80%, height 60%');
    const group = container.querySelector('[role="group"]')!;
    const descriptions = group
      .getAttribute('aria-describedby')!
      .split(' ')
      .map((id) => document.getElementById(id)?.textContent);
    expect(descriptions).toEqual(['Visible help', 'Use arrow keys', 'x 5%, y 10%, width 80%, height 60%']);
    expect([...container.querySelectorAll('button')].map((item) => item.textContent)).toEqual(['Cancel', 'Apply']);
  });

  it('locks crop interaction while encoding is being accepted and re-enables it when the consumer keeps the editor open', async () => {
    let finish: (accepted: boolean) => void = () => {};
    onCrop.mockReturnValue(
      new Promise<boolean>((resolve) => {
        finish = resolve;
      }),
    );
    renderCropper('free');
    expect(cropProps.disabled).toBe(false);
    expect(cropProps.className).toBeTruthy();
    const button = Array.from(container.querySelectorAll('button')).find((item) => item.textContent === 'Apply')!;
    await act(async () => button.click());
    expect(cropProps.disabled).toBe(true);
    await act(async () => finish(false));
    expect(cropProps.disabled).toBe(false);
  });

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
