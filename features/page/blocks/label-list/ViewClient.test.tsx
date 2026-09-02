// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import koMessages from '@/messages/ko.json';
import { TestProviders } from '@/test/TestProviders';
import { parseLabelListProps } from './schema';
import { LabelListViewClient } from './ViewClient';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('LabelListViewClient', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('renders label country metadata as a localized country name', () => {
    act(() => {
      root.render(
        <TestProviders locale="ko" messages={koMessages}>
          <LabelListViewClient
            labels={[
              {
                id: 'label-1',
                href: '/labels/label-1',
                title: 'Label One',
                imageUrl: null,
                countryCode: 'KR',
              },
            ]}
            parsedProps={parseLabelListProps({
              layout: 'list',
              showImage: 'false',
              showMeta: 'true',
            })}
          />
        </TestProviders>,
      );
    });

    expect(container.textContent).toContain('대한민국');
    expect(container.textContent).not.toContain('KR');
  });
});
