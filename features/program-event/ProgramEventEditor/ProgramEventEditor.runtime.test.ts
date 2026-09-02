import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('./ProgramEventEditor.tsx', import.meta.url), 'utf8');

describe('ProgramEventEditor collaboration runtime', () => {
  it('bridges the current Program Event Block room into translation snapshot consumers', () => {
    expect(source).toMatch(
      /<EditorRuntimeProvider\s+provider=\{blockRoom\.provider\}\s+entityType="program_event"\s+entityId=\{eventId\}\s+blockRoomProtocol=\{blockRoom\.protocol\}\s*>/,
    );
    expect(source).toMatch(/<EditorRuntimeProvider[\s\S]*>\s*\{editor\}\s*<\/EditorRuntimeProvider>/);
    expect(source).toMatch(/const editor = \([\s\S]*<EntityTranslationsPanel/);
  });

  it('uses the selected locale room and keeps target structure locked', () => {
    expect(source).toContain('const localeSession = useLocaleDocumentSession({');
    expect(source).toContain('const { activeEditLocale, roomLocale } = localeSession;');
    expect(source).toContain('localeSession.hasRoomMutationAuthority({');
    expect(source).toContain('documentRevision: blockRoom.bootstrap?.documentRevision ?? null');
    expect(source).toContain('editable={canEditCurrentLocale}');
    expect(source).toContain('allowNeutralBlockEdits={activeEditLocale.isSourceLocale}');
    expect(source).toContain('allowStructuralEdits={activeEditLocale.isSourceLocale}');
    expect(source).toContain("{ type: 'program-event', id: eventId, locale: activeEditLocale.activeLocale }");
    expect(source).not.toContain('isConnected={canEditEvent ? blockRoom.isConnected : true}');
  });

  it('keeps locale-owned title editing separate from source-only Event mutations', () => {
    expect(source).toContain("const canEditEvent = allowedActions.includes('edit');");
    expect(source).toContain('const canEditNeutral = canEditCurrentLocale && activeEditLocale.isSourceLocale;');
    expect(source).toContain('const canEditTitle = canEditCurrentLocale && blockRoom.isSynced;');
    expect(source).toContain('if (!roomLocale || !canEditTitle)');
    expect(source).toContain('allowedActions: neutralAllowedActions');
    expect(source).toContain('canEdit={canEditNeutral}');
    expect(source).toContain('editable={canEditCurrentLocale}');
    expect(source).not.toContain('debouncedMetaUpdate({ slug: nextSlug })');
    expect(source).toContain("titlePlaceholder={tCommon('states.untitledEntity'");
  });
});
