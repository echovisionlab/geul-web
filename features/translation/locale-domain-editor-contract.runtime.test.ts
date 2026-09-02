import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function source(path: string): string {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

describe('locale domain editor wiring', () => {
  it.each([
    ['artist', '../artist/ArtistEditor/ArtistBioEditor.tsx'],
    ['label', '../label/LabelEditor/LabelDescriptionEditor.tsx'],
    ['release', '../release/ReleaseEditor/ReleaseDescriptionEditor.tsx'],
  ])('forwards the %s target structure lock into CompactTiptapEditor', (_domain, path) => {
    expect(source(path)).toContain('structureLocked={structureLocked}');
  });

  it('keeps Artist and Label names locale-owned while neutral metadata remains source-only', () => {
    const artist = source('../artist/ArtistEditor/ArtistDetailEditor.tsx');
    const label = source('../label/AdminLabelDetailClient.tsx');

    expect(artist).toContain('const canEditNeutral = currentLocaleCanEdit && activeEditLocale.isSourceLocale;');
    expect(artist).toContain('const hasLocaleRoomMutationAuthority = localeSession.hasRoomMutationAuthority({');
    expect(artist).toContain('titleDisabled={!canEditLocalizedName}');
    expect(artist).toContain('disabled={!canEditNeutral}');
    expect(artist).toContain('structureLocked');
    expect(artist).not.toContain('slugMgmt.updateFromTitle');

    expect(label).toContain('const canEditNeutral = currentLocaleCanEdit && activeEditLocale.isSourceLocale;');
    expect(label).toContain('const hasLocaleRoomMutationAuthority = localeSession.hasRoomMutationAuthority({');
    expect(label).toContain('titleDisabled={!canEditLocalizedName}');
    expect(label).toContain('disabled={!canEditNeutral}');
    expect(label).toContain('structureLocked');
    expect(label).not.toContain('slugMgmt.updateFromTitle');
  });

  it('keeps Release and Work title text locale-owned without opening neutral metadata', () => {
    const release = source('../release/ReleaseEditor/ReleaseEditor.tsx');
    const work = source('../work/WorkEditor/WorkEditor.tsx');

    expect(release).toContain('const canEditNeutral = currentLocaleCanEdit && activeEditLocale.isSourceLocale;');
    expect(release).toContain('const hasLocaleRoomMutationAuthority = localeSession.hasRoomMutationAuthority({');
    expect(release).toContain('titleDisabled={!canEditLocalizedTitle}');
    expect(release).toContain('canEdit={canEditNeutral}');
    expect(release).toContain('structureLocked');
    expect(release).not.toContain('slugMgmt.updateFromTitle');

    expect(work).toContain('const canEditNeutral = currentLocaleCanEdit && activeEditLocale.isSourceLocale;');
    expect(work).toContain('const hasLocaleRoomMutationAuthority = localeSession.hasRoomMutationAuthority({');
    expect(work).toContain('titleDisabled={!roomLocale || !currentLocaleCanEdit || !currentIsSynced}');
    expect(work).toContain('canEdit={canEditNeutral}');
    expect(work).toContain('allowNeutralBlockEdits={activeEditLocale.isSourceLocale}');
    expect(work).not.toContain('slugMgmt.updateFromTitle');
  });

  it('binds Page and Work summary AI to the exact active locale room without replacing editor AI', () => {
    const page = source('../page/PageEditor/PageEditor.tsx');
    const work = source('../work/WorkEditor/WorkEditor.tsx');
    const tiptap = source('../editor/tiptap/TiptapEditor.tsx');

    expect(page).toContain("{ type: 'page', id: pageId, locale: roomLocale }");
    expect(page).toContain('provider={canEditLocaleDocument ? provider : null}');
    expect(page).toContain('currentMemberId={currentMemberId}');

    expect(work).toContain("{ type: 'work', id: workId, locale: roomLocale }");
    expect(work).toContain('provider={currentLocaleCanEdit ? currentProvider : null}');
    expect(work).toContain('currentMemberId={currentMemberId}');

    expect(tiptap).toContain('useTiptapAIController');
    expect(tiptap).toContain('<TiptapAIAssistantSurface');
    expect(tiptap).not.toContain('/mcp');
  });
});
