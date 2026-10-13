import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs';
import { TextInput } from '@/components/core/Input';
import { Disclosure } from '@/components/core/Disclosure';
import { LayoutStack } from '@/components/core/Layout';
import { Text } from '@/components/core/Typography';
import {
  authoredEditorPalettes,
  controlToneColors,
  derivedTokenRoles,
  invariantTokens,
  primitiveTokens,
  semanticThemes,
} from '@/components/core/design-tokens';
import { useColorScheme } from '@/lib/providers/DesignSystemProvider';
import { getThemeDefinition, getThemeTokens, themeDefinitions } from '@/lib/theme/themes';
import { CodeExample, DocSection, DocTable, FoundationDoc, SourceNote, StoryLink } from './FoundationDocs';
import classes from './FoundationDocs.module.css';

type TokenEntry = { name: string; source: string; value: string };
const kebab = (value: string) => value.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
function flattenTokens(value: object, prefix: string, source: string): TokenEntry[] {
  return Object.entries(value).flatMap(([name, entry]) => {
    const path = [prefix, kebab(name)].filter(Boolean).join('-');
    return typeof entry === 'object' && entry !== null
      ? flattenTokens(entry, path, `${source}.${name}`)
      : [{ name: path, source: `${source}.${name}`, value: String(entry) }];
  });
}
// Breakpoints are media-query inputs without CSS roles; Foundations / Responsive documents them.
const primitiveGroups = Object.entries(primitiveTokens)
  .filter(([name]) => name !== 'breakpoints')
  .map(([name, value]) => ({
    name,
    entries: flattenTokens(value, kebab(name), `primitiveTokens.${name}`),
  }));
function Swatch({ name, value }: { name?: string; value: string }) {
  if (!/^(#|rgb|transparent|linear-gradient)/.test(value)) {
    return null;
  }
  return <span className={classes.swatch} style={{ background: name ? `var(--geul-${name})` : value }} aria-hidden />;
}
function TokenReference() {
  const { themeId } = useColorScheme();
  const activeTheme = getThemeDefinition(themeId);
  const activeTokens = getThemeTokens(themeId);
  const [query, setQuery] = useState('');
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const matches = (name: string, ...values: string[]) =>
    [name, ...values].some((value) => value.toLowerCase().includes(query.trim().toLowerCase()));
  const valueLabel = 'Source value';
  const nameLabel = 'CSS role';
  return (
    <FoundationDoc
      title="Tokens"
      description="The complete production definitions, read directly from the token owner. Values are reference data; component use and accessibility are reviewed separately."
    >
      <DocSection title="Ownership and layers">
        <DocTable
          caption="Definition → projection → consumer"
          columns={['Layer', 'Purpose', 'Owner']}
          rows={[
            ['Primitive', 'Palette, spacing, typography and geometry materials.', 'primitiveTokens'],
            ['Semantic', 'Stable roles; light/dark resolve to different values.', 'semanticThemes'],
            ['Theme preset', 'A base theme plus typed overrides of existing semantic roles.', 'lib/theme/themes.ts'],
            ['Invariant', 'Media, paper and image roles with intentional theme independence.', 'invariantTokens'],
            ['Derived alias', 'Repeated relationships refer to their shared source role.', 'derivedTokenRoles'],
            [
              'Component',
              'Core owns state, sizing and permitted combinations; features consume its API.',
              'components/core/**',
            ],
          ]}
        />
        <SourceNote>
          components/core/design-tokens.ts → scripts/design-system/generate-tokens.mjs → lib/styles/design-tokens.css ·
          theme.ts
        </SourceNote>
        <Text size="sm">
          Generated CSS and this page are projections. Change the owning definition and verify its consumers. A copied
          value is not a new source.
        </Text>
      </DocSection>
      <DocSection title="Theme registry and customization">
        <DocTable
          caption="themeDefinitions"
          columns={['Theme', 'ID', 'Base', 'Overridden roles']}
          rows={themeDefinitions.map((definition) => [
            definition.label,
            definition.id,
            definition.base,
            Object.keys(definition.overrides).length,
          ])}
        />
        <Text size="sm">
          A custom preset reuses the same semantic roles and component state contracts. Its base supplies inherited
          values; typed overrides change selected roles. Geometry, density, typography and interaction targets keep
          their existing owners. The Ocean presets demonstrate customization with the shared palette.
        </Text>
        <CodeExample>{`getThemeDefinition('ocean-light'); // base + overrides\ngetThemeTokens('ocean-light');     // resolved semantic roles\nthemeVariables('ocean-light');    // CSS roles + invariants + document aliases`}</CodeExample>
        <Text size="sm">
          Add or revise a preset in lib/theme/themes.ts, regenerate its CSS projection, then review the same Core states
          and actual page fixtures. Check contrast, disabled and pending states, overlays, focus and authored document
          colors. A registered preset is a reviewable definition, not an accessibility approval.
        </Text>
        <SourceNote>
          lib/theme/themes.ts → theme.ts → scripts/design-system/generate-tokens.mjs → lib/styles/design-tokens.css ·
          DesignSystemProvider
        </SourceNote>
      </DocSection>
      <TextInput
        label="Find a token"
        description="Search role names or source values. Groups remain available below."
        value={query}
        onChange={(event) => setQuery(event.currentTarget.value)}
      />
      <DocSection title={`Semantic roles · active: ${activeTheme.label}`}>
        <Text size="sm">
          The swatch and active value follow the toolbar theme. Canonical Light/Dark values remain visible for
          comparison. Each active role identifies its override or inherited base. Shadows and non-color values are shown
          as text.
        </Text>
        <DocTable
          caption="semanticThemes + getThemeTokens(themeId)"
          columns={[nameLabel, 'Light base', 'Dark base', `${activeTheme.label} · active`, 'Origin']}
          rows={Object.entries(semanticThemes.light)
            .filter(([name, value]) =>
              matches(
                name,
                value,
                semanticThemes.dark[name as keyof typeof semanticThemes.dark],
                activeTokens[name as keyof typeof activeTokens],
              ),
            )
            .map(([name, light]) => [
              <>
                <Swatch name={name} value={activeTokens[name as keyof typeof activeTokens]} />
                <Text as="span" size="xs" font="mono" wrap="anywhere">
                  --geul-{name}
                </Text>
              </>,
              light,
              semanticThemes.dark[name as keyof typeof semanticThemes.dark],
              activeTokens[name as keyof typeof activeTokens],
              Object.hasOwn(activeTheme.overrides, name) ? 'Override' : `Inherited · ${activeTheme.base}`,
            ])}
        />
      </DocSection>
      <DocSection title="Primitive definitions">
        <Text size="sm">
          The full palette and every scale are available here. rem dimensions depend on the root font size; em
          breakpoint values are not device labels.
        </Text>
        <LayoutStack gap="xs">
          {primitiveGroups.map((group) => {
            const entries = group.entries.filter((entry) => matches(entry.name, entry.source, entry.value));
            if (entries.length === 0 && query) {
              return null;
            }
            return (
              <Disclosure
                key={group.name}
                label={`${group.name} · ${entries.length}`}
                opened={Boolean(query.trim()) || Boolean(openGroups[group.name])}
                onChange={(opened) => setOpenGroups((previous) => ({ ...previous, [group.name]: opened }))}
                contentIndent="none"
                headingLevel={3}
              >
                <DocTable
                  caption={`primitiveTokens.${group.name}`}
                  columns={['Source definition', nameLabel, valueLabel]}
                  rows={entries.map(({ name, source, value }) => [
                    <>
                      <Swatch name={group.name === 'colors' ? undefined : name} value={value} />
                      <Text as="span" font="mono" size="xs" wrap="anywhere">
                        {source}
                      </Text>
                    </>,
                    group.name === 'colors'
                      ? source === 'primitiveTokens.colors.brand'
                        ? '--geul-brand-default'
                        : '—'
                      : `--geul-${name}`,
                    value,
                  ])}
                />
              </Disclosure>
            );
          })}
        </LayoutStack>
      </DocSection>
      <DocSection title="Authored document compatibility roles">
        <Text size="sm">
          Durable document color names remain content data. Generated --editor-* aliases consume semantic document
          roles; palette materials do not all have a public CSS variable.
        </Text>
        <DocTable
          caption="authoredEditorPalettes"
          columns={['Compatibility name', 'Light', 'Dark']}
          rows={Object.entries(authoredEditorPalettes.light)
            .filter(([name, value]) =>
              matches(name, value, authoredEditorPalettes.dark[name as keyof typeof authoredEditorPalettes.dark]),
            )
            .map(([name, value]) => [
              `--editor-${name}`,
              value,
              authoredEditorPalettes.dark[name as keyof typeof authoredEditorPalettes.dark],
            ])}
        />
        <DocTable
          caption="controlToneColors"
          columns={['Control tone', 'Semantic source']}
          rows={Object.entries(controlToneColors).filter(([name, value]) => matches(name, value))}
        />
      </DocSection>
      <DocSection title="Theme-invariant roles">
        <DocTable
          caption="invariantTokens"
          columns={[nameLabel, valueLabel]}
          rows={Object.entries(invariantTokens)
            .filter(([name, value]) => matches(name, value))
            .map(([name, value]) => [
              <Text size="xs" font="mono" wrap="anywhere">
                --geul-{name}
              </Text>,
              value,
            ])}
        />
      </DocSection>
      <DocSection title="Derived aliases">
        <DocTable
          caption="derivedTokenRoles"
          columns={[nameLabel, 'Shared source']}
          rows={Object.entries(derivedTokenRoles)
            .filter(([name, value]) => matches(name, value))
            .map(([name, value]) => [`--geul-${name}`, `var(--geul-${value})`])}
        />
        <StoryLink id="foundations-spacing--relationships">Spacing relationships and owners</StoryLink>
      </DocSection>
    </FoundationDoc>
  );
}
const meta = {
  title: 'Foundations/Tokens',
  component: TokenReference,
  tags: ['autodocs'],
  parameters: {
    controls: { disable: true },
    docs: {
      description: {
        component:
          'Production token ownership, complete primitive scales, both semantic themes, invariant roles and derived aliases. Search resolves from the current source.',
      },
    },
  },
} satisfies Meta<typeof TokenReference>;
export default meta;
export const Reference: StoryObj<typeof meta> = {};
