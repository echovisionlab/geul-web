import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('./CampaignEditPage.tsx', import.meta.url), 'utf8');

function expectSourceOrder(value: string, first: string, second: string) {
  const firstIndex = value.indexOf(first);
  const secondIndex = value.indexOf(second);
  expect(firstIndex).toBeGreaterThanOrEqual(0);
  expect(secondIndex).toBeGreaterThan(firstIndex);
}

describe('Campaign locale subject wiring', () => {
  it('preserves explicit target empty values and waits for exact room sync before enabling subject input', () => {
    expect(source).toContain('resolveResidentLocaleField({');
    expect(source).toContain('localizedValue: activeEditLocale.displayTitle');
    expect(source).toContain('canEditLocaleDocumentField({');
    expect(source).toContain('isLocaleDocumentSynced: isSynced');
    expect(source).toContain('disabled={!canEditLocalizedSubject}');
    expect(source).not.toContain('activeEditLocale.displayTitle ||');
  });

  it('registers debounced subject metadata and flushes it before Back and delivery persistence', () => {
    expect(source).toContain('useDebouncedRoomMetadata({');
    expect(source).toContain('document: `campaign:');
    expect(source).toContain('useBlockRoomMetadataUpdates(blockRoom, `campaign:');
    expect(source).toContain('setResidentSubject(values.subject)');
    expect(source).toMatch(/useEditorEntityChanges\(\s*`campaign:\$\{campaignId\}`[\s\S]*?currentProvider,/);
    expect(source).toContain('publishEditorEntityChange(`campaign:');
    expect(source).toContain("pending.has('recipientScope') ? current.recipientScope : source.recipientScope");

    const peerSubjectHandler = source.slice(
      source.indexOf('useBlockRoomMetadataUpdates'),
      source.indexOf('const currentSubject'),
    );
    expect(peerSubjectHandler).not.toContain('debouncedSubjectUpdate');
    expect(source).toContain('if (result.data) {\n      adoptCampaignFields(result.data);');

    const deliveryPreflight = source.slice(
      source.indexOf('const persistEditableCampaignBeforeDelivery'),
      source.indexOf('const handleBack'),
    );
    expectSourceOrder(deliveryPreflight, 'await flushEditorSaves(', 'await persistCollaborativeDocumentNow(');

    const backHandler = source.slice(source.indexOf('const handleBack'), source.indexOf('const handleTargetChange'));
    expectSourceOrder(backHandler, 'await flushEditorSaves(', 'router.push(');

    for (const [start, end, action] of [
      ['const handleSendTest', 'const handleSendAll', 'sendTest.mutate('],
      ['const handleSendAll', 'const handleSchedule', 'sendCampaign.mutate('],
      ['const handleSchedule', 'const handleCancelSchedule', 'scheduleCampaign.mutate('],
    ]) {
      const handler = source.slice(source.indexOf(start), source.indexOf(end));
      expectSourceOrder(handler, 'if (!(await persistEditableCampaignBeforeDelivery()))', action);
    }
  });

  it('submits campaign configuration as target pair or a single independent field', () => {
    const targetHandler = source.slice(
      source.indexOf('const handleTargetChange'),
      source.indexOf('const handleLayoutChange'),
    );
    const layoutHandler = source.slice(
      source.indexOf('const handleLayoutChange'),
      source.indexOf('const handleRecipientScopeChange'),
    );
    const recipientHandler = source.slice(
      source.indexOf('const handleRecipientScopeChange'),
      source.indexOf('const handleActiveLocaleChange'),
    );

    expect(targetHandler).toContain('targetMode: selection.targetMode');
    expect(targetHandler).toContain('segmentId: selection.segmentId');
    expect(targetHandler).not.toContain('layoutId:');
    expect(targetHandler).not.toContain('recipientScope:');
    expect(layoutHandler).toContain('layoutId: value');
    expect(layoutHandler).not.toContain('targetMode:');
    expect(layoutHandler).not.toContain('recipientScope:');
    expect(recipientHandler).toContain('updateCampaignConfigurationAction(campaignId, { recipientScope })');
    expect(recipientHandler).not.toContain('targetMode:');
    expect(recipientHandler).not.toContain('layoutId:');
  });
});
