import { describe, expect, it } from 'vitest';
import { parseRichTextProps } from './schema';

describe('parseRichTextProps', () => {
  it.each([undefined, null, {}, { anything: 'goes', nested: { a: 1 } }])(
    'reads stored props %j as an empty prop set because content is materialized separately',
    (props) => {
      expect(parseRichTextProps(props)).toEqual({});
    },
  );
});
