import { DesignSystemProvider } from '@/lib/providers/DesignSystemProvider';
import { NextIntlClientProvider } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { resolveAudioViewModel } from '@/lib/media/audio-view-model';
import { AudioMediaView } from './AudioMediaView';
import { AttachmentMediaView } from './ui/AttachmentMediaView';
import { ImageMediaView } from './ui/ImageMediaView';

describe('media view components', () => {
  it('renders audio labels without eager download actions', () => {
    const html = renderToStaticMarkup(
      <NextIntlClientProvider
        locale="en"
        timeZone="UTC"
        messages={{
          editorCommon: {
            media: {
              audioPlayer: {
                play: 'Play',
                pause: 'Pause',
                mute: 'Mute',
                unmute: 'Unmute',
                playback: 'Playing',
                seekPlayback: 'Seek playback',
                volume: 'Volume',
                waveform: 'Waveform',
                download: 'Download',
                spectrogram: 'Spectrogram',
                spectrogramAlt: 'Audio spectrogram',
              },
            },
          },
        }}
      >
        <DesignSystemProvider locale="en" forceColorScheme="light">
          <AudioMediaView
            model={resolveAudioViewModel({
              fileId: 'audio-1',
              originalUrl: 'https://cdn.example.com/original.wav',
              hlsUrl: 'https://cdn.example.com/master.m3u8',
              waveformUrl: 'https://cdn.example.com/waveform.json',
              spectrogramUrl: 'https://cdn.example.com/spectrogram.png',
              name: 'Birdsong',
              caption: 'Dawn chorus recording',
              processingStatus: 'completed',
            })}
          />
        </DesignSystemProvider>
      </NextIntlClientProvider>,
    );

    expect(html).not.toContain('Ready');
    expect(html).toContain('data-audio-player="true"');
    expect(html).toContain('data-audio-player-view="waveform"');
    expect(html).toContain('data-audio-player-wave="true"');
    expect(html).not.toContain('data-audio-player-download');
    expect(html).not.toContain('data-audio-player-view-panel="spectrogram"');
    expect(html).toContain('Birdsong');
    expect(html).toContain('Dawn chorus recording');
  });

  it('renders the authored attachment title, file metadata, caption, action and width', () => {
    const html = renderToStaticMarkup(
      <AttachmentMediaView
        title={<span>Field notes</span>}
        meta="PDF · 2.0 KB"
        caption="Recorded in the lower valley"
        style={{ width: '62%', marginLeft: '0', marginRight: 'auto' }}
        action={<button type="button">Download file</button>}
      />,
    );

    expect(html).toMatch(/^<div[^>]*style="width:62%/);
    expect(html).toContain('>Field notes<');
    expect(html).toContain('>PDF · 2.0 KB<');
    expect(html).toContain('>Recorded in the lower valley<');
    expect(html).toContain('<button type="button">Download file</button>');
  });

  it('renders the authored image, alt text, caption and width', () => {
    const html = renderToStaticMarkup(
      <ImageMediaView
        src="https://cdn.example.com/image.webp"
        alt="Cover art"
        caption="Shot at sunrise"
        style={{ width: '48%', marginLeft: 'auto', marginRight: '0' }}
      />,
    );

    expect(html).toMatch(/<figure[^>]*style="width:48%/);
    expect(html).toMatch(/<img src="https:\/\/cdn\.example\.com\/image\.webp" alt="Cover art"/);
    expect(html).toContain('>Shot at sunrise<');
  });
});
