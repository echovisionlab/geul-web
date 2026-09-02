// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';
import { blocksToHtml } from './post';

vi.mock('@/lib/actions/map-place', () => ({
  getPublicMapPlacesByIdsAction: vi.fn(async (ids: string[]) =>
    ids.map((id, index) => ({
      id,
      name: `Place ${index + 1}`,
      address: `Address ${index + 1}`,
      lat: 37.5 + index,
      lng: 127 + index,
      addressComponents: [],
    })),
  ),
}));

vi.mock('@/lib/actions/map-theme', () => ({
  resolvePublicMapThemesByIdsAction: vi.fn(async (ids: string[]) =>
    ids.map((requestedThemeId) => ({
      requestedThemeId,
      theme: {
        id: requestedThemeId,
        name: `Theme ${requestedThemeId}`,
        settings: {
          calloutScale: 1,
          calloutOffsetX: 0,
          calloutOffsetY: 0,
          calloutFields: ['name', 'address'],
          attributionFontSize: 11,
          showAreaLabels: true,
          showPoiLabels: false,
        },
        lightVariant: mapThemeVariant(`${requestedThemeId}-light`, 'light'),
        darkVariant: mapThemeVariant(`${requestedThemeId}-dark`, 'dark'),
      },
    })),
  ),
}));

function mapThemeVariant(id: string, scheme: 'light' | 'dark') {
  return {
    id,
    scheme,
    backgroundColor: '#ffffff',
    waterColor: '#0000ff',
    landColor: '#eeeeee',
    roadColor: '#cccccc',
    buildingFillColor: '#dddddd',
    buildingStrokeEnabled: false,
    buildingStrokeColor: '#bbbbbb',
    calloutLineColor: '#111111',
    calloutHoverLineColor: '#222222',
    calloutTextColor: '#111111',
    calloutHoverTextColor: '#222222',
    calloutDescriptionColor: '#333333',
    calloutHoverDescriptionColor: '#444444',
    calloutBackgroundColor: '#ffffff',
    calloutHoverBackgroundColor: '#eeeeee',
    attributionColor: '#111111',
    labelTextColor: '#111111',
    clusterColor: '#555555',
    clusterHoverColor: '#666666',
    clusterTextColor: '#ffffff',
    clusterTextHoverColor: '#ffffff',
  };
}

describe('media export integration', () => {
  it('normalizes malformed link hrefs in generic block html export', async () => {
    const html = await blocksToHtml([
      {
        id: 'link-block',
        type: 'paragraph',
        props: {},
        content: [
          {
            type: 'link',
            href: 'https://{{verification_url}}',
            content: [{ type: 'text', text: '{{verification_url}}', styles: {} }],
          },
        ],
        children: [],
      },
    ]);

    expect(html).toContain('href="{{verification_url}}"');
    expect(html).not.toContain('href="https://{{verification_url}}"');
  });

  it('exports audio files with the shared media contract', async () => {
    const html = await blocksToHtml([
      {
        id: 'audio-block',
        type: 'file',
        props: {
          fileId: 'audio-1',
          url: 'https://cdn.example.com/original.wav',
          originalUrl: 'https://cdn.example.com/original.wav',
          hlsUrl: 'https://cdn.example.com/master.m3u8',
          spectrogramUrl: 'https://cdn.example.com/spectrogram.png',
          caption: 'Dawn chorus recording',
          name: 'Birdsong',
          mimeType: 'audio/wav',
          size: '1024',
          entityType: 'post',
          entityId: 'post-1',
          processingStatus: 'completed',
          processingProgress: '0',
          duration: '12',
          waveformUrl: 'https://cdn.example.com/waveform.json',
          previewWidth: '100',
          textAlignment: 'left',
        },
        content: [],
        children: [],
      },
    ]);

    expect(html).toContain('data-media-kind="audio"');
    expect(html).toContain('data-playback-url="https://cdn.example.com/master.m3u8"');
    expect(html).toContain('data-waveform-url="https://cdn.example.com/waveform.json"');
    expect(html).toContain('data-spectrogram-url="https://cdn.example.com/spectrogram.png"');
    expect(html).toContain('audio-player');
    expect(html).toContain('data-audio-player-wave="true"');
    expect(html).not.toContain('data-audio-player-spectrogram-image="true"');
    expect(html).not.toContain('data-audio-player-download');
    expect(html).toContain('data-media-name="Birdsong"');
    expect(html).toContain('Birdsong');
    expect(html).toContain('Dawn chorus recording');
  });

  it('exports work video files with the shared media contract', async () => {
    const html = await blocksToHtml([
      {
        id: 'video-block',
        type: 'file',
        props: {
          fileId: 'video-1',
          url: 'https://cdn.example.com/original.mp4',
          hlsUrl: 'https://cdn.example.com/master.m3u8',
          thumbnailUrl: 'https://cdn.example.com/thumb.webp',
          caption: 'Shot at sunrise',
          name: 'Field recording film',
          mimeType: 'video/mp4',
          size: '2048',
          entityType: 'work',
          entityId: 'work-1',
          processingStatus: 'completed',
          processingProgress: '0',
          duration: '40',
          clientThumbnail: '',
          previewWidth: '100',
          textAlignment: 'left',
        },
        content: [],
        children: [],
      },
    ]);

    expect(html).toContain('data-media-kind="video"');
    expect(html).toContain('data-original-url="https://cdn.example.com/original.mp4"');
    expect(html).toContain('data-hls-src="https://cdn.example.com/master.m3u8"');
    expect(html).toContain('data-poster-url="https://cdn.example.com/thumb.webp"');
    expect(html).toContain('data-media-name="Field recording film"');
    expect(html).toContain('video-player-container');
    expect(html).toContain('Field recording film');
    expect(html).toContain('Shot at sunrise');
  });

  it('normalizes malformed link hrefs in work block html export', async () => {
    const html = await blocksToHtml([
      {
        id: 'link-block',
        type: 'paragraph',
        props: {},
        content: [
          {
            type: 'link',
            href: 'https://{{verification_url}}',
            content: [{ type: 'text', text: '{{verification_url}}', styles: {} }],
          },
        ],
        children: [],
      },
    ]);

    expect(html).toContain('href="{{verification_url}}"');
    expect(html).not.toContain('href="https://{{verification_url}}"');
  });

  it('exports general files with a stacked meta line and block alignment marker', async () => {
    const html = await blocksToHtml([
      {
        id: 'attachment-block',
        type: 'file',
        props: {
          fileId: 'file-1',
          url: 'https://cdn.example.com/file.pdf',
          caption: 'Recorded during the evening set',
          name: '91112__krishnanow__seva-sound',
          mimeType: 'application/pdf',
          size: '30000000',
          entityType: 'post',
          entityId: 'post-1',
          previewWidth: '60',
          textAlignment: 'center',
        },
        content: [],
        children: [],
      },
    ]);

    const container = document.createElement('div');
    container.innerHTML = html;

    const attachment = container.querySelector('.attachment-block');
    expect(attachment?.getAttribute('data-block-alignment')).toBe('center');
    expect(attachment?.getAttribute('data-media-name')).toBe('91112__krishnanow__seva-sound');
    expect(attachment?.getAttribute('style')).toContain('width:60%');
    expect(attachment?.getAttribute('style')).toContain('margin-left:auto');
    expect(attachment?.getAttribute('style')).toContain('margin-right:auto');
    expect(attachment?.querySelector('.attachment-title')?.textContent).toBe('91112__krishnanow__seva-sound');
    expect(attachment?.querySelector('a')?.getAttribute('download')).toBe('91112__krishnanow__seva-sound.pdf');
    expect(attachment?.querySelector('.attachment-meta')?.textContent).toBe('PDF • 28.6 MB');
    expect(attachment?.querySelector('.media-block__caption')?.textContent).toBe('Recorded during the evening set');
  });

  it('exports image files with the shared caption class', async () => {
    const html = await blocksToHtml([
      {
        id: 'image-block',
        type: 'file',
        props: {
          fileId: 'image-1',
          url: 'https://cdn.example.com/image.webp',
          caption: 'Shot at sunrise',
          name: 'sunrise.webp',
          mimeType: 'image/webp',
          previewWidth: '52',
          textAlignment: 'right',
        },
        content: [],
        children: [],
      },
    ]);

    const container = document.createElement('div');
    container.innerHTML = html;

    const imageBlock = container.querySelector('.image-block');
    expect(imageBlock?.getAttribute('style')).toContain('width:52%');
    expect(imageBlock?.getAttribute('style')).toContain('margin-left:auto');
    expect(imageBlock?.querySelector('.media-block__caption')?.textContent).toBe('Shot at sunrise');
  });

  it('drops runtime hydration props before exporting media html', async () => {
    const html = await blocksToHtml([
      {
        id: 'audio-hydrated',
        type: 'file',
        props: {
          fileId: 'audio-1',
          url: '',
          originalUrl: 'https://cdn.example.com/original.wav',
          hlsUrl: 'https://cdn.example.com/master.m3u8',
          waveformUrl: 'https://cdn.example.com/waveform.json',
          spectrogramUrl: 'https://cdn.example.com/spectrogram.png',
          caption: 'Runtime props should not break export',
          name: 'Hydrated audio',
          mimeType: 'audio/wav',
          size: '1024',
          entityType: 'post',
          entityId: 'post-1',
          processingStatus: 'completed',
          processingProgress: '0',
          duration: '12',
          previewWidth: '100',
          textAlignment: 'left',
        },
        content: [],
        children: [],
      },
    ]);

    expect(html).toContain('data-media-kind="audio"');
    expect(html).toContain('Hydrated audio');
    expect(html).toContain('Runtime props should not break export');
  });

  it('exports map blocks with figure alignment, hydration data, and captions', async () => {
    const html = await blocksToHtml([
      {
        id: 'map-block',
        type: 'map',
        props: {
          mapPlaceIds: 'place-1',
          aspectRatio: '4:3',
          previewWidth: '60',
          zoom: '12',
          minZoom: '3',
          maxZoom: '16',
          url: 'map',
          showPreview: 'true',
          draggable: 'true',
          zoomable: 'true',
          rotatable: 'false',
          tiltable: 'false',
          pinClickable: 'true',
          centerLat: '',
          centerLng: '',
          pitch: '0',
          bearing: '0',
          show3DBuildings: 'false',
          autoRotate: 'false',
          autoRotateSpeed: '1',
          showDirections: 'true',
          variant: 'default',
          themeId: 'theme-1',
          preferredScheme: 'auto',
          areaLabelsMode: 'show',
          poiLabelsMode: 'hide',
          caption: 'Center aligned map',
          textAlignment: 'center',
        },
        content: [],
        children: [],
      },
    ]);

    const container = document.createElement('div');
    container.innerHTML = html;

    const figure = container.querySelector('figure.map-block-figure');
    const map = figure?.querySelector('.map-block');

    expect(figure?.getAttribute('style')).toContain('width:60%');
    expect(figure?.getAttribute('style')).toContain('margin-left:auto');
    expect(figure?.getAttribute('style')).toContain('margin-right:auto');
    expect(map?.getAttribute('data-map-view-config')).toBeTruthy();
    expect(map?.getAttribute('data-block-alignment')).toBe('center');
    expect(JSON.parse(map?.getAttribute('data-map-view-config') || '{}')).toEqual(
      expect.objectContaining({
        minZoom: 3,
        maxZoom: 16,
      }),
    );
    expect(figure?.querySelector('figcaption')?.textContent).toBe('Center aligned map');
  });

  it('keeps centered map width on hydrated blocks without captions', async () => {
    const html = await blocksToHtml([
      {
        id: 'map-block-no-caption',
        type: 'map',
        props: {
          mapPlaceIds: 'place-1',
          aspectRatio: '16:9',
          previewWidth: '60',
          zoom: '12',
          minZoom: '-2',
          maxZoom: '22',
          url: 'map',
          showPreview: 'true',
          draggable: 'true',
          zoomable: 'true',
          rotatable: 'false',
          tiltable: 'false',
          pinClickable: 'true',
          centerLat: '',
          centerLng: '',
          pitch: '0',
          bearing: '0',
          show3DBuildings: 'false',
          autoRotate: 'false',
          autoRotateSpeed: '1',
          showDirections: 'true',
          variant: 'default',
          themeId: 'theme-1',
          preferredScheme: 'auto',
          areaLabelsMode: 'inherit',
          poiLabelsMode: 'show',
          caption: '',
          textAlignment: 'center',
        },
        content: [],
        children: [],
      },
    ]);

    const container = document.createElement('div');
    container.innerHTML = html;

    const map = container.querySelector('.map-block');

    expect(map?.getAttribute('style')).toContain('width:60%');
    expect(map?.getAttribute('style')).toContain('margin-left:auto');
    expect(map?.getAttribute('style')).toContain('margin-right:auto');
    expect(map?.getAttribute('data-map-view-config')).toBeTruthy();
  });
});
