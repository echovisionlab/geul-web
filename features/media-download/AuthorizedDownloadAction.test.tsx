// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import {
  FileDownloadAction,
  FileDownloadAvailability,
  PublicMediaEntityType,
} from '@echovisionlab/geul-proto/public/file_pb.ts';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TestProviders } from '@/test/TestProviders';
import { AuthorizedDownloadAction } from './AuthorizedDownloadAction';

vi.mock('@/lib/queries/file-download-browser', () => ({
  authorizeFileDownload: vi.fn(),
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement | null = null;
let root: Root | null = null;

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  host = null;
  root = null;
});

function renderAction(props: Partial<React.ComponentProps<typeof AuthorizedDownloadAction>> = {}) {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => {
    root?.render(
      <TestProviders>
        <AuthorizedDownloadAction
          entityType={PublicMediaEntityType.POST}
          entityId="post-1"
          selector={{ blockId: 'block-1', referencePath: 'file' }}
          fileName="field-recording.wav"
          title="Field recording"
          availability={FileDownloadAvailability.AVAILABLE}
          action={FileDownloadAction.DOWNLOAD}
          {...props}
        />
      </TestProviders>,
    );
  });
}

describe('AuthorizedDownloadAction', () => {
  it('uses a fresh Post response download ref without calling File authorization', async () => {
    const authorize = vi.fn();
    const navigate = vi.fn();
    renderAction({
      authorize,
      navigate,
      allowFileAuthorization: false,
      initialDownloadUrl: 'https://download.example/file.wav?token=post-read',
      initialDownloadExpiresAt: new Date(Date.now() + 60_000).toISOString(),
    });

    await act(async () => {
      host?.querySelector('button')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    expect(authorize).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith('https://download.example/file.wav?token=post-read');
  });

  it('refreshes an expired Post response ref through the owning Post callback', async () => {
    const authorize = vi.fn(async () => ({
      access: {
        availability: FileDownloadAvailability.AVAILABLE,
        action: FileDownloadAction.DOWNLOAD,
      },
      download: { url: 'https://download.example/file.wav?token=refreshed-post-read' },
    }));
    const navigate = vi.fn();
    renderAction({
      authorize,
      navigate,
      allowFileAuthorization: false,
      initialDownloadUrl: 'https://download.example/file.wav?token=expired',
      initialDownloadExpiresAt: new Date(Date.now() - 1_000).toISOString(),
    });

    await act(async () => {
      host?.querySelector('button')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    expect(authorize).toHaveBeenCalledOnce();
    expect(navigate).toHaveBeenCalledWith('https://download.example/file.wav?token=refreshed-post-read');
  });

  it('authorizes only on click and navigates to the returned expiring URL', async () => {
    const authorize = vi.fn(async () => ({
      access: {
        availability: FileDownloadAvailability.AVAILABLE,
        action: FileDownloadAction.DOWNLOAD,
      },
      download: { url: 'https://download.example/file.wav?token=click-time' },
    }));
    const navigate = vi.fn();
    renderAction({ authorize, navigate });

    expect(authorize).not.toHaveBeenCalled();
    const button = host?.querySelector('button');
    await act(async () => {
      button?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    expect(authorize).toHaveBeenCalledWith({
      entityType: PublicMediaEntityType.POST,
      entityId: 'post-1',
      selector: { blockId: 'block-1', referencePath: 'file' },
    });
    expect(navigate).toHaveBeenCalledWith('https://download.example/file.wav?token=click-time');
  });

  it('uses the sign-in redirect without calling authorization', () => {
    const authorize = vi.fn();
    const navigate = vi.fn();
    renderAction({
      action: FileDownloadAction.SIGN_IN,
      authorize,
      navigate,
      returnTo: '/posts/field-recording',
    });

    act(() => {
      host?.querySelector('button')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(authorize).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(expect.stringContaining('/login?redirect='));
  });

  it('renders only a minimal unavailable state with no download button', () => {
    renderAction({
      availability: FileDownloadAvailability.UNAVAILABLE,
      action: FileDownloadAction.NONE,
    });

    expect(host?.querySelector('button')).toBeNull();
    expect(host?.querySelector('[role="status"]')?.textContent).toBe('Unavailable');
  });

  it('renders an icon control for media player toolbars', () => {
    renderAction({ presentation: 'icon' });

    const button = host?.querySelector<HTMLButtonElement>('[data-authorized-download-action="icon"]');
    expect(button).not.toBeNull();
    expect(button?.textContent).toBe('');
    expect(button?.getAttribute('aria-label')).toContain('Field recording');
  });

  it('keeps an unavailable player download visible but disabled', () => {
    renderAction({
      presentation: 'icon',
      availability: FileDownloadAvailability.UNAVAILABLE,
      action: FileDownloadAction.NONE,
    });

    expect(host?.querySelector<HTMLButtonElement>('[data-authorized-download-action="icon"]')?.disabled).toBe(true);
    expect(host?.querySelector('[role="status"]')).toBeNull();
  });
});
