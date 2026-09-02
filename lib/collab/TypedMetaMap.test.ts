import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { z } from 'zod';
import { TypedMetaMap } from './TypedMetaMap';

const TestSchema = z.object({
  requiredValue: z.string(),
  optionalValue: z.string().nullable().optional(),
});

describe('TypedMetaMap', () => {
  it('does not materialize optional fields whose default is absent', () => {
    const doc = new Y.Doc();
    const yMap = doc.getMap('meta');
    const metaMap = new TypedMetaMap(yMap, TestSchema, new Set());

    metaMap.initAll({ requiredValue: 'default' });

    expect(yMap.toJSON()).toEqual({ requiredValue: 'default' });
    expect(yMap.has('optionalValue')).toBe(false);

    doc.destroy();
  });

  it('materializes an explicit null for an optional nullable field', () => {
    const doc = new Y.Doc();
    const yMap = doc.getMap('meta');
    const metaMap = new TypedMetaMap(yMap, TestSchema, new Set());

    metaMap.initAll({ requiredValue: 'default', optionalValue: null });

    expect(yMap.toJSON()).toEqual({ requiredValue: 'default', optionalValue: null });

    doc.destroy();
  });
});
