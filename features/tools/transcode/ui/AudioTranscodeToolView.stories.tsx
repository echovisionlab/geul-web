import type { Meta, StoryObj } from '@storybook/nextjs';
import { Container } from '@mantine/core';

import {
  AudioTranscodeToolView,
  type AudioTranscodeFileStatus,
  type AudioTranscodeFileViewModel,
  type AudioTranscodeToolLabels,
  type AudioTranscodeToolViewProps,
} from './AudioTranscodeToolView';

const labels: AudioTranscodeToolLabels = {
  title: 'Audio transcoder',
  notices: 'Open-source licenses',
  targetIdle: 'Waiting',
  targetChecking: 'Checking support',
  targetReady: 'Ready',
  targetError: 'Unavailable',
  dropTitle: 'Drop or choose audio files',
  dropDescription: 'Up to 10 files · No folders · Processed on this device',
  chooseFiles: 'Choose audio files',
  supportedFormatsLabel: 'Supported formats',
  supportedFormats:
    'Supported: CAF, AIFF/AIFC, WAV, FLAC, MP3, AAC/M4A, Ogg/Opus, and audio in MP4, MOV, MKV/WebM, or TS. Checked per file.',
  filesSelected: 'Files',
  outputSettings: 'Output settings',
  outputSettingsHelper: 'Channels stay unchanged. Automatic selects a compatible rate per file.',
  processingDetails: 'Processing details',
  processingDetailsDescription: 'Balanced resampling. Integer output is dithered. Large WAV files use RF64.',
  format: 'Format',
  sampleRate: 'Sample rate',
  queue: 'Conversion queue',
  convert: 'Convert',
  cancelAll: 'Cancel all',
  clear: 'Clear',
  download: 'Download',
  retry: 'Retry',
  cancel: 'Cancel',
  remove: 'Remove',
};

const formatOptions = [
  { value: 'wav', label: 'WAV' },
  { value: 'aiff', label: 'AIFF' },
  { value: 'aac', label: 'AAC' },
  { value: 'ogg', label: 'Ogg Opus' },
  { value: 'mp3', label: 'MP3' },
  { value: 'flac', label: 'FLAC' },
];

const sampleRateOptions = [
  { value: 'source', label: 'Preserve source' },
  { value: '48000', label: '48 kHz' },
  { value: '44100', label: '44.1 kHz' },
  { value: '96000', label: '96 kHz' },
];

const encodingControlsByFormat = {
  wav: [
    {
      id: 'sample-format',
      label: 'Sample format',
      value: 'integer',
      options: [
        { value: 'integer', label: 'Integer PCM' },
        { value: 'float', label: 'Float' },
      ],
    },
    {
      id: 'bit-depth',
      label: 'Bit depth',
      value: '24',
      options: [
        { value: '16', label: '16-bit' },
        { value: '24', label: '24-bit' },
        { value: '32', label: '32-bit' },
      ],
    },
  ],
  aiff: [bitDepthControl('24')],
  aac: [bitrateControl('256000', ['96000', '128000', '192000', '256000'])],
  ogg: [bitrateControl('192000', ['64000', '96000', '128000', '192000'])],
  mp3: [bitrateControl('320000', ['128000', '192000', '256000', '320000'])],
  flac: [bitDepthControl('24')],
} as const;

function bitDepthControl(value: string) {
  return {
    id: 'bit-depth',
    label: 'Bit depth',
    value,
    options: ['16', '24'].map((depth) => ({
      value: depth,
      label: `${depth}-bit`,
    })),
  };
}

function bitrateControl(value: string, values: readonly string[]) {
  return {
    id: 'bitrate-bps',
    label: 'Bitrate',
    value,
    options: values.map((bitrate) => ({
      value: bitrate,
      label: `${Number(bitrate) / 1000} kbps`,
    })),
  };
}

function fileModel(
  id: string,
  name: string,
  status: AudioTranscodeFileStatus,
  overrides: Partial<AudioTranscodeFileViewModel> = {},
): AudioTranscodeFileViewModel {
  const statusLabels: Record<AudioTranscodeFileStatus, string> = {
    inspecting: 'Inspecting',
    ready: 'Ready',
    queued: 'Queued',
    converting: 'Converting',
    complete: 'Complete',
    unsupported: 'Unsupported',
    error: 'Error',
  };

  return {
    id,
    name,
    sizeLabel: '148 MB',
    sourceSummary: '96 kHz · Stereo · 24-bit',
    outputSummary: 'WAV · PCM 24-bit · 96 kHz · Stereo',
    status,
    statusLabel: statusLabels[status],
    message: null,
    progress: null,
    progressLabel: null,
    downloadHref: null,
    downloadName: null,
    canRetry: status === 'error',
    canCancel: status === 'queued' || status === 'converting' || status === 'inspecting',
    canRemove: status !== 'queued' && status !== 'converting' && status !== 'inspecting',
    ...overrides,
  };
}

const readyFiles = [
  fileModel('field', 'ganwoljae-field-recording-2026-07-21.wav', 'ready', {
    sizeLabel: '2.84 GB',
    sourceSummary: '192 kHz · Stereo · 32-bit float',
    outputSummary: 'WAV · PCM 24-bit · 192 kHz · Stereo',
  }),
  fileModel('interview', 'interview-take-04.flac', 'ready', {
    sizeLabel: '86.2 MB',
    sourceSummary: '48 kHz · Mono · 24-bit',
    outputSummary: 'WAV · PCM 24-bit · 48 kHz · Mono',
  }),
] satisfies AudioTranscodeFileViewModel[];

const baseArgs: AudioTranscodeToolViewProps = {
  labels,
  files: [],
  accept: 'audio/*,.wav,.wave,.aif,.aiff,.flac,.mp3,.m4a,.aac,.ogg,.opus,.caf',
  maxFiles: 10,
  noticesHref: 'https://github.com/echovisionlab/audio-transcoder/blob/v0.1.0/THIRD_PARTY_NOTICES.md',
  format: 'wav',
  formatOptions,
  sampleRate: 'source',
  sampleRateOptions,
  encodingControls: encodingControlsByFormat.wav,
  targetStatus: 'ready',
  targetMessage: 'Worker ready · temporary output uses local browser storage',
  capacityError: null,
  statusMessage: null,
  settingsNotice: null,
  canAddFiles: true,
  canConvertAll: false,
  canCancelAll: false,
  canClear: false,
  isConverting: false,
  onFilesSelected: () => {},
  onFormatChange: () => {},
  onSampleRateChange: () => {},
  onEncodingChange: () => {},
  onConvertAll: () => {},
  onCancelAll: () => {},
  onClear: () => {},
  onRetry: () => {},
  onCancel: () => {},
  onRemove: () => {},
};

const meta = {
  title: 'Feature/Tools/Audio Transcoder',
  component: AudioTranscodeToolView,
  tags: ['audio-transcoder'],
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <Container size="lg" py="xl">
        <Story />
      </Container>
    ),
  ],
  args: baseArgs,
} satisfies Meta<typeof AudioTranscodeToolView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const OutputOptionsByFormat: Story = {
  name: 'Output options by format',
  args: {
    files: readyFiles.slice(0, 1),
    canConvertAll: true,
    canClear: true,
    format: 'wav',
    encodingControls: encodingControlsByFormat.wav,
  },
};

export const Ready: Story = {
  args: {
    files: readyFiles,
    canConvertAll: true,
    canClear: true,
  },
};

export const Converting: Story = {
  name: 'Converting with progress',
  args: {
    files: [
      fileModel('field', 'ganwoljae-field-recording-2026-07-21.wav', 'converting', {
        sizeLabel: '2.84 GB',
        sourceSummary: '192 kHz · Stereo · 32-bit float',
        progress: 63,
        progressLabel: 'Converting ganwoljae field recording: 63%',
        message: 'Processing locally · approximately 01:48 remaining',
      }),
      fileModel('interview', 'interview-take-04.flac', 'queued', {
        sizeLabel: '86.2 MB',
        message: 'Waiting for the active conversion to finish',
      }),
    ],
    statusMessage: 'Converting file 1 of 2: 63%.',
    canCancelAll: true,
    isConverting: true,
  },
};

export const Complete: Story = {
  args: {
    files: [
      fileModel('field', 'ganwoljae-field-recording-2026-07-21.wav', 'complete', {
        sizeLabel: '2.84 GB',
        message: 'Converted in 02:34 · output 1.92 GB',
        downloadHref: 'data:audio/wav;base64,UklGRg==',
        downloadName: 'ganwoljae-field-recording-2026-07-21-pcm24.wav',
      }),
      fileModel('interview', 'interview-take-04.flac', 'complete', {
        sizeLabel: '86.2 MB',
        sourceSummary: '48 kHz · Mono · 24-bit',
        outputSummary: 'WAV · PCM 24-bit · 48 kHz · Mono',
        message: 'Converted in 00:08 · output 128 MB',
        downloadHref: 'data:audio/wav;base64,UklGRg==',
        downloadName: 'interview-take-04-pcm24.wav',
      }),
    ],
    canClear: true,
    statusMessage: 'All 2 files are ready to download.',
  },
};

export const Error: Story = {
  args: {
    files: [
      fileModel('stream', 'festival-live-stream.m3u8', 'unsupported', {
        sizeLabel: '2 KB',
        sourceSummary: 'HLS playlist',
        outputSummary: null,
        message: 'Streaming playlists are not supported. Choose a local audio file instead.',
      }),
      fileModel('damaged', 'archive-transfer.wav', 'error', {
        sizeLabel: '4.1 GB',
        sourceSummary: 'Could not inspect audio stream',
        outputSummary: null,
        message: 'The audio header is incomplete or damaged.',
      }),
    ],
    canClear: true,
    statusMessage: 'Two files need attention.',
  },
};

export const Capacity: Story = {
  args: {
    files: Array.from({ length: 10 }, (_, index) =>
      fileModel(`capacity-${index}`, `field-recording-${String(index + 1).padStart(2, '0')}.wav`, 'ready'),
    ),
    capacityError: 'Only 10 files can be added at once. Remove a file before adding another.',
    canAddFiles: false,
    canConvertAll: true,
    canClear: true,
  },
};

export const Narrow: Story = {
  globals: { viewport: { value: 'mobile1', isRotated: false } },
  args: {
    files: [
      fileModel(
        'long-name',
        '2026-07-21-ganwoljae-dawn-field-recording-original-unedited-transfer-with-a-very-long-name.wav',
        'ready',
        {
          sizeLabel: '7.92 GB',
          sourceSummary: '192 kHz · 4 channels · 32-bit float',
          outputSummary: 'WAV · PCM 24-bit · preserve source',
        },
      ),
      fileModel('mobile-complete', 'quick-reference.aiff', 'complete', {
        downloadHref: 'data:audio/wav;base64,UklGRg==',
        downloadName: 'quick-reference-pcm24.wav',
      }),
    ],
    canConvertAll: true,
    canClear: true,
  },
};
