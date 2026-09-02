import { Awareness } from 'y-protocols/awareness';
import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { createCollaborationConfig } from './createCollaborationConfig';

describe('createCollaborationConfig', () => {
  it('returns the default document-store fragment, provider awareness, and authenticated local user', () => {
    const doc = new Y.Doc();
    const awareness = new Awareness(doc);

    expect(
      createCollaborationConfig({
        provider: { awareness },
        doc,
        userName: '  Mina Park  ',
        userColor: '#8A2BE2',
      }),
    ).toEqual({
      fragment: doc.getXmlFragment('document-store'),
      awareness,
      localUser: { name: 'Mina Park', color: '#8a2be2' },
    });

    awareness.destroy();
    doc.destroy();
  });

  it('supports an explicit fragment and generates a six-digit hex color', () => {
    const doc = new Y.Doc();

    const config = createCollaborationConfig({
      provider: {},
      doc,
      fragmentName: 'email-template',
      userName: 'Mina Park',
    });

    expect(config.fragment).toBe(doc.getXmlFragment('email-template'));
    expect(config.awareness).toBeUndefined();
    expect(config.localUser).toEqual({
      name: 'Mina Park',
      color: expect.stringMatching(/^#[0-9a-f]{6}$/i),
    });

    doc.destroy();
  });

  it('normalizes an unavailable provider awareness to undefined', () => {
    const doc = new Y.Doc();

    expect(
      createCollaborationConfig({ provider: { awareness: null }, doc, userName: 'Mina Park' }).awareness,
    ).toBeUndefined();

    doc.destroy();
  });

  it.each(['', '   '])('rejects a missing authenticated user name: %j', (userName) => {
    const doc = new Y.Doc();

    expect(() => createCollaborationConfig({ provider: {}, doc, userName })).toThrow(
      'Collaboration requires a non-empty authenticated user name.',
    );

    doc.destroy();
  });

  it('rejects a color the Tiptap collaboration extension cannot render', () => {
    const doc = new Y.Doc();

    expect(() =>
      createCollaborationConfig({
        provider: {},
        doc,
        userName: 'Mina Park',
        userColor: 'rgb(1, 2, 3)',
      }),
    ).toThrow('Collaboration user color must be a six-digit hex color (#RRGGBB).');

    doc.destroy();
  });
});
