import { describe, expect, it } from 'vitest';
import { parseFormProps } from './schema';

describe('parseFormProps', () => {
  it.each([undefined, null, {}])('shows the form title by default for stored props %j', (props) => {
    expect(parseFormProps(props)).toEqual({ formId: '', showTitle: 'true' });
  });

  it.each([{ showTitle: false }, { showTitle: 'no' }, { formId: 1 }])('rejects malformed stored props %j', (props) => {
    expect(() => parseFormProps(props)).toThrow();
  });
});
