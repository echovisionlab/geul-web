// @vitest-environment jsdom
import { MediaProcessingStatus } from '@echovisionlab/geul-proto/common/media_pb.ts';
import { render, screen, waitFor } from '@/test/render';
import { FileMediaPreview, type FileMediaPreviewSource } from './FileMediaPreview';

// Only the third-party playback runtimes are replaced. The real players, playback controller,
// WaveSurfer mount and video.js mount run; the fakes record what reaches the media runtime.
const runtime = vi.hoisted(() => ({
  hls: [] as Array<{ src: string; media: HTMLMediaElement }>,
  waveSurfers: [] as Array<{ media: HTMLMediaElement; peaks?: number[][] }>,
}));

vi.mock('hls.js', () => ({
  default: class FakeHls {
    static isSupported = () => true;
    private source = '';
    loadSource(src: string) {
      this.source = src;
    }
    attachMedia(media: HTMLMediaElement) {
      runtime.hls.push({ src: this.source, media });
    }
    destroy() {}
  },
}));

vi.mock('wavesurfer.js', () => ({
  default: {
    create: (options: { media: HTMLMediaElement; peaks?: number[][] }) => {
      runtime.waveSurfers.push(options);
      return {
        on: () => () => undefined,
        getDuration: () => 0,
        setTime: () => undefined,
        setOptions: () => undefined,
        destroy: () => undefined,
      };
    },
  },
}));

// Like video.js, the fake applies the poster and the selected source to the mounted media element.
vi.mock('video.js', () => {
  const videojs = Object.assign(
    (video: HTMLVideoElement, options: { poster?: string; sources: Array<{ src: string }> }) => {
      if (options.poster) {
        video.setAttribute('poster', options.poster);
      }
      video.setAttribute('src', options.sources[0]?.src ?? '');
      return {
        width: () => undefined,
        el: () => video,
        addClass: () => undefined,
        on: () => undefined,
        ready: (callback: () => void) => callback(),
        paused: () => true,
        error: () => undefined,
        dispose: () => undefined,
      };
    },
    { getPlayer: () => undefined, hook: () => undefined, addLanguage: () => undefined },
  );
  return { default: videojs };
});

const waveformPeaks = [0.1, 0.5, 0.9];

beforeEach(() => {
  runtime.hls.length = 0;
  runtime.waveSurfers.length = 0;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => ({ ok: url === '/waveform.json', json: async () => waveformPeaks })),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const audioSource: FileMediaPreviewSource = {
  fileId: 'audio-1',
  name: 'field-recording.wav',
  mimeType: 'audio/wav',
};

describe('FileMediaPreview', () => {
  it('plays audio from the HLS stream with the waveform sidecar and no spectrogram', async () => {
    render(
      <FileMediaPreview
        source={{
          ...audioSource,
          originalUrl: '/audio.mp3',
          hlsUrl: '/audio.m3u8',
          waveformUrl: '/waveform.json',
          processingStatus: MediaProcessingStatus.READY,
        }}
      />,
    );

    expect(screen.getByRole('group', { name: 'field-recording.wav' })).toBeInTheDocument();
    await waitFor(() =>
      expect(runtime.waveSurfers).toContainEqual(expect.objectContaining({ peaks: [waveformPeaks] })),
    );
    const waveform = runtime.waveSurfers.find((options) => options.peaks);
    expect(runtime.hls).toContainEqual({ src: '/audio.m3u8', media: waveform?.media });
    expect(screen.getByRole('button', { name: 'Play audio' })).toBeEnabled();
    expect(screen.queryByRole('img', { name: 'Audio spectrogram' })).not.toBeInTheDocument();
  });

  it.each<{ status: string; source: Partial<FileMediaPreviewSource>; playable: boolean }>([
    { status: 'an unspecified status with a playable URL', source: { originalUrl: '/audio.mp3' }, playable: true },
    {
      status: 'a ready status without a URL',
      source: { processingStatus: MediaProcessingStatus.READY },
      playable: false,
    },
    {
      status: 'a failed status with a playable URL',
      source: { originalUrl: '/audio.mp3', processingStatus: MediaProcessingStatus.FAILED },
      playable: false,
    },
  ])('enables playback only when ready: $status', async ({ source, playable }) => {
    render(<FileMediaPreview source={{ ...audioSource, ...source }} />);

    if (source.originalUrl || source.hlsUrl) {
      await waitFor(() => expect(runtime.waveSurfers).toHaveLength(1));
    }
    expect(screen.getByRole('button', { name: 'Play audio' })).toHaveProperty('disabled', !playable);
  });

  it('plays a ready video through the shared player from the HLS stream with its poster', async () => {
    render(
      <FileMediaPreview
        source={{
          fileId: 'video-1',
          name: 'performance.mp4',
          mimeType: 'video/mp4',
          originalUrl: '/video.mp4',
          hlsUrl: '/video.m3u8',
          posterUrl: '/poster.jpg',
          processingStatus: MediaProcessingStatus.READY,
        }}
      />,
    );

    const video = await screen.findByLabelText('performance.mp4', { selector: 'video' });
    expect(video).toHaveAttribute('src', '/video.m3u8');
    expect(video).toHaveAttribute('poster', '/poster.jpg');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('shows a processing status for a video that is still being processed', () => {
    render(
      <FileMediaPreview
        source={{
          fileId: 'video-1',
          name: 'performance.mp4',
          mimeType: 'video/mp4',
          originalUrl: '/video.mp4',
          hlsUrl: '/video.m3u8',
          posterUrl: '/poster.jpg',
          processingStatus: MediaProcessingStatus.PROCESSING,
        }}
      />,
    );

    expect(screen.getByRole('group', { name: 'performance.mp4' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Processing video...');
  });
});
