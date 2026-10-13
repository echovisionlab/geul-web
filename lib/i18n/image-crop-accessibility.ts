import type { CropAccessibility } from '@/components/core/ImageCropper/ImageCropper';

interface CropTerms {
  area: string;
  top: string;
  right: string;
  bottom: string;
  left: string;
  width: string;
  height: string;
}

/** Uses the feature's existing translated terms without changing displayed copy. */
export function createImageCropAccessibility(locale: string, terms: CropTerms): CropAccessibility {
  const percent = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 1 });
  const handle = (...directions: string[]) => `${terms.area}: ${directions.join(' ')}`;
  return {
    labels: {
      cropArea: terms.area,
      nwDragHandle: handle(terms.top, terms.left),
      nDragHandle: handle(terms.top),
      neDragHandle: handle(terms.top, terms.right),
      eDragHandle: handle(terms.right),
      seDragHandle: handle(terms.bottom, terms.right),
      sDragHandle: handle(terms.bottom),
      swDragHandle: handle(terms.bottom, terms.left),
      wDragHandle: handle(terms.left),
    },
    describeSelection: ({ x, y, width, height }) =>
      [
        [terms.left, x],
        [terms.top, y],
        [terms.width, width],
        [terms.height, height],
      ]
        .map(([term, value]) => `${term}: ${percent.format(Number(value) / 100)}`)
        .join(', '),
  };
}
