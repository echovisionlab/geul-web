/** Query-driven editor branches are separate surfaces from their public route. */
export const editorRoutePreviews = [
  ['/posts/[idOrSlug]', 'Pages/Editors/Post', 'Ready', 'features/post/PostEditor/PostEditor.tsx'],
  ['/[...slug]', 'Pages/Editors/Page', 'Ready', 'features/page/PageEditor/PageEditor.tsx'],
  ['/works/[idOrSlug]', 'Pages/Editors/Work', 'Ready', 'features/work/WorkEditor/WorkEditor.tsx'],
  ['/artists/[idOrSlug]', 'Pages/Editors/Artist', 'Ready', 'features/artist/ArtistEditor/ArtistDetailEditor.tsx'],
  ['/labels/[idOrSlug]', 'Pages/Editors/Label', 'Ready', 'features/label/AdminLabelDetailClient.tsx'],
  ['/releases/[idOrSlug]', 'Pages/Editors/Release', 'Ready', 'features/release/ReleaseEditor/ReleaseEditor.tsx'],
  [
    '/events/[idOrSlug]',
    'Pages/Editors/Program Events',
    'Event',
    'features/program-event/ProgramEventEditor/ProgramEventEditor.tsx',
  ],
  [
    '/event-series/[idOrSlug]',
    'Pages/Editors/Program Events',
    'Series',
    'features/program-event/ProgramEventSeriesEditor/ProgramEventSeriesEditor.tsx',
  ],
  ['/forms/[slug]', 'Pages/Editors/Form', 'Builder', 'features/form/AdminFormLayoutClient.tsx'],
  ['/terms/history/[id]', 'Pages/Editors/Legal', 'Terms', 'features/policy/LegalPolicyEditor.tsx'],
  ['/privacy/history/[id]', 'Pages/Editors/Legal', 'Privacy', 'features/policy/LegalPolicyEditor.tsx'],
  ['/campaigns/[id]', 'Pages/Editors/Campaign', 'Ready', 'features/campaign/CampaignEditPage.tsx'],
].map(([route, storyTitle, variant, owner]) => ({
  route,
  branch: 'edit',
  query: route === '/forms/[slug]' ? 'edit=true&tab=builder' : 'edit=true',
  storyTitle,
  variant,
  owner,
  coverage: 'page-view',
  scope:
    route === '/forms/[slug]'
      ? 'Production FormLayoutView and FormEditor/FormBuilder, including header, locale and editable schema. Builder tab only; settings/submissions/translations tabs are separate surfaces. In-memory callbacks; backend collaboration, permissions and persistence are outside.'
      : 'Complete production editor View with canonical document/controller and local state. Title, locale, metadata and body are rendered together. Server authorization, collaboration persistence, uploads, relation commands and generation are outside.',
}));

export function hasQueryEditorBranch(source) {
  return /\bisEntityEditView\s*\(|\bquery\.edit\b|\bsearchParams\.edit\b/.test(source);
}

/** A public mapping cannot satisfy the editor branch, even when both share a route. */
export function missingEditorPreviews(pages, previews) {
  return pages.filter(
    (page) =>
      hasQueryEditorBranch(page.source) &&
      !previews.some((preview) => preview.route === page.route && preview.branch === 'edit'),
  );
}
