import { describe, expect, it } from 'vitest';
import { createImageCropAccessibility } from './image-crop-accessibility';

describe('translated crop coordinates', () => {
  it('identifies all nine crop controls and reports x/y/width/height as percentages', () => {
    const accessibility = createImageCropAccessibility('ko', {
      area: '프로필 이미지 자르기',
      top: '위',
      right: '오른쪽',
      bottom: '아래',
      left: '왼쪽',
      width: '너비',
      height: '높이',
    });
    expect(Object.keys(accessibility.labels)).toHaveLength(9);
    expect(accessibility.labels.nwDragHandle).toBe('프로필 이미지 자르기: 위 왼쪽');
    expect(accessibility.labels.cropArea).toBe('프로필 이미지 자르기');
    expect(accessibility.describeSelection({ unit: '%', x: 10, y: 5, width: 72.25, height: 80 })).toBe(
      '왼쪽: 10%, 위: 5%, 너비: 72.3%, 높이: 80%',
    );
  });

  it('uses the locale number format instead of assuming an English percentage', () => {
    const accessibility = createImageCropAccessibility('ar', {
      area: 'اقتصاص الصورة',
      top: 'أعلى',
      right: 'يمين',
      bottom: 'أسفل',
      left: 'يسار',
      width: 'العرض',
      height: 'الارتفاع',
    });
    expect(accessibility.describeSelection({ unit: '%', x: 10, y: 5, width: 50, height: 80 })).toContain(
      `العرض: ${new Intl.NumberFormat('ar', { style: 'percent', maximumFractionDigits: 1 }).format(0.5)}`,
    );
  });
});
