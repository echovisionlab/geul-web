import { describe, expect, it } from 'vitest';
import { campaignSchema, emailTemplateSchema, policySchema } from './schema';

const restrictedBlockKinds = [
  'paragraph',
  'heading',
  'bulletListItem',
  'numberedListItem',
  'checkListItem',
  'quote',
  'codeBlock',
  'divider',
  'table',
  'callout',
];

describe('restricted rich-text profiles', () => {
  it.each([
    ['policy', policySchema],
    ['email', emailTemplateSchema],
    ['campaign', campaignSchema],
  ])('keeps %s authoring on the generated restricted profile kinds', (_name, schema) => {
    expect(Object.keys(schema.blockSchema)).toEqual(restrictedBlockKinds);
    expect(schema.blockSchema).not.toHaveProperty('file');
    expect(schema.blockSchema).not.toHaveProperty('map');
    expect(schema.blockSchema).not.toHaveProperty('math');
  });
});
