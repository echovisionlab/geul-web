// @vitest-environment jsdom
import { fireEvent, render, screen } from '@/test/render';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PageLoaderView } from './PageLoaderView';

describe('PageLoaderView', () => {
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
