// @vitest-environment jsdom
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@/test/render';
import { ContentLayoutField } from './ContentLayoutField';
import { DEFAULT_DOCUMENT_LAYOUT, type DocumentLayout } from './types';

const labels = {
  contentHeight: 'Content height',
  tableOfContents: 'Table of contents',
  content: 'Content',
  viewport: 'Viewport',
  pageChrome: 'Content chrome',
  footer: 'Footer',
  flow: 'Flow',
  pinned: 'Pinned',
};

describe('ContentLayoutField', () => {
  it('maps each author choice independently into the shared document layout', async () => {
    const changed = vi.fn();
    function Fixture() {
      const [value, setValue] = useState<DocumentLayout>(DEFAULT_DOCUMENT_LAYOUT);
      return (
        <ContentLayoutField
          value={value}
          labels={labels}
          onChange={(next) => {
            changed(next);
            setValue(next);
          }}
        />
      );
    }
    const { user } = render(<Fixture />);
    await user.click(screen.getByRole('switch', { name: labels.tableOfContents }));
    expect(changed).toHaveBeenLastCalledWith({ ...DEFAULT_DOCUMENT_LAYOUT, hideTableOfContents: true });
    await user.click(screen.getByRole('radio', { name: labels.viewport }));
    const pinned = screen.getAllByRole('radio', { name: labels.pinned });
    await user.click(pinned[0]);
    await user.click(pinned[1]);
    expect(changed).toHaveBeenLastCalledWith({
      contentHeight: 'viewport',
      pageChrome: 'pinned',
      footer: 'pinned',
      hideTableOfContents: true,
    });
    expect(screen.getByRole('radio', { name: labels.viewport })).toBeChecked();
    expect(pinned[0]).toBeChecked();
    expect(pinned[1]).toBeChecked();
    await user.click(screen.getByRole('switch', { name: labels.tableOfContents }));
    expect(changed).toHaveBeenLastCalledWith({ contentHeight: 'viewport', pageChrome: 'pinned', footer: 'pinned' });
  });
});
