import 'server-only';

import {
  createYoutubeAudioService,
  type YoutubeAudioService,
  type YoutubeAudioSourceStore,
} from '@echovisionlab/youtube-audio';
import { createYoutubeJsAudioProvider } from '@echovisionlab/youtube-audio/youtube-js';

const provider = createYoutubeJsAudioProvider();

export function getYoutubeAudioService(origin: string, sourceStore: YoutubeAudioSourceStore): YoutubeAudioService {
  return createYoutubeAudioService({
    makeSourceUrl(sourceId) {
      return new URL(`/api/tools/youtube-audio/sources/${encodeURIComponent(sourceId)}`, origin).href;
    },
    provider,
    sourceStore,
  });
}
