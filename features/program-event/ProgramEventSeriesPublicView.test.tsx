// @vitest-environment jsdom

import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MantineProvider } from '@mantine/core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { ProgramEventSeriesPublicView } from './ProgramEventSeriesPublicView';

let container: HTMLDivElement;
let root: Root;

function render(view: ReactNode) {
  act(() => {
    root.render(<MantineProvider env="test">{view}</MantineProvider>);
  });
}

describe('ProgramEventSeriesPublicView', () => {
  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('renders the global copy, poster, controls, and events under one semantic page heading', () => {
    render(
      <ProgramEventSeriesPublicView
        title="Night Signals"
        summary="Global summary"
        description={'First line\nSecond line'}
        posterUrl="https://cdn.example.test/poster.jpg"
        controls={<button type="button">Share</button>}
        eventsLabel="Events"
      >
        <div>Event list</div>
      </ProgramEventSeriesPublicView>,
    );

    expect(container.querySelector('h1')).toHaveTextContent('Night Signals');
    expect(container.querySelectorAll('h1')).toHaveLength(1);
    expect(container.querySelector('h2')).toHaveTextContent('Events');
    expect(container).toHaveTextContent('Global summary');
    expect(container).toHaveTextContent('First line Second line');
    expect(container.querySelector('img')).toHaveAttribute('alt', 'Night Signals');
    expect(container.querySelector('button')).toHaveTextContent('Share');
    expect(container).toHaveTextContent('Event list');
  });

  it('omits absent optional copy and poster without removing the event section', () => {
    render(
      <ProgramEventSeriesPublicView title="Sparse series" eventsLabel="Events">
        <div>No events found</div>
      </ProgramEventSeriesPublicView>,
    );

    expect(container.querySelector('h1')).toHaveTextContent('Sparse series');
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('h2')).toHaveTextContent('Events');
    expect(container).toHaveTextContent('No events found');
  });
});
