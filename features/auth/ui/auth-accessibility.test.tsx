// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DesignSystemTestProvider } from '@/test/TestProviders';
import verificationStory from './VerificationFlowView.stories';
import { VerificationFlowView } from './VerificationFlowView';
import { AuthCodeChallengeView } from './AuthCodeChallengeView';

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});
function render(view: React.ReactNode) {
  act(() => root.render(<DesignSystemTestProvider>{view}</DesignSystemTestProvider>));
}
function descriptions(element: Element) {
  return (element.getAttribute('aria-describedby') ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .map((id) => document.getElementById(id)?.textContent ?? '')
    .join(' ');
}
describe('authentication accessibility without changing display copy', () => {
  it('keeps the verification back label and action without an arrow or accidental form submission', () => {
    const back = vi.fn();
    const requestCode = vi.fn();
    render(
      <VerificationFlowView
        {...verificationStory.args}
        state="choose_email"
        onBack={back}
        onRequestCode={requestCode}
      />,
    );
    const button = host.querySelector<HTMLButtonElement>('[data-testid="verification-back"]')!;
    expect(button).toHaveAccessibleName(verificationStory.args.labels.back);
    expect(button.querySelector('svg')).toBeNull();
    expect(button.type).toBe('button');
    act(() => button.focus());
    act(() => button.click());
    expect(back).toHaveBeenCalledOnce();
    expect(requestCode).not.toHaveBeenCalled();
    expect(button).toHaveFocus();
  });

  it('keeps the countdown readable without announcing every second and announces expiry separately', () => {
    const props = verificationStory.args;
    const challenge = (seconds: number) => (
      <AuthCodeChallengeView
        code="12"
        labels={props.labels.code}
        onCodeChange={() => {}}
        onSubmit={() => {}}
        onResend={() => {}}
        submitting={false}
        timing={{ expiresInSeconds: seconds, flowExpiresInSeconds: 90, resendInSeconds: 0 }}
      />
    );
    render(challenge(10));
    const timer = host.querySelector('[role="timer"]')!;
    const status = host.querySelector('[role="status"]')!;
    expect(timer.textContent).toBe('Code expires in 0:10');
    expect(timer.getAttribute('aria-live')).toBe('off');
    expect(status.textContent).toBe('');
    render(challenge(9));
    expect(timer.textContent).toBe('Code expires in 0:09');
    expect(status.textContent).toBe('');
    render(challenge(0));
    expect(status.textContent).toBe(props.labels.code.codeExpired);
    expect([...host.querySelectorAll<HTMLInputElement>('input')].every((input) => input.disabled)).toBe(true);
    expect(host.querySelector('[data-testid="auth-code-resend"]')?.hasAttribute('disabled')).toBe(false);
  });

  it('moves focus between actual email, code, applying, completion and start-over steps', () => {
    const view = (state: 'choose_email' | 'sent_email' | 'applying' | 'passed') => (
      <VerificationFlowView {...verificationStory.args} state={state} />
    );
    render(view('choose_email'));
    const form = host.querySelector('form')!;
    expect(document.getElementById(form.getAttribute('aria-labelledby')!)?.textContent).toBe(
      verificationStory.args.labels.chooseTitle,
    );
    render(view('sent_email'));
    expect(document.activeElement).toBe(host.querySelector('input'));
    expect(descriptions(host.querySelector('input')!)).toContain(verificationStory.args.labels.sentDescription);
    render(view('applying'));
    expect(document.activeElement).toBe(host.querySelector('h1'));
    render(view('passed'));
    expect(document.activeElement?.textContent).toBe(verificationStory.args.labels.passedTitle);
    render(view('choose_email'));
    expect(document.activeElement).toBe(host.querySelector('input[type=email]'));
  });

  it('connects every PIN digit to the existing code error and keeps typed digits', () => {
    render(<VerificationFlowView {...verificationStory.args} state="sent_email" code="123" error="Code rejected" />);
    const inputs = [...host.querySelectorAll<HTMLInputElement>('input')];
    expect(inputs.map((input) => input.value).join('')).toBe('123');
    for (const input of inputs) {
      expect(input.getAttribute('aria-invalid')).toBe('true');
      expect(descriptions(input)).toContain('Code rejected');
      expect(descriptions(input)).toContain(verificationStory.args.labels.sentDescription);
    }
  });
  it('restores a usable code input when a rejected asynchronous submission had disabled the focused digit', () => {
    render(<VerificationFlowView {...verificationStory.args} state="sent_email" code="123456" submittingCode />);
    expect([...host.querySelectorAll<HTMLInputElement>('input')].every((input) => input.disabled)).toBe(true);
    render(<VerificationFlowView {...verificationStory.args} state="sent_email" code="123456" error="Code rejected" />);
    expect(document.activeElement).toBe(host.querySelector('input'));
    expect([...host.querySelectorAll<HTMLInputElement>('input')].map((input) => input.value).join('')).toBe('123456');
  });
});
