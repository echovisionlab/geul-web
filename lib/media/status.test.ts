import { describe, expect, it } from 'vitest';
import {
  createMediaStatusLabels,
  DEFAULT_MEDIA_STATUS_LABELS,
  resolveMediaLifecycleDisplay,
  resolveMediaStatusDisplay,
} from './status';

describe('media status helpers', () => {
  it('formats ingest lifecycle stages with progress', () => {
    expect(resolveMediaLifecycleDisplay('downloading', 42, DEFAULT_MEDIA_STATUS_LABELS)).toEqual({
      label: 'Downloading 42%',
      color: 'blue',
    });
  });

  it('formats finalizing as a processing-style stage', () => {
    expect(resolveMediaLifecycleDisplay('finalizing', 100, DEFAULT_MEDIA_STATUS_LABELS)).toEqual({
      label: 'Finalizing 100%',
      color: 'cyan',
    });
  });

  it('falls back to ready for completed media status', () => {
    expect(
      resolveMediaStatusDisplay({
        status: 'completed',
        labels: DEFAULT_MEDIA_STATUS_LABELS,
      }),
    ).toEqual({
      label: 'Ready',
      color: 'green',
    });
  });

  it('falls back to default labels when a translation key is missing', () => {
    const labels = createMediaStatusLabels((key) => {
      if (key === 'statuses.stage.validating') {
        throw new Error('MISSING_MESSAGE');
      }
      if (key === 'statuses.ready') {
        return '준비됨';
      }
      return key;
    });

    expect(labels.stage.validating).toBe(DEFAULT_MEDIA_STATUS_LABELS.stage.validating);
    expect(labels.ready).toBe('준비됨');
  });

  it('uses aggregate processing label instead of raw job stage for processing status', () => {
    expect(
      resolveMediaStatusDisplay({
        status: 'processing',
        progress: 67,
        stage: 'spectrogram_processing',
        labels: DEFAULT_MEDIA_STATUS_LABELS,
      }),
    ).toEqual({
      label: 'Processing 67%',
      color: 'cyan',
    });
  });
});
