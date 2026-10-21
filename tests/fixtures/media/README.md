# Storybook media fixtures

These files are local-only Storybook fixtures and are not part of the production `public` assets.

- `audio-sample.mp3`: project-supplied MP3 with container metadata removed.
- `video-sample.mp4`: project-supplied AVI transcoded to browser-compatible H.264/AAC MP4.
- `video-poster.jpg`: frame extracted from `video-sample.mp4`.
- `image-sample.heic`: small HEIC image used to verify browser decoding and crop previews.
- `example-studio-logo.svg`: deterministic neutral logo used by public-shell stories.
- `event-poster.svg`: deterministic 4:5 event poster used by public entity detail stories.
- `client-wordmark.svg`, `client-symbol.svg`: fictional 5:1 wordmark and square symbol for client logo sizing.
- `site-icon.svg`: fictional square site icon for link card stories.

Storybook serves this directory at `/storybook/media` through `.storybook/main.ts`.
