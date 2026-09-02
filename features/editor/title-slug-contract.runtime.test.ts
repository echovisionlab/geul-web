import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function source(path: string): string {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

describe('existing entity title and slug contract', () => {
  it.each([
    ['Page', '../page/PageEditor/PageEditor.tsx'],
    ['Post', '../post/PostEditor/PostEditor.tsx'],
    ['Work', '../work/WorkEditor/WorkEditor.tsx'],
    ['Release', '../release/ReleaseEditor/ReleaseEditor.tsx'],
    ['Artist', '../artist/ArtistEditor/ArtistDetailEditor.tsx'],
    ['Label', '../label/AdminLabelDetailClient.tsx'],
    ['Series', '../series/SeriesDetail.tsx'],
    ['Form', '../form/FormSettingsContent.tsx'],
    ['Event', '../program-event/ProgramEventEditor/ProgramEventEditor.tsx'],
    ['Event Series', '../program-event/ProgramEventSeriesEditor/ProgramEventSeriesEditor.tsx'],
  ])('does not derive the %s slug from an edited title', (_domain, path) => {
    const editor = source(path);

    expect(editor).not.toContain('slugMgmt.updateFromTitle');
    expect(editor).not.toContain('updateSlugFromTitle');
    expect(editor).not.toContain('next.slug = generateSlug(value)');
    expect(editor).not.toContain('debouncedMetaUpdate({ slug: nextSlug })');
  });

  it('keeps empty title drafts inside the shared header until text becomes non-empty', () => {
    const header = source('../../components/core/EditorHeader/EditorHeaderView.tsx');

    expect(header).toContain('const [draftTitle, setDraftTitle] = useState(title);');
    expect(header).toContain('if (value.trim())');
    expect(header).toContain('placeholder={titlePlaceholder ?? labels.untitled}');
  });
});
