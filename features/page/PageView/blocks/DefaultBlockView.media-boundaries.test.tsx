// @vitest-environment node

import { renderToReadableStream } from 'react-dom/server';
import { NextIntlClientProvider } from 'next-intl';
import { MantineProvider } from '@mantine/core';
import { describe, expect, it, vi } from 'vitest';
import type { Block } from '@/lib/types/page-content';
import enMessages from '@/messages/en.json';
import { DefaultBlockView } from './DefaultBlockView';

const imports = vi.hoisted(() => ({ audio: 0, video: 0 }));

vi.mock('next/dynamic', async () => {
  const { default: dynamic } = await vi.importActual<{ default: typeof import('next/dynamic').default }>(
    'next/dist/shared/lib/app-dynamic.js',
  );
  return { default: dynamic };
});
vi.mock('@/features/media/AudioMediaView', async () => {
  imports.audio += 1;
  return vi.importActual('@/features/media/AudioMediaView');
});
vi.mock('@/features/media/VideoMediaView', async () => {
  imports.video += 1;
  return vi.importActual('@/features/media/VideoMediaView');
});

async function render(block: Block) {
  const stream = await renderToReadableStream(
    <NextIntlClientProvider locale="en" timeZone="UTC" messages={enMessages}>
      <MantineProvider>
        <DefaultBlockView block={block} />
      </MantineProvider>
    </NextIntlClientProvider>,
  );
  await stream.allReady;
  return new Response(stream).text();
}

describe('DefaultBlockView media boundaries', () => {
  it('loads media views only for used media and preserves their server layout and caption', async () => {
    const paragraph = await render({
      id: 'text',
      type: 'paragraph',
      props: {},
      content: [{ type: 'text', text: 'Readable text', styles: {} }],
    });
    expect(paragraph).toContain('Readable text');
    expect(imports).toEqual({ audio: 0, video: 0 });

    const audio = await render({
      id: 'audio',
      type: 'file',
      props: {
        fileId: 'audio-file',
        mimeType: 'audio/wav',
        url: '/media/audio.wav',
        name: 'Recording',
        caption: 'Audio caption',
        previewWidth: '42',
        textAlignment: 'center',
      },
    });
    expect(audio).toContain('audio-block');
    expect(audio).toContain('Audio caption');
    expect(audio).toContain('width:42%;margin-left:auto;margin-right:auto');
    expect(imports).toEqual({ audio: 1, video: 0 });

    const video = await render({
      id: 'video',
      type: 'file',
      props: {
        fileId: 'video-file',
        mimeType: 'video/mp4',
        url: '/media/video.mp4',
        name: 'Film',
        caption: 'Video caption',
        previewWidth: '58',
        textAlignment: 'right',
      },
    });
    expect(video).toContain('video-block');
    expect(video).toContain('Video caption');
    expect(video).toContain('width:58%;margin-left:auto;margin-right:0');
    expect(imports).toEqual({ audio: 1, video: 1 });
  });
});
