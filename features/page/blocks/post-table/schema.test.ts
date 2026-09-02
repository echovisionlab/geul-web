import { describe, expect, it } from 'vitest';
import { parsePostTableProps } from './schema';

describe('postTableSchema', () => {
  it('shows published and archived Posts by default', () => {
    expect(parsePostTableProps({}).statuses).toBe('POST_STATUS_PUBLISHED,POST_STATUS_ARCHIVED');
  });
});
