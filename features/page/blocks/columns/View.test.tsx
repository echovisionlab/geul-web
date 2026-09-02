import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ColumnsView } from './View';

describe('ColumnsView', () => {
  it('renders nested sections without React list-key warnings', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    let html = '';
    let warningText = '';

    try {
      html = renderToStaticMarkup(
        <ColumnsView
          props={{ columnRatios: '1:1', gap: '24' }}
          columns={[
            {
              id: 'column-1',
              sections: [
                { id: 'section-1', type: 'external-video', settings: {}, props: {} },
                { id: 'section-2', type: 'external-video', settings: {}, props: {} },
              ],
            },
          ]}
          renderSection={(section) => <span>{section.id}</span>}
        />,
      );
      warningText = consoleError.mock.calls.flat().join(' ');
    } finally {
      consoleError.mockRestore();
    }

    expect(html).toContain('section-1');
    expect(html).toContain('section-2');
    expect(warningText).not.toContain('Each child in a list should have a unique');
  });
});
