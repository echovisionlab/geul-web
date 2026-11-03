// @vitest-environment jsdom
import { fireEvent, render, screen } from '@/test/render';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TestProviders } from '@/test/TestProviders';
import { PageLoader } from './PageLoader';

let settingsMock = { loader_urls: [] as string[] };
vi.mock('next/image', () => ({
  default: ({
    src,
    alt,
    unoptimized,
    preload,
    onError,
    width,
    height,
  }: {
    src: string;
    alt: string;
    unoptimized?: boolean;
    preload?: boolean;
    onError?: () => void;
    width?: number;
    height?: number;
  }) => (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      data-unoptimized={String(unoptimized)}
      data-preload={String(preload)}
      width={width}
      height={height}
      onError={onError}
    />
  ),
}));
vi.mock('next-intl', () => ({
  useTranslations: () => () => '불러오는 중...',
  NextIntlClientProvider: ({ children }: { children: import('react').ReactNode }) => children,
}));
vi.mock('@/lib/contexts/ManifestContext', () => ({ useSiteSettings: () => ({ settings: settingsMock }) }));
vi.mock('@/lib/public-runtime-config', () => ({ getPublicCdnUrl: () => 'https://cdn.fixture.test' }));

beforeEach(() => {
  settingsMock = { loader_urls: [] };
});

describe('PageLoader', () => {
  it('passes inverse contrast through the controller while retaining localized fallback and GIF delivery', () => {
    settingsMock.loader_urls = ['/asset/configured-loader.gif'];
    const { rerender } = render(<PageLoader contrast="inverse" message=" " />);
    expect(screen.getByRole('status')).toHaveAttribute('data-contrast', 'inverse');
    expect(screen.getByRole('status')).toHaveTextContent('불러오는 중...');
    const image = screen.getByRole('img');
    expect(image).toHaveAttribute('data-unoptimized', 'true');
    rerender(<PageLoader />);
    expect(screen.getByRole('status')).toHaveAttribute('data-contrast', 'standard');
    expect(screen.getByRole('img')).toBe(image);
  });

  it('uses the same first nonblank GIF for server markup and client rerenders without preload or optimization', () => {
    settingsMock.loader_urls = [
      ' ',
      'https://cdn.example.com/first.GIF?version=2#loader',
      'https://cdn.example.com/second.webp',
    ];
    const random = vi.spyOn(Math, 'random');
    try {
      const markup = renderToStaticMarkup(
        <TestProviders>
          <PageLoader />
        </TestProviders>,
      );
      expect(markup).toContain('first.GIF?version=2#loader');
      expect(markup).not.toContain('rel="preload"');
      const { rerender } = render(<PageLoader />);
      const image = screen.getByRole('img');
      expect(image).toHaveAttribute('src', settingsMock.loader_urls[1]);
      expect(image).toHaveAttribute('data-unoptimized', 'true');
      expect(image).toHaveAttribute('data-preload', 'undefined');
      expect(screen.getByRole('status')).toHaveTextContent('불러오는 중...');
      rerender(<PageLoader />);
      expect(screen.getByRole('img')).toBe(image);
      expect(random).not.toHaveBeenCalled();
    } finally {
      random.mockRestore();
    }
  });

  it.each([undefined, '불러오는 중...', '', '   '])(
    'shows localized default text for message %j with no configured image',
    (message) => {
      render(<PageLoader message={message} />);
      expect(screen.getByRole('status', { name: '불러오는 중...' })).toHaveTextContent('불러오는 중...');
      expect(screen.queryByRole('img')).not.toBeInTheDocument();
    },
  );

  it('shows a distinct phase beside the image and keeps it after image failure', () => {
    settingsMock.loader_urls = ['https://cdn.example.com/loader.gif'];
    const { rerender } = render(<PageLoader message={' \tConnecting \n'} />);
    expect(screen.getByRole('status', { name: '불러오는 중...' }).textContent).toBe('Connecting');
    fireEvent.error(screen.getByRole('img'));
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Connecting');
    rerender(<PageLoader message="Loading roads and labels" />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading roads and labels');
  });

  it('resolves managed GIF paths through the CDN', () => {
    settingsMock.loader_urls = ['/asset/configured-loader.gif?version=2'];
    render(<PageLoader />);
    expect(screen.getByRole('img')).toHaveAttribute(
      'src',
      'https://cdn.fixture.test/asset/configured-loader.gif?version=2',
    );
    expect(screen.getByRole('img')).toHaveAttribute('data-unoptimized', 'true');
  });

  it('keeps default text on image failure and shows a newly configured source', () => {
    settingsMock.loader_urls = ['https://cdn.example.com/loader.gif', 'https://cdn.example.com/second.webp'];
    const { rerender } = render(<PageLoader extent="tall" size="sm" />);
    expect(screen.getByRole('img')).toHaveAttribute('width', '64');
    fireEvent.error(screen.getByRole('img'));
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('불러오는 중...');
    settingsMock.loader_urls = ['https://cdn.example.com/replacement.svg?version=2'];
    rerender(<PageLoader extent="tall" size="sm" placement="flow" />);
    expect(screen.getByRole('img')).toHaveAttribute('src', settingsMock.loader_urls[0]);
    expect(screen.getByRole('img')).toHaveAttribute('data-unoptimized', 'true');
    expect(screen.getByRole('status')).toHaveAttribute('data-placement', 'flow');
    expect(screen.getByRole('status')).toHaveAttribute('data-extent', 'tall');
  });
});
