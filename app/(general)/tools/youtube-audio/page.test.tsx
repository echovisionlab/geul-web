import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  getTranslations: vi.fn(),
  notFound: vi.fn(),
}));

vi.mock('next/navigation', () => ({ notFound: mocks.notFound }));
vi.mock('next-intl/server', () => ({ getTranslations: mocks.getTranslations }));
vi.mock('@/lib/utils/session.server', () => ({ getSession: mocks.getSession }));
vi.mock('@/features/tools/youtube-audio/YoutubeAudioTool', () => ({
  YoutubeAudioTool: () => <div data-testid="youtube-audio-tool" />,
}));

import YoutubeAudioPage, { generateMetadata } from './page';

describe('YouTube audio tool page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.notFound.mockImplementation(() => {
      throw new Error('notFound');
    });
  });

  it('returns not found instead of redirecting an anonymous visitor', async () => {
    mocks.getSession.mockResolvedValue(null);

    await expect(YoutubeAudioPage()).rejects.toThrow('notFound');
    expect(mocks.notFound).toHaveBeenCalledOnce();
  });

  it('does not expose tool metadata to an anonymous visitor', async () => {
    mocks.getSession.mockResolvedValue(null);

    const metadata = await generateMetadata();

    expect(metadata.title).toBeUndefined();
    expect(metadata.description).toBeUndefined();
    expect(metadata.robots).toEqual(expect.objectContaining({ follow: false, index: false }));
    expect(mocks.getTranslations).not.toHaveBeenCalled();
  });

  it('renders the tool for an authenticated Member', async () => {
    mocks.getSession.mockResolvedValue({ user: { id: 'member-1' } });

    await expect(YoutubeAudioPage()).resolves.toBeTruthy();
    expect(mocks.notFound).not.toHaveBeenCalled();
  });
});
