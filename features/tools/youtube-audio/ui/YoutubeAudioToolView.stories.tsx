import type { Meta, StoryObj } from '@storybook/nextjs';
import { Container } from '@mantine/core';

import { YoutubeAudioToolView, type YoutubeAudioToolLabels } from './YoutubeAudioToolView';

const labels: YoutubeAudioToolLabels = {
  title: 'YouTube Audio',
  description: 'Load a YouTube audio source as MP3 by default, or choose another output format.',
  sourceTitle: 'YouTube source',
  sourceDescription: 'The server resolves a short-lived audio source. Conversion stays in your browser.',
  urlLabel: 'YouTube URL',
  urlDescription: 'Paste a youtube.com or youtu.be video URL.',
  urlPlaceholder: 'https://www.youtube.com/watch?v=...',
  resolve: 'Load audio',
  resolving: 'Loading audio',
  ready: 'Source ready',
  clear: 'Clear source',
};

const converterArgs = {
  title: null,
  labels: {
    title: 'Audio transcoder',
    notices: 'Open-source licenses',
    targetIdle: 'Waiting',
    targetChecking: 'Checking support',
    targetReady: 'Ready',
    targetError: 'Unavailable',
    dropTitle: 'Drop or choose audio files',
    dropDescription: 'Processed on this device',
    chooseFiles: 'Choose audio files',
    supportedFormatsLabel: 'Supported formats',
    supportedFormats: 'CAF, AIFF, WAV, FLAC, MP3, AAC/M4A, Ogg/Opus, MP4, MOV, MKV/WebM, and TS.',
    filesSelected: 'Files',
    outputSettings: 'Output settings',
    outputSettingsHelper: 'Channels stay unchanged. Automatic selects a compatible rate.',
    processingDetails: 'Processing details',
    processingDetailsDescription: 'Balanced resampling. Integer output is dithered.',
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
  },
  files: [
    {
      id: 'source_12345678',
      name: 'field-recording-reference.m4a',
      sizeLabel: '5.8 MB',
      sourceSummary: 'M4A · 48 kHz · Stereo · AAC',
      outputSummary: 'MP3 · 320 kbps CBR · 48 kHz · Stereo',
      status: 'ready',
      statusLabel: 'Ready',
      message: null,
      progress: null,
      progressLabel: null,
      downloadHref: null,
      downloadName: null,
      canRetry: false,
      canCancel: false,
      canRemove: true,
    },
  ],
  accept: 'audio/*',
  maxFiles: 1,
  noticesHref: 'https://github.com/echovisionlab/audio-transcoder/blob/v0.1.0/THIRD_PARTY_NOTICES.md',
  format: 'mp3',
  formatOptions: [
    { value: 'wav', label: 'WAV' },
    { value: 'aiff', label: 'AIFF' },
    { value: 'aac', label: 'AAC' },
    { value: 'ogg', label: 'Ogg Opus' },
    { value: 'mp3', label: 'MP3' },
    { value: 'flac', label: 'FLAC' },
  ],
  sampleRate: 'source',
  sampleRateOptions: [
    { value: 'source', label: 'Preserve source' },
    { value: '48000', label: '48 kHz' },
  ],
  encodingControls: [
    {
      id: 'bitrate-bps',
      label: 'Bitrate',
      value: '320000',
      options: [
        { value: '128000', label: '128 kbps · CBR' },
        { value: '192000', label: '192 kbps · CBR' },
        { value: '256000', label: '256 kbps · CBR' },
        { value: '320000', label: '320 kbps · CBR' },
      ],
    },
  ],
  targetStatus: 'ready',
  targetMessage: null,
  capacityError: null,
  statusMessage: 'The authenticated source is ready to convert locally.',
  settingsNotice: null,
  canAddFiles: false,
  canConvertAll: true,
  canCancelAll: false,
  canClear: true,
  isConverting: false,
  showFilePicker: false,
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
  title: 'Feature/Tools/YouTube Audio',
  component: YoutubeAudioToolView,
  tags: ['youtube-audio'],
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <Container size="lg" py="xl">
        <Story />
      </Container>
    ),
  ],
  args: {
    labels,
    url: '',
    resolving: false,
    error: null,
    resolvedTitle: null,
    converter: null,
    onUrlChange: () => {},
    onResolve: () => {},
    onClear: () => {},
  },
} satisfies Meta<typeof YoutubeAudioToolView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {};

export const Resolving: Story = {
  args: {
    url: 'https://www.youtube.com/watch?v=abcdefghijk',
    resolving: true,
  },
};

export const Ready: Story = {
  args: {
    url: 'https://www.youtube.com/watch?v=abcdefghijk',
    resolvedTitle: 'Field recording reference',
    converter: (
      <div role="region" aria-label={converterArgs.labels.queue}>
        <button type="button">{converterArgs.labels.convert}</button>
      </div>
    ),
  },
};

export const InvalidUrl: Story = {
  args: {
    url: 'https://example.com/not-youtube',
    error: 'Enter a valid YouTube video URL.',
  },
};
