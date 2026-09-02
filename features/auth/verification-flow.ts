export interface VerificationFlow {
  id: string;
  expires_at?: string;
  issued_at?: string;
  updated_at?: string;
  state: 'choose_method' | 'sent_email' | 'passed_challenge';
  ui: {
    nodes: Array<{
      attributes: {
        name?: string;
        value?: string;
        type?: string;
      };
      group: string;
      type: string;
      messages?: Array<{ id: number; type: string; text: string }>;
    }>;
    messages?: Array<{ id: number; type: string; text: string }>;
  };
}

export function hasVerificationFlowError(flow: VerificationFlow | null): boolean {
  if (!flow) {
    return false;
  }
  if (flow.ui.messages?.some((message) => message.type === 'error')) {
    return true;
  }
  return flow.ui.nodes.some((node) => node.messages?.some((message) => message.type === 'error'));
}

export function parseVerificationFlow(value: unknown, expectedFlowId?: string): VerificationFlow | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  const candidate = value as Partial<VerificationFlow>;
  return typeof candidate.id === 'string' &&
    (!expectedFlowId || candidate.id === expectedFlowId) &&
    typeof candidate.state === 'string' &&
    candidate.ui &&
    Array.isArray(candidate.ui.nodes)
    ? (candidate as VerificationFlow)
    : null;
}

export function getVerificationCsrfToken(flow: VerificationFlow | null): string {
  const node = flow?.ui.nodes.find(
    (item) => item.attributes.name === 'csrf_token' && item.attributes.type === 'hidden',
  );
  return node?.attributes.value || '';
}

export function getVerificationNodeValue(flow: VerificationFlow | null, name: string): string {
  const value = flow?.ui.nodes.find((node) => node.attributes.name === name)?.attributes.value;
  return typeof value === 'string' ? value : '';
}
