// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { render, screen, within } from '@/test/render';

import { TestProviders } from '@/test/TestProviders';
import { ArtistListEditor, ArtistListSettingsEditor } from './artist-grid/Editor';
import { AuthorListEditor, AuthorListSettingsEditor } from './author-list/Editor';
import { LabelListEditor, LabelListSettingsEditor } from './label-list/Editor';
import { PostListEditor, PostListSettingsEditor } from './post-list/Editor';
import { ProgramEventListEditor, ProgramEventListSettingsEditor } from './program-event-list/Editor';
import { ReleaseListEditor, ReleaseListSettingsEditor } from './releases-gallery/Editor';
import { WorkListEditor, WorkListSettingsEditor } from './works-gallery/Editor';
import { sectionSettingsSchema } from './section-base-schema';

const editorContext = vi.hoisted(() => ({
  editable: true,
  allowStructuralEdits: true,
  updateSection: vi.fn(),
}));

vi.mock('@/features/page/PageEditor/PageEditorContext', () => ({ usePageEditor: () => editorContext }));
vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ data: [], isFetched: true, isFetching: false, isError: false, isPending: false }),
}));
vi.mock('@/lib/actions/category', () => ({ listCategoriesAction: vi.fn() }));
vi.mock('@/lib/actions/tag', () => ({ listTagsAction: vi.fn() }));
vi.mock('@/lib/actions/user', () => ({ listAuthorOptionsAction: vi.fn(), listAuthorsAction: vi.fn() }));
vi.mock('@/lib/actions/artist', () => ({ listArtistsAction: vi.fn() }));
vi.mock('@/lib/queries/series-browser', () => ({ listSeriesSimple: vi.fn() }));
vi.mock('@/lib/queries/label-browser', () => ({ listLabelsForSelector: vi.fn() }));
vi.mock('@/lib/queries/user-browser', () => ({ searchMembers: vi.fn() }));
vi.mock('@/lib/queries/program-event-browser', () => ({
  listProgramEventTypeOptionsBrowser: vi.fn(),
  listProgramEventSeriesOptionsBrowser: vi.fn(),
}));
vi.mock('./artist-grid/View', () => ({ ArtistListView: () => null }));
vi.mock('./author-list/View', () => ({ AuthorListView: () => null }));
vi.mock('./label-list/View', () => ({ LabelListView: () => null }));
vi.mock('./post-list/View', () => ({ PostListView: () => null }));
vi.mock('./program-event-list/View', () => ({ ProgramEventListView: () => null }));
vi.mock('./releases-gallery/View', () => ({ ReleaseListView: () => null }));
vi.mock('./works-gallery/View', () => ({ WorkListView: () => null }));

const editors = [
  ['posts', PostListSettingsEditor, PostListEditor],
  ['events', ProgramEventListSettingsEditor, ProgramEventListEditor],
  ['artists', ArtistListSettingsEditor, ArtistListEditor],
  ['releases', ReleaseListSettingsEditor, ReleaseListEditor],
  ['works', WorkListSettingsEditor, WorkListEditor],
  ['labels', LabelListSettingsEditor, LabelListEditor],
  ['authors', AuthorListSettingsEditor, AuthorListEditor],
] as const;

const fixtureProps = {
  layout: 'grid' as const,
  itemSize: 'm' as const,
  source: 'selected' as const,
  authorIds: 'author-1,author-2',
};

describe('collection source settings permissions', () => {
  beforeEach(() => {
    editorContext.editable = true;
    editorContext.allowStructuralEdits = true;
    editorContext.updateSection.mockClear();
  });

  function expectDisabledControls(node: React.ReactElement) {
    const document = new DOMParser().parseFromString(
      renderToStaticMarkup(<TestProviders>{node}</TestProviders>),
      'text/html',
    );
    const output = within(document.body);
    const roles = ['button', 'checkbox', 'switch', 'radio', 'textbox', 'combobox', 'spinbutton'] as const;
    const controls = roles.flatMap((role) => output.queryAllByRole(role, { hidden: true }));
    expect(controls.length).toBeGreaterThan(0);
    for (const control of controls) {
      expect(
        control.hasAttribute('disabled') || control.getAttribute('aria-disabled') === 'true',
        control.outerHTML,
      ).toBe(true);
    }
  }

  it.each(editors)('disables all %s shared controls for a translator', (_name, SettingsEditor) => {
    const updateSharedProps = vi.fn();
    expectDisabledControls(
      <SettingsEditor
        sectionId="collection"
        props={fixtureProps}
        settings={sectionSettingsSchema.parse({})}
        allowSharedEdits={false}
        updateSharedProps={updateSharedProps}
        updateLocalizedProps={vi.fn()}
        updateSettings={vi.fn()}
      />,
    );
    expect(updateSharedProps).not.toHaveBeenCalled();
  });

  it.each(editors)('keeps %s controls usable for a source editor', async (_name, SettingsEditor) => {
    const updateSharedProps = vi.fn();
    const { user } = render(
      <SettingsEditor
        sectionId="collection"
        props={fixtureProps}
        settings={sectionSettingsSchema.parse({})}
        allowSharedEdits
        updateSharedProps={updateSharedProps}
        updateLocalizedProps={vi.fn()}
        updateSettings={vi.fn()}
      />,
    );
    const toggle = [...screen.queryAllByRole('checkbox'), ...screen.queryAllByRole('switch')][0];
    expect(toggle).toBeDefined();
    expect(toggle).toBeEnabled();
    await user.click(toggle!);
    expect(updateSharedProps).toHaveBeenCalled();
  });

  it.each(editors)('reflects structural permissions in the legacy %s editor', (_name, _SettingsEditor, Editor) => {
    editorContext.allowStructuralEdits = false;
    expectDisabledControls(<Editor sectionId="collection" props={fixtureProps} />);
    expect(editorContext.updateSection).not.toHaveBeenCalled();
  });
});
