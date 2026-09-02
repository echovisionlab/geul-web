# Storybook media fixtures

These files are local-only Storybook fixtures and are not part of the production `public` assets.

- `audio-sample.mp3`: project-supplied MP3 with container metadata removed.
- `video-sample.mp4`: project-supplied AVI transcoded to browser-compatible H.264/AAC MP4.
- `video-poster.jpg`: frame extracted from `video-sample.mp4`.
- `image-sample.heic`: small HEIC image used to verify browser decoding and crop previews.
- `example-studio-logo.svg`: deterministic neutral logo used by public-shell stories.

Storybook serves this directory at `/storybook/media` through `.storybook/main.ts`.
