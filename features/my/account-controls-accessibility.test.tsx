// @vitest-environment jsdom
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TestProviders } from '@/test/TestProviders';
import sessionStory from './SessionManagementView.stories';
import socialStory from './ConnectedSocialAccountsView.stories';
import { SessionManagementView } from './ui/SessionManagement';
import { ConnectedSocialAccountsView } from './ui/ConnectedSocialAccounts';

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
function describedBy(element: Element) {
  return (element.getAttribute('aria-describedby') ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .map((id) => document.getElementById(id)?.textContent ?? '')
    .join(' ');
}
function LocalSessions() {
  const [sessions, setSessions] = useState(sessionStory.args.sessions);
  return (
    <SessionManagementView
      {...sessionStory.args}
      sessions={sessions}
      onRevokeSession={(id) => setSessions((current) => current.filter((session) => session.id !== id))}
      onRevokeOtherSessions={() =>
        setSessions((current) => current.filter((session) => session.id === sessionStory.args.currentSessionId))
      }
    />
  );
}
describe('account security control targets', () => {
  it('keeps the current session and restores heading focus after the bulk logout command', () => {
    act(() =>
      root.render(
        <TestProviders>
          <LocalSessions />
        </TestProviders>,
      ),
    );
    const logout = host.querySelector<HTMLButtonElement>('[data-testid=security-revoke-other-sessions]')!;
    expect(logout).toHaveAccessibleName(sessionStory.args.labels.logOutOthers);
    logout.focus();
    act(() => logout.click());
    expect(host.querySelectorAll('[role=group]')).toHaveLength(1);
    expect(host.textContent).toContain(sessionStory.args.labels.thisDevice);
    expect(host.querySelector('[data-testid=security-revoke-other-sessions]')).toBeNull();
    expect(document.activeElement?.textContent).toBe(sessionStory.args.labels.title);
  });

  it('keeps session command names concise, describes their exact row and restores focus after revocation', () => {
    act(() =>
      root.render(
        <TestProviders>
          <LocalSessions />
        </TestProviders>,
      ),
    );
    const phone = host.querySelector<HTMLButtonElement>('[data-testid=security-revoke-session-phone-session]')!;
    const desktop = host.querySelector<HTMLButtonElement>('[data-testid=security-revoke-session-desktop-session]')!;
    expect(phone.getAttribute('aria-label')).toBe(sessionStory.args.labels.revoke);
    expect(describedBy(phone)).toContain('203.0.113.*');
    expect(describedBy(desktop)).toContain('2001:db8:abcd:*');
    phone.focus();
    act(() => phone.click());
    expect(document.activeElement).toBe(desktop);
    act(() => desktop.click());
    expect(host.querySelectorAll('[role=group]')).toHaveLength(1);
    expect(document.activeElement?.textContent).toBe(sessionStory.args.labels.title);
  });
  it('exposes a protected provider reason to screen-reader navigation as well as the tooltip', () => {
    act(() =>
      root.render(
        <TestProviders>
          <ConnectedSocialAccountsView {...socialStory.args} unlinkBlockedReasons={{ google: 'last_method' }} />
        </TestProviders>,
      ),
    );
    const disconnect = host.querySelector<HTMLButtonElement>('[data-testid=security-disconnect-google]')!;
    expect(disconnect.disabled).toBe(true);
    expect(disconnect.getAttribute('aria-label')).toBe(socialStory.args.labels.disconnect);
    expect(describedBy(disconnect)).toContain('Google');
    expect(describedBy(disconnect)).toContain(socialStory.args.labels.lastMethod);
    expect(describedBy(disconnect.closest('[role=group]')!)).toContain(socialStory.args.labels.lastMethod);
    const connect = host.querySelector<HTMLButtonElement>('[data-testid=security-connect-github]')!;
    expect(connect.textContent).toBe(socialStory.args.labels.connect);
    expect(describedBy(connect)).toContain('GitHub');
  });
});
