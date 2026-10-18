// @vitest-environment jsdom

import { render, screen, within } from '@/test/render';
import { describe, expect, it } from 'vitest';
import { PublicCreditList, type PublicCreditGroup } from './PublicCreditList';

function renderList(groups: PublicCreditGroup[]) {
  return render(<PublicCreditList groups={groups} label="Credits" />);
}

describe('PublicCreditList', () => {
  it('names each group list by its visible heading only when there is more than one group', () => {
    renderList([
      { id: 'production', name: 'Production', entries: [{ id: 'a', name: 'Mina Park', role: 'Sound' }] },
      { id: 'other', name: 'Other', entries: [{ id: 'b', name: 'Ara Seo', role: 'Documentation' }] },
    ]);
    expect(within(screen.getByRole('list', { name: 'Production' })).getByRole('listitem')).toHaveTextContent(
      'SoundMina Park',
    );
    expect(screen.getByRole('list', { name: 'Other' })).toBeInTheDocument();
  });

  it('drops the heading and empty groups when one group remains', () => {
    renderList([
      { id: 'production', name: 'Production', entries: [{ id: 'a', name: 'Mina Park', role: 'Sound' }] },
      { id: 'other', name: 'Other', entries: [{ id: 'b', name: null, role: 'Documentation' }] },
    ]);
    expect(screen.getByRole('list', { name: 'Credits' })).toBeInTheDocument();
    expect(screen.queryByText('Production')).toBeNull();
    expect(screen.queryByText('Documentation')).toBeNull();
  });

  it('shares one row between people with the same role, regardless of case', () => {
    renderList([
      {
        id: 'credits',
        entries: [
          { id: 'a', name: 'June Han', role: 'Mix' },
          { id: 'b', name: 'Kai Rhee', role: 'Mastering', href: '/artists/kai' },
          { id: 'c', name: 'Ara Seo', role: 'mix' },
        ],
      },
    ]);
    expect(screen.getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'MixJune Han, Ara Seo',
      'MasteringKai Rhee',
    ]);
    expect(screen.getByRole('link', { name: 'Kai Rhee' })).toHaveAttribute('href', '/artists/kai');
  });
});
