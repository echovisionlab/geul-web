// @vitest-environment jsdom

import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MantineProvider } from '@mantine/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SeriesPublicPostsView, SeriesPublicView } from './SeriesPublicView';

let container: HTMLDivElement;
let root: Root;

const labels = {
  title: 'Title',
  authors: 'Authors',
  published: 'Published',
  empty: 'No posts found',
  untitled: 'Untitled',
  unknown: 'Unknown',
};

function render(view: ReactNode) {
  act(() => {
    root.render(<MantineProvider env="test">{view}</MantineProvider>);
  });
}

describe('SeriesPublicView', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  it('renders the title, image, controls, and posts without the stored summary description', () => {
    const series = {
      title: 'Night Walks',
      description: 'Stored series summary',
      featuredImageUrl: 'https://cdn.example.test/series.jpg',
    };
    render(
      <SeriesPublicView {...series} postsLabel="Posts" controls={<button type="button">Share</button>}>
        <SeriesPublicPostsView
          posts={[
            {
              id: 'post-1',
              title: 'Listening to the city',
              slug: 'listening-to-the-city',
              authors: [{ id: 'member-1', name: 'Mina Park' }],
            },
          ]}
          labels={labels}
        />
      </SeriesPublicView>,
    );

    expect(container.querySelector('h1')).toHaveTextContent(series.title);
    expect(container.querySelectorAll('h1')).toHaveLength(1);
    expect(container.querySelector('h2')).toHaveTextContent('Posts');
    expect(container.querySelector('img')).toHaveAttribute('alt', series.title);
    expect(container.querySelector('button')).toHaveTextContent('Share');
    expect(container.querySelector('a')).toHaveAttribute('href', '/posts/listening-to-the-city');
    expect(container).toHaveTextContent('Listening to the city');
    expect(container).toHaveTextContent('Mina Park');
    expect(container).not.toHaveTextContent(series.description);
  });

  it('keeps the empty post section without using the stored summary as content', () => {
    const series = { title: 'Empty series', description: 'Stored series summary' };
    render(
      <SeriesPublicView {...series} postsLabel="Posts">
        <SeriesPublicPostsView posts={[]} labels={labels} />
      </SeriesPublicView>,
    );

    expect(container.querySelector('h1')).toHaveTextContent(series.title);
    expect(container.querySelector('h2')).toHaveTextContent('Posts');
    expect(container).toHaveTextContent(labels.empty);
    expect(container.querySelector('img')).toBeNull();
    expect(container).not.toHaveTextContent(series.description);
  });
});
