import { describe, expect, it } from 'vitest';
import { parseColumnsProps } from './schema';

describe('parseColumnsProps', () => {
  it.each([undefined, null, {}])('lays out stored props %j as two equal stacking columns', (props) => {
    expect(parseColumnsProps(props)).toEqual({ columns: '2', gap: '24', columnRatios: '1:1', mobileStack: 'true' });
  });

  it.each(['2', '3', '4'])('keeps a stored count of %s columns', (columns) => {
    expect(parseColumnsProps({ columns }).columns).toBe(columns);
  });

  it.each([{ columns: '1' }, { columns: '5' }, { columns: 3 }, { mobileStack: false }])(
    'rejects malformed stored props %j',
    (props) => {
      expect(() => parseColumnsProps(props)).toThrow();
    },
  );
});
