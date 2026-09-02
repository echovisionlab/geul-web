// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import { blocksToHtml } from './post';

describe('table export', () => {
  it('normalizes durable column widths into a percentage colgroup', async () => {
    const html = await blocksToHtml([
      {
        id: 'table-block',
        type: 'table',
        props: {},
        content: {
          type: 'tableContent',
          columnWidths: [25, 75],
          rows: [
            {
              cells: [
                {
                  type: 'tableCell',
                  props: {},
                  content: [{ type: 'text', text: 'Left', styles: {} }],
                },
                {
                  type: 'tableCell',
                  props: {},
                  content: [{ type: 'text', text: 'Right', styles: {} }],
                },
              ],
            },
          ],
        },
        children: [],
      },
    ]);

    const container = document.createElement('div');
    container.innerHTML = html;
    const columns = Array.from(container.querySelectorAll<HTMLTableColElement>('colgroup > col'));

    expect(columns.map((column) => column.style.width)).toEqual(['25%', '75%']);
    expect(container.querySelectorAll('thead th')).toHaveLength(2);
    expect(container.querySelectorAll('tbody td')).toHaveLength(0);
  });

  it('materializes the first row as a repeatable header group and remaining rows as table body', async () => {
    const html = await blocksToHtml([
      {
        id: 'long-table',
        type: 'table',
        props: {},
        content: {
          type: 'tableContent',
          rows: [
            {
              cells: [
                { type: 'tableCell', props: {}, content: [{ type: 'text', text: 'Name', styles: {} }] },
                { type: 'tableCell', props: {}, content: [{ type: 'text', text: 'Value', styles: {} }] },
              ],
            },
            {
              cells: [
                { type: 'tableCell', props: {}, content: [{ type: 'text', text: 'Row 1', styles: {} }] },
                { type: 'tableCell', props: {}, content: [{ type: 'text', text: 'Printable', styles: {} }] },
              ],
            },
          ],
        },
        children: [],
      },
    ]);

    const container = document.createElement('div');
    container.innerHTML = html;
    expect(container.querySelector('thead')?.textContent).toBe('NameValue');
    expect(container.querySelector('tbody')?.textContent).toBe('Row 1Printable');
  });
});
