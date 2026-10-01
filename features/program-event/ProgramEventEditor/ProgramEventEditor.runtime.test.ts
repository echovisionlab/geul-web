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
    expect(source).toContain('queueNeutralPatch({ slug: nextSlug });');
    expect(source).not.toContain('mutateEditableEvent');
    expect(source).toContain("titlePlaceholder={tCommon('states.untitledEntity'");
  });

  it('queues neutral and relation edits and flushes before direct transitions', () => {
    expect(source).toContain('observed: { artists: observed }');
    expect(source).toContain('observed: { labels: observed }');
    expect(source).toContain('observed: { clients: observed }');
    expect(source).toContain('merge: mergeMetadataPatches');
    expect(source).toContain('artists: values.map((id, sortOrder) => ({');
    expect(source).toContain('labels: values.map((id, sortOrder) => ({');
    expect(source).toContain('clients: values.map((id, sortOrder) => ({');
    expect(source).not.toContain('debouncedRelationsUpdate');
    expect(source).toContain('neutralConfiguration.beginWrite(data)');
    expect(source).toContain('data.observed?.[collection] ?? currentBaseline[collection]');
    expect(source).toContain('pendingAuxiliaryWritesRef.current.size > 0');
    expect(source).toMatch(/flushEditorSaves\(`program_event:\$\{eventId\}`\)/);
    expect(source).toContain('if (await flushPendingSaves()) {\n      router.back();');
    expect(source).toContain('if (await flushPendingSaves()) {\n        lifecycle.changeStatus(nextStatus);');
    expect(source).toContain('if (await flushPendingSaves()) {\n      lifecycle.deleteEvent.mutate();');
  });
});
