// @vitest-environment jsdom
import { render, screen } from '@/test/render';
import { describe, expect, it, vi } from 'vitest';
import { SummaryFieldCard } from './SummaryFieldCard';

describe('SummaryFieldCard', () => {
  it('reports each manual summary edit', async () => {
    const onSummaryChange = vi.fn();
    const view = render(
      <SummaryFieldCard entityType="post" entityId="post-1" summary="" onSummaryChange={onSummaryChange} />,
    );
    const textbox = screen.getByRole('textbox');
    expect(textbox).not.toHaveAttribute('readonly');
    await view.user.type(textbox, 'A');
    expect(onSummaryChange).toHaveBeenLastCalledWith('A');
  });

  it('keeps a read-only summary unchanged', () => {
    render(<SummaryFieldCard entityType="post" entityId="post-1" summary="Summary" summaryReadOnly />);
    expect(screen.getByRole('textbox')).toHaveAttribute('readonly');
    expect(screen.getByRole('textbox')).toHaveValue('Summary');
  });
});
