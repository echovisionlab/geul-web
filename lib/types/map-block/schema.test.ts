import { describe, expect, it } from 'vitest';
import { mapBlockPropSchema, mapBlockWirePropSchema, parseMapBlockProps } from './schema';

describe('durable map block schema', () => {
  it('keeps critical persisted fields and defaults in the Tiptap attribute schema', () => {
    expect(mapBlockPropSchema).toMatchObject({
      mapPlaceIds: { default: '' },
      aspectRatio: { default: '16:9', values: ['16:9', '4:3', '1:1'] },
      previewWidth: { default: '100' },
      url: { default: 'map' },
      showPreview: { default: 'true', values: ['true', 'false'] },
      textAlignment: { default: 'left', values: ['left', 'center', 'right'] },
    });
  });

  it('parses persisted values with the same validation defaults', () => {
    expect(parseMapBlockProps({})).toMatchObject({
      mapPlaceIds: '',
      aspectRatio: '16:9',
      previewWidth: '100',
      zoom: '15',
      url: 'map',
      showPreview: 'true',
    });
  });

  it('normalizes released legacy inputs without restoring them to the canonical prop shape', () => {
    const parsed = parseMapBlockProps({
      mapPlaceId: 'legacy-place',
      location: JSON.stringify({ name: 'Seoul', lat: 37.5665, lng: 126.978 }),
    });

    expect(parsed).toMatchObject({
      mapPlaceIds: 'legacy-place',
      centerLat: '37.5665',
      centerLng: '126.978',
    });
    expect(parsed).not.toHaveProperty('mapPlaceId');
    expect(parsed).not.toHaveProperty('location');
    expect(mapBlockPropSchema).not.toHaveProperty('mapPlaceId');
    expect(mapBlockPropSchema).not.toHaveProperty('location');
    expect(mapBlockWirePropSchema).toMatchObject({
      mapPlaceId: { default: '' },
      location: { default: '' },
    });
  });

  it('keeps canonical references and center coordinates ahead of legacy fallbacks', () => {
    expect(
      parseMapBlockProps({
        mapPlaceIds: 'current-place',
        mapPlaceId: 'legacy-place',
        centerLat: '35.6812',
        centerLng: '139.7671',
        location: JSON.stringify({ lat: 37.5665, lng: 126.978 }),
      }),
    ).toMatchObject({
      mapPlaceIds: 'current-place',
      centerLat: '35.6812',
      centerLng: '139.7671',
    });
  });
});
