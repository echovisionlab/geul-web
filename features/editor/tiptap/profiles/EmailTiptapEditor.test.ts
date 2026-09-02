import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import {
  findUnsupportedEmailCampaignTiptapNode,
  normalizeEmailCampaignPreviewHtml,
  normalizeEmailCampaignVariable,
} from './EmailTiptapEditor';

describe('EmailTiptapEditor profile', () => {
  it('accepts durable email and campaign nodes', () => {
    const doc = new Y.Doc();
    const fragment = doc.getXmlFragment('document-store');
    const blockGroup = new Y.XmlElement('blockgroup');
    const container = new Y.XmlElement('blockcontainer');
    container.insert(0, [new Y.XmlElement('paragraph')]);
    blockGroup.insert(0, [container]);
    fragment.insert(0, [blockGroup]);

    expect(findUnsupportedEmailCampaignTiptapNode(fragment)).toBeNull();
  });

  it('accepts a Callout with nested durable content', () => {
    const doc = new Y.Doc();
    const fragment = doc.getXmlFragment('document-store');
    const blockGroup = new Y.XmlElement('blockgroup');
    const calloutContainer = new Y.XmlElement('blockcontainer');
    const childGroup = new Y.XmlElement('blockgroup');
    const paragraphContainer = new Y.XmlElement('blockcontainer');
    calloutContainer.insert(0, [new Y.XmlElement('callout')]);
    paragraphContainer.insert(0, [new Y.XmlElement('paragraph')]);
    childGroup.insert(0, [paragraphContainer]);
    calloutContainer.insert(1, [childGroup]);
    blockGroup.insert(0, [calloutContainer]);
    fragment.insert(0, [blockGroup]);

    expect(findUnsupportedEmailCampaignTiptapNode(fragment)).toBeNull();
  });

  it('returns an explicit error for a node Tiptap does not support', () => {
    const doc = new Y.Doc();
    const fragment = doc.getXmlFragment('document-store');
    fragment.insert(0, [new Y.XmlElement('unsupportedEmailBlock')]);

    expect(findUnsupportedEmailCampaignTiptapNode(fragment)).toBe(
      'Unsupported email/campaign Tiptap node: unsupportedEmailBlock',
    );
  });

  it('rejects file nodes because email delivery does not materialize rich-text attachments', () => {
    const doc = new Y.Doc();
    const fragment = doc.getXmlFragment('document-store');
    fragment.insert(0, [new Y.XmlElement('file')]);

    expect(findUnsupportedEmailCampaignTiptapNode(fragment)).toBe('Unsupported email/campaign Tiptap node: file');
  });

  it('formats variables and preserves placeholder links for email previews', () => {
    expect(normalizeEmailCampaignVariable('recipient_name')).toBe('{{recipient_name}}');
    expect(normalizeEmailCampaignVariable('{{site_name}}')).toBe('{{site_name}}');
    expect(normalizeEmailCampaignVariable('   ')).toBe('');
    expect(normalizeEmailCampaignPreviewHtml('<a href="https://{{verification_url}}">Verify</a>')).toBe(
      '<a href="{{verification_url}}">Verify</a>',
    );
  });
});
