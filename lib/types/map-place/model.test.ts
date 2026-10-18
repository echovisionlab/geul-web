import { describe, expect, it } from 'vitest';
import { displayMapPlaceMemberNickname } from './model';

describe('displayMapPlaceMemberNickname', () => {
  it('never substitutes a raw Member ID when the projection is missing', () => {
    expect(displayMapPlaceMemberNickname(null)).toBe('-');
  });

  it('renders the required nickname from the Member projection', () => {
    expect(
      displayMapPlaceMemberNickname({
        id: '11111111-1111-4111-8111-111111111111',
        nickname: 'Map Author',
        avatarUrl: null,
        deleted: false,
      }),
    ).toBe('Map Author');
  });
});
