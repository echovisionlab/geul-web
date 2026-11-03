// @vitest-environment jsdom
import { fireEvent, render, screen } from '@/test/render';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PageLoaderView, type PageLoaderViewContrast } from './PageLoaderView';

describe('PageLoaderView', () => {
  it('changes contrast on the same compact status without replacing its image or placement', () => {
    const props = { imageAlt: 'Loading page', imageSrc: '/loader.gif', message: 'Loading' };
    const { rerender } = render(<PageLoaderView {...props} />);
    const status = screen.getByRole('status');
    const image = screen.getByRole('img');
    expect(status).toHaveAttribute('data-contrast', 'standard');
    expect(screen.getByText('Loading')).toHaveAttribute('data-tone', 'inherit');
    rerender(<PageLoaderView {...props} contrast="inverse" />);
    expect(screen.getByRole('status')).toBe(status);
    expect(screen.getByRole('img')).toBe(image);
    expect(status).toHaveAttribute('data-contrast', 'inverse');
    expect(status).toHaveAttribute('data-placement', 'fill');
    expect(screen.getByText('Loading')).toHaveAttribute('data-size', 'xs');
    fireEvent.error(image);
    expect(status).toHaveTextContent(/^Loading$/);
    expect(status).toHaveAttribute('data-contrast', 'inverse');
  });

  it('rejects an unsupported contrast from an untyped caller', () => {
    expect(() =>
      renderToStaticMarkup(
        <PageLoaderView imageAlt="Loading page" message="Loading" contrast={'image' as PageLoaderViewContrast} />,
      ),
    ).toThrow('PageLoaderView contrast must be standard or inverse');
  });

  it('keeps accessible names separate from visible phase text, including after image failure', () => {
    const props = { imageSrc: '/loader.gif', imageAlt: 'Loading page', imageUnoptimized: true };
    const { rerender } = render(<PageLoaderView {...props} message="Connecting" />);
    const status = screen.getByRole('status', { name: 'Loading page' });
    expect(status).not.toHaveAttribute('aria-busy');
    expect(status).toHaveTextContent(/^Connecting$/);
    expect(screen.getByRole('img', { name: 'Loading page' })).toBeInTheDocument();
    expect(screen.getByText('Connecting')).toHaveAttribute('data-size', 'xs');
    fireEvent.error(screen.getByRole('img'));
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(status).toHaveTextContent(/^Connecting$/);
    rerender(<PageLoaderView {...props} message="Loading content" />);
    expect(status).toHaveTextContent('Loading content');
    expect(screen.getAllByRole('status')).toHaveLength(1);
  });

  it('shows the explicit message without an image', () => {
    render(<PageLoaderView imageAlt="Loading page" message="Preparing content" />);
    expect(screen.getByRole('status', { name: 'Loading page' })).toHaveTextContent(/^Preparing content$/);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it.each(['', ' \t\n '])('rejects blank visible message %j instead of displaying imageAlt', (message) => {
    expect(() => renderToStaticMarkup(<PageLoaderView imageAlt="Loading page" message={message} />)).toThrow(
      'PageLoaderView requires a nonblank visible message',
    );
  });

  it('preserves fill defaults and lets a flow region reserve its own height', () => {
    const props = { imageAlt: 'Loading page', message: 'Loading' };
    const { rerender } = render(<PageLoaderView {...props} />);
    expect(screen.getByRole('status')).toHaveAttribute('data-placement', 'fill');
    expect(screen.getByRole('status')).toHaveStyle({ height: '100%', minHeight: '200px' });
    rerender(<PageLoaderView {...props} placement="flow" minHeight={160} />);
    expect(screen.getByRole('status')).toHaveAttribute('data-placement', 'flow');
    expect(screen.getByRole('status')).toHaveStyle({ height: 'auto', minHeight: '160px' });
    rerender(<PageLoaderView {...props} placement="flow" height={240} minHeight={0} />);
    expect(screen.getByRole('status')).toHaveStyle({ height: '240px', minHeight: '0' });
  });
});
