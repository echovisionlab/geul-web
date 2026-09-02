import { describe, expect, it } from 'vitest';
import {
  parseUserDisplaySnapshot,
  readUserDisplaySnapshotFromCookie,
  serializeUserDisplaySnapshot,
} from './user-display-cookie';

describe('user display cookie helpers', () => {
  it('serializes and parses a user snapshot', () => {
    const value = serializeUserDisplaySnapshot({
      name: 'Tester',
      image: 'https://example.com/avatar.png',
    });

    expect(parseUserDisplaySnapshot(value)).toEqual({
      name: 'Tester',
      image: 'https://example.com/avatar.png',
    });
  });

  it('reads a user snapshot from a cookie header', () => {
    const cookieHeader = `foo=bar; geul_user_display=${serializeUserDisplaySnapshot({
      name: 'Tester',
      image: null,
    })}`;

    expect(readUserDisplaySnapshotFromCookie(cookieHeader)).toEqual({
      name: 'Tester',
      image: null,
    });
  });

  it('rejects malformed snapshots', () => {
    expect(parseUserDisplaySnapshot('not-json')).toBeNull();
    expect(parseUserDisplaySnapshot(encodeURIComponent(JSON.stringify({ image: 'x' })))).toBeNull();
  });
});
