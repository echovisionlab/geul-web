import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getMapThemeByIdAction: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error('not-found');
  }),
}));

vi.mock('next/navigation', () => ({ notFound: mocks.notFound }));
vi.mock('@/features/admin/MapThemeEditor/ThemeEditorPage', () => ({
  ThemeEditorPage: () => null,
}));
vi.mock('@/lib/actions/map-theme', () => ({
  getMapThemeByIdAction: mocks.getMapThemeByIdAction,
}));

import EditThemePage from './page';

const THEME_ID = '019efc7d-0620-7281-9627-5e1877a8445c';
const theme = {
  id: THEME_ID,
  name: 'Theme',
  settings: {},
  lightVariant: {},
  darkVariant: {},
};

describe('Map Theme editor route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getMapThemeByIdAction.mockResolvedValue(theme);
  });

  it('returns the actual Next.js 404 for an invalid ID without querying the API', async () => {
    await expect(EditThemePage({ params: Promise.resolve({ id: 'not-a-theme-id' }) })).rejects.toThrow('not-found');
    expect(mocks.getMapThemeByIdAction).not.toHaveBeenCalled();
  });

  it('returns 404 for a non-canonical uppercase UUID before querying the API', async () => {
    await expect(EditThemePage({ params: Promise.resolve({ id: THEME_ID.toUpperCase() }) })).rejects.toThrow(
      'not-found',
    );
    expect(mocks.getMapThemeByIdAction).not.toHaveBeenCalled();
  });

  it('returns the actual Next.js 404 for a missing Theme', async () => {
    mocks.getMapThemeByIdAction.mockResolvedValue(null);

    await expect(EditThemePage({ params: Promise.resolve({ id: THEME_ID }) })).rejects.toThrow('not-found');
    expect(mocks.getMapThemeByIdAction).toHaveBeenCalledWith(THEME_ID);
  });

  it('renders the editor from the authoritative server lookup', async () => {
    const result = await EditThemePage({ params: Promise.resolve({ id: THEME_ID }) });

    expect(result.props).toEqual({ themeId: THEME_ID, initialTheme: theme });
  });
});
