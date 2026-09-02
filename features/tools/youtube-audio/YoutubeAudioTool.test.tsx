// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import enMessages from '@/messages/en.json';
import type { AudioTranscodeToolProps } from '@/features/tools/transcode/AudioTranscodeTool';
import type { YoutubeAudioToolViewProps } from './ui';
import { YoutubeAudioTool } from './YoutubeAudioTool';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let viewProps: YoutubeAudioToolViewProps | null = null;
let transcodeProps: AudioTranscodeToolProps | null = null;

vi.mock('./ui', () => ({
  YoutubeAudioToolView: (props: YoutubeAudioToolViewProps) => {
    viewProps = props;
    return <div data-youtube-audio-view>{props.converter}</div>;
  },
}));

vi.mock('@/features/tools/transcode/AudioTranscodeTool', () => ({
  AudioTranscodeTool: (props: AudioTranscodeToolProps) => {
    transcodeProps = props;
    return <div data-audio-transcoder />;
  },
}));

const resolved = {
  contentType: 'audio/mp4',
  expiresAt: 2_000_000_000_000,
  input: {
    http: {
      credentials: 'include' as const,
      size: 123_456,
      url: 'https://www.example.invalid/api/tools/youtube-audio/sources/source_12345678',
    },
    name: 'Reference.m4a',
  },
  sourceId: 'source_12345678',
  title: 'Reference',
  videoId: 'abcdefghijk',
};

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  viewProps = null;
  transcodeProps = null;
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.clearAllMocks();
});

function render(fetcher: typeof fetch) {
  act(() => {
    root.render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <YoutubeAudioTool fetcher={fetcher} />
      </NextIntlClientProvider>,
    );
  });
}

function props(): YoutubeAudioToolViewProps {
  if (viewProps === null) {
    throw new Error('Expected YouTube audio view props');
  }
  return viewProps;
}

describe('YoutubeAudioTool', () => {
  it('resolves one authenticated source and passes its HTTP range descriptor to the existing transcoder', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(resolved), { status: 200 }));
    render(fetcher);

    act(() => props().onUrlChange('https://youtu.be/abcdefghijk'));
    await act(async () => props().onResolve());
    await vi.waitFor(() => expect(props().resolvedTitle).toBe('Reference'));

    expect(fetcher).toHaveBeenNthCalledWith(
      1,
      '/api/tools/youtube-audio/resolve',
      expect.objectContaining({
        body: JSON.stringify({ url: 'https://youtu.be/abcdefghijk' }),
        credentials: 'same-origin',
        method: 'POST',
      }),
    );
    expect(transcodeProps).toMatchObject({
      externalSource: {
        id: resolved.sourceId,
        input: resolved.input,
        name: resolved.input.name,
        size: resolved.input.http.size,
      },
      initialFormat: 'mp3',
      title: null,
    });
  });

  it('localizes server error codes without exposing upstream details', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify({ error: 'UNSUPPORTED_VIDEO' }), { status: 422 }));
    render(fetcher);

    act(() => props().onUrlChange('https://youtu.be/abcdefghijk'));
    await act(async () => props().onResolve());
    await vi.waitFor(() => expect(props().error).toContain('finite audio source'));
    expect(transcodeProps).toBeNull();
  });

  it('revokes the exact source when the user clears it', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify(resolved), { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    render(fetcher);
    act(() => props().onUrlChange('https://youtu.be/abcdefghijk'));
    await act(async () => props().onResolve());
    await vi.waitFor(() => expect(props().resolvedTitle).toBe('Reference'));

    act(() => props().onClear());
    expect(fetcher).toHaveBeenNthCalledWith(
      2,
      `/api/tools/youtube-audio/sources/${resolved.sourceId}`,
      expect.objectContaining({ keepalive: true, method: 'DELETE' }),
    );
    expect(props().resolvedTitle).toBeNull();
  });
});
