import { describe, expect, it } from 'vitest';
import { resolveExternalVideo } from '@/lib/media/external-video';

describe('resolveExternalVideo', () => {
  it.each([
    [
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=1m2s&list=x',
      'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=0&playsinline=1&start=62',
    ],
    [
      'https://youtu.be/dQw4w9WgXcQ?start=7',
      'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=0&playsinline=1&start=7',
    ],
    [
      'https://vimeo.com/123456/abcDEF?autoplay=1#t=2m3s',
      'https://player.vimeo.com/video/123456?h=abcDEF&dnt=1&autoplay=0#t=2m3s',
    ],
    [
      'https://vimeo.com/123456#tracking=x&t=1h2m3s&autoplay=1',
      'https://player.vimeo.com/video/123456?dnt=1&autoplay=0#t=1h2m3s',
    ],
    ['https://vimeo.com/channels/staffpicks/123456', 'https://player.vimeo.com/video/123456?dnt=1&autoplay=0'],
    ['https://vimeo.com/groups/animation/videos/123456', 'https://player.vimeo.com/video/123456?dnt=1&autoplay=0'],
    ['https://vimeo.com/album/99/video/123456', 'https://player.vimeo.com/video/123456?dnt=1&autoplay=0'],
  ])('canonicalizes %s', (input, expected) => expect(resolveExternalVideo(input)?.embedUrl).toBe(expected));

  it('identifies Shorts', () =>
    expect(resolveExternalVideo('https://youtube.com/shorts/dQw4w9WgXcQ')?.aspectRatio).toBe('9:16'));

  it.each(['#foo=bar', '#t=not-time&foo=bar', '#t=2m&t=3m'])('strips unsupported Vimeo fragments: %s', (fragment) => {
    expect(resolveExternalVideo(`https://vimeo.com/123456${fragment}`)?.embedUrl).toBe(
      'https://player.vimeo.com/video/123456?dnt=1&autoplay=0',
    );
  });

  it.each([
    'http://youtu.be/dQw4w9WgXcQ',
    'https://youtube.com.evil.test/watch?v=dQw4w9WgXcQ',
    'https://music.youtube.com/watch?v=dQw4w9WgXcQ',
    'https://youtube.com/playlist?list=x',
    'https://vimeo.com/manage/videos/123',
    'https://user@vimeo.com/123',
    'https://vimeo.com:444/123',
  ])('rejects %s', (input) => expect(resolveExternalVideo(input)).toBeNull());
});
