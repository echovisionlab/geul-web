import { getSchema } from '@tiptap/core';
import { expect, it } from 'vitest';
import { createTiptapWireExtensions } from '../wire-schema';
import { assertTiptapExternalVideoSupport, UnsupportedTiptapExternalVideoError } from './ExternalVideoTiptapExtension';

it('fails explicitly when integrated without the paragraph compatibility attributes', () => {
  const schema = getSchema(createTiptapWireExtensions());
  expect(() => assertTiptapExternalVideoSupport({ schema })).toThrow(UnsupportedTiptapExternalVideoError);
});
