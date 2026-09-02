import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MediaBlockHeader } from './MediaBlockHeader';

describe('MediaBlockHeader', () => {
  it('keeps title actions on the first row and file metadata with status on the second row', () => {
    const html = renderToStaticMarkup(
      <MediaBlockHeader
        headerClassName="media-header"
        metaClassName="media-meta"
        title={<span>Field recording.wav</span>}
        meta={<span>1.0 KB</span>}
        metaEnd={<span>Ready</span>}
        end={<button type="button">Download</button>}
      />,
    );

    expect(html).toContain('data-media-block-meta-row');
    expect(html.indexOf('Field recording.wav')).toBeLessThan(html.indexOf('1.0 KB'));
    expect(html.indexOf('1.0 KB')).toBeLessThan(html.indexOf('Ready'));
    expect(html.indexOf('Ready')).toBeLessThan(html.indexOf('Download'));
  });
});
