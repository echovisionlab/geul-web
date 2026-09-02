import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./public-runtime-config', () => ({
  getPublicCdnUrl: () => 'https://cdn.example.test',
}));

describe('imageLoader', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('adds width params to relative managed asset paths', async () => {
    const { default: imageLoader } = await import('./image-loader');

    expect(imageLoader({ src: '/asset/11111111-1111-4111-8111-111111111111/image.webp', width: 640 })).toBe(
      'https://cdn.example.test/asset/11111111-1111-4111-8111-111111111111/image.webp?w=640&q=80',
    );
  });

  it('adds width params to absolute managed CDN asset URLs', async () => {
    const { default: imageLoader } = await import('./image-loader');

    expect(
      imageLoader({
        src: 'https://cdn.example.test/asset/22222222-2222-4222-8222-222222222222/image.webp?q=80',
        width: 128,
      }),
    ).toBe('https://cdn.example.test/asset/22222222-2222-4222-8222-222222222222/image.webp?q=80&w=128');
  });

  it('rounds managed image widths up to the next cache bucket', async () => {
    const { default: imageLoader } = await import('./image-loader');

    expect(imageLoader({ src: '/asset/33333333-3333-4333-8333-333333333333/image.webp', width: 81 })).toBe(
      'https://cdn.example.test/asset/33333333-3333-4333-8333-333333333333/image.webp?w=96&q=80',
    );
  });

  it('does not transform signed media delivery URLs', async () => {
    const { default: imageLoader } = await import('./image-loader');

    expect(
      imageLoader({
        src: 'https://cdn.example.test/media/signed-token/file.webp',
        width: 512,
      }),
    ).toBe('https://cdn.example.test/media/signed-token/file.webp');
  });

  it('passes through unrelated external URLs', async () => {
    const { default: imageLoader } = await import('./image-loader');

    expect(
      imageLoader({
        src: 'https://images.example.test/photo.jpg',
        width: 512,
      }),
    ).toBe('https://images.example.test/photo.jpg');
  });
});
