import type { Meta, StoryObj } from '@storybook/nextjs';
import { Container } from '@mantine/core';
import { useTranslations } from 'next-intl';
import {
  AudioTranscodeToolView,
  type AudioTranscodeToolViewProps,
  type AudioTranscodeToolLabels,
} from '../transcode/ui';

import {
  YoutubeAudioToolView,
  type YoutubeAudioToolLabels,
  type YoutubeAudioToolViewProps,
} from './ui/YoutubeAudioToolView';

function LocalizedSourceView(props: YoutubeAudioToolViewProps) {
  const t = useTranslations('tools.youtubeAudio');
  const translated = { ...props.labels };
  for (const key of Object.keys(translated) as (keyof YoutubeAudioToolLabels)[]) {
    translated[key] = t(key);
  }
  return (
    <YoutubeAudioToolView
      {...props}
      labels={translated}
      error={props.error === null ? null : t('errors.INVALID_REQUEST')}
    />
  );
}

function LocalizedConverter(props: AudioTranscodeToolViewProps) {
  const t = useTranslations('tools.transcode');
  const translated = { ...props.labels };
  for (const key of Object.keys(translated) as (keyof AudioTranscodeToolLabels)[]) {
    translated[key] = t(key);
  }
  const statusKeys = {
    inspecting: 'statusInspecting',
    queued: 'statusQueued',
    converting: 'statusConverting',
    complete: 'statusComplete',
    unsupported: 'statusUnsupported',
    error: 'statusError',
  } as const;
  return (
    <AudioTranscodeToolView
      {...props}
      labels={translated}
      sampleRateOptions={props.sampleRateOptions.map((option) => ({
        ...option,
        label:
          option.value === 'automatic'
            ? t('automatic')
            : option.value === 'source'
              ? t('preserveSource')
              : option.label,
      }))}
      encodingControls={props.encodingControls.map((control) => ({ ...control, label: t('bitrate') }))}
      files={props.files.map((file) => ({
        ...file,
        statusLabel: t(statusKeys[file.status]),
        sourceSummary: t('sourceSummary', {
          container: 'M4A',
          sampleRate: '48 kHz',
          channels: t('stereo'),
          bitDepth: 'AAC',
        }),
        progressLabel:
          file.progress === null ? null : t('progressLabel', { phase: t('statusConverting'), progress: file.progress }),
      }))}
    />
  );
}

const labels: YoutubeAudioToolLabels = {
  title: 'YouTube Audio',
  urlLabel: 'Video link',
  urlPlaceholder: 'https://…',
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
    download: 'Download converted file',
    downloadSource: 'Download original',
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
      outputSummary: null,
      status: 'ready',
      statusLabel: 'Ready',
      message: null,
      progress: null,
      progressLabel: null,
      downloadHref: null,
      downloadName: null,
      canDownloadSource: true,
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
  sampleRate: 'automatic',
  sampleRateOptions: [
    { value: 'automatic', label: 'Automatic' },
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
  statusMessage: null,
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
  onDownloadSource: () => {},
} satisfies AudioTranscodeToolViewProps;

const meta = {
  title: 'Feature/Tools/YouTube Audio',
  component: YoutubeAudioToolView,
  render: (args) => <LocalizedSourceView {...args} />,
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
    converter: <LocalizedConverter {...converterArgs} />,
  },
};

export const Converting: Story = {
  args: {
    ...Ready.args,
    converter: (
      <LocalizedConverter
        {...converterArgs}
        canConvertAll={false}
        canCancelAll
        isConverting
        files={[
          {
            ...converterArgs.files[0],
            status: 'converting',
            statusLabel: 'Converting',
            progress: 38,
            progressLabel: 'Converting: 38%',
            canDownloadSource: false,
            canCancel: true,
            canRemove: false,
          },
        ]}
      />
    ),
  },
};

export const Complete: Story = {
  args: {
    ...Ready.args,
    converter: (
      <LocalizedConverter
        {...converterArgs}
        canConvertAll={false}
        files={[
          {
            ...converterArgs.files[0],
            status: 'complete',
            statusLabel: 'Complete',
            outputSummary: 'MP3 · 320 kbps CBR · 8.5 MB',
            downloadHref: 'data:audio/mpeg;base64,',
            downloadName: 'field-recording-reference.mp3',
          },
        ]}
      />
    ),
  },
};

export const InvalidUrl: Story = {
  args: {
    url: 'https://example.com/not-youtube',
    error: 'Enter a valid YouTube video URL.',
  },
};
