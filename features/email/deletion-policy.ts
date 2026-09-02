export type EmailTemplateDeleteBlocker = 'in-use';

export function getEmailTemplateDeleteBlocker(input: { eventKey?: string }): EmailTemplateDeleteBlocker | null {
  return input.eventKey ? 'in-use' : null;
}

export function isEmailLayoutDeleteBlocked(input: { campaignCount: number; templateCount: number }): boolean {
  return input.campaignCount > 0 || input.templateCount > 0;
}
