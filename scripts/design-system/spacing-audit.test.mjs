import assert from 'node:assert/strict';
import { test } from 'node:test';
import { classifyRelationship, normalizeTag, scanCssSpacing, scanTsxSpacing } from './spacing-audit.mjs';

test('spacing audit normalizes local Core aliases and classifies relationships from children', () => {
  assert.equal(normalizeTag('DsLayoutStack'), 'LayoutStack');
  assert.equal(normalizeTag('EditorDsSectionCard'), 'SectionCard');
  assert.equal(normalizeTag('AppLayoutInset'), 'LayoutInset');
  const { uses, inlineStyles } = scanTsxSpacing(
    'features/example.tsx',
    `export const A = () => (
      <DsLayoutStack gap="sm">
        <SectionHeader title="t" />
        <TextInput label="a" />
        <DsLayoutInline gap="action-group"><Button /><Button /></DsLayoutInline>
        <div style={{ marginTop: 24 }} />
      </DsLayoutStack>
    );`,
  );
  assert.deepEqual(
    uses.map(({ tag, props, relationship }) => [tag, props.gap, relationship]),
    [
      ['LayoutStack', 'sm', 'heading→content'],
      ['LayoutInline', 'action-group', 'action-group'],
    ],
  );
  assert.deepEqual(
    inlineStyles.map(({ key, value }) => [key, value]),
    [['marginTop', '24']],
  );
  assert.equal(classifyRelationship('LayoutStack', ['TextInput', 'Select'], false), 'field→field');
  assert.equal(classifyRelationship('LayoutStack', ['SectionCard', 'SectionCard'], false), 'section→section');
});

test('spacing audit reports literal and calc bypasses outside print rules', () => {
  const declarations = scanCssSpacing(
    'features/example.css',
    `.a { gap: var(--geul-spacing-xs); padding: 0px 12px; margin: calc(var(--geul-spacing-xxs) / 2); }
     @media print { .a { margin: 8mm; } }`,
  );
  assert.deepEqual(
    declarations.map(({ property, bypass }) => [property, bypass]),
    [
      ['gap', undefined],
      ['padding', 'literal'],
      ['margin', 'calc'],
    ],
  );
});
