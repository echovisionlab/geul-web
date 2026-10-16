import { normalizeRichTextHtmlLinks } from '@echovisionlab/geul-common/editor/link-normalization';

export function normalizeEmailCampaignVariable(variable: string): string {
  const trimmed = variable.trim();
  if (!trimmed) {
    return '';
  }
  return trimmed.startsWith('{{') && trimmed.endsWith('}}') ? trimmed : `{{${trimmed}}}`;
}

export function normalizeEmailCampaignPreviewHtml(html: string): string {
  return normalizeRichTextHtmlLinks(html);
}
