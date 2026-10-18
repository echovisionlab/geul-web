import { describe, expect, it } from 'vitest';
import { formatDisplayUrl } from './url';

describe('formatDisplayUrl', () => {
  it('drops the scheme and trailing slash of a short address', () => {
    expect(formatDisplayUrl('https://example.com/tickets/')).toBe('example.com/tickets');
  });

  it('reduces a deep address to its host so the value stays scannable', () => {
    expect(formatDisplayUrl('https://park1538.posco.com:8243/S91/S91G10/web/user/kor/announcement/KP-K11-01.do')).toBe(
      'park1538.posco.com/…',
    );
  });
});
