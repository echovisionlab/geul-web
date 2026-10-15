import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { EDITOR_COLOR_VALUES } from './toolbars/EditorColorStyleButton';
import { authoredEditorPalettes, primitiveTokens, semanticThemes } from '@/components/core/design-tokens';
import { theme, themeVariables } from '@/theme';

const read = (relativePath: string) => readFileSync(new URL(relativePath, import.meta.url), 'utf8');

function relativeLuminance(hex: string): number {
  const channel = (offset: number) => {
    const value = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  const red = channel(1);
  const green = channel(3);
  const blue = channel(5);
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrastRatio(first: string, second: string): number {
  const firstLuminance = relativeLuminance(first);
  const secondLuminance = relativeLuminance(second);
  return (Math.max(firstLuminance, secondLuminance) + 0.05) / (Math.min(firstLuminance, secondLuminance) + 0.05);
}

describe('editor semantic color theme', () => {
  it('defines every durable text and background value for light and dark themes', () => {
    const variables = read('../../lib/styles/design-tokens.css');

    EDITOR_COLOR_VALUES.forEach((color) => {
      ['text', 'background'].forEach((kind) => {
        const declaration = `--editor-${kind}-color-${color}:`;
        // root, system-dark, explicit-light, explicit-dark and print (light on paper) share one generated authority.
        expect(variables.split(declaration)).toHaveLength(6);
      });
    });
    expect(variables).toContain("[data-geul-theme='dark'] {");
    expect(variables).toContain('@media print');
    expect(variables).toContain('--editor-background-color-default: var(--geul-document-background-default);');
    expect(read('../../lib/styles/variables.css')).not.toContain('--editor-');
  });

  it('routes generated document DOM and table cells through the same semantic tokens', () => {
    const renderers = [read('../../lib/styles/document-content.css'), read('./tiptap/table/TiptapTable.module.css')];

    EDITOR_COLOR_VALUES.filter((color) => color !== 'default').forEach((color) => {
      renderers.forEach((css) => {
        expect(css).toContain(`var(--editor-text-color-${color})`);
        expect(css).toContain(`var(--editor-background-color-${color})`);
      });
    });

    const blockContainer = read('./tiptap/TiptapBlockContainerNodeView.module.css');
    expect(blockContainer).not.toContain('--editor-text-color-');
    expect(blockContainer).not.toContain('--editor-background-color-');
  });

  it('pins quote line boxes so emoji fallback metrics cannot stretch the block', () => {
    const documentContent = read('../../lib/styles/document-content.css');
    const quoteRule = documentContent.match(
      /:is\(\.prose blockquote, \.tiptap-editor \[data-content-type='quote'\]\) \{([^}]+)\}/u,
    )?.[1];

    expect(quoteRule).toBeDefined();
    expect(quoteRule).toContain('min-height: 1lh;');
    expect(quoteRule).toContain('font-size: var(--geul-font-size-md);');
    expect(quoteRule).toContain('line-height: var(--geul-line-height-document);');
  });

  it('keeps both themes readable on document surfaces, highlights and matching backgrounds', () => {
    for (const [mode, roles] of Object.entries(semanticThemes)) {
      EDITOR_COLOR_VALUES.filter((color) => color !== 'default').forEach((color) => {
        const text = roles[`document-text-${color}`];
        const background = roles[`document-background-${color}`];
        expect(contrastRatio(text, roles.surface), `${mode}: ${color} on surface`).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(text, roles.background), `${mode}: ${color} on document`).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(text, background), `${mode}: ${color} on ${color}`).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(roles['text-primary'], background), `${mode}: default on ${color}`).toBeGreaterThanOrEqual(
          4.5,
        );
      });
      for (const textColor of EDITOR_COLOR_VALUES) {
        for (const backgroundColor of EDITOR_COLOR_VALUES) {
          const text = roles[`document-text-${textColor}`];
          const background =
            backgroundColor === 'default' ? roles.surface : roles[`document-background-${backgroundColor}`];
          expect(contrastRatio(text, background), `${mode}: ${textColor} on ${backgroundColor}`).toBeGreaterThanOrEqual(
            4.5,
          );
        }
      }
    }
  });

  it('projects all durable names through the default theme and its runtime variable adapter', () => {
    for (const mode of ['light', 'dark'] as const) {
      for (const kind of ['text', 'background'] as const) {
        for (const name of EDITOR_COLOR_VALUES) {
          const role = `document-${kind}-${name}` as const;
          const alias = `var(--geul-${role})`;
          expect(authoredEditorPalettes[mode][`${kind}-color-${name}`]).toBe(alias);
          expect(theme[mode][role]).toBe(semanticThemes[mode][role]);
          expect(themeVariables(mode)[`--geul-${role}`]).toBe(semanticThemes[mode][role]);
          expect(themeVariables(mode)[`--editor-${kind}-color-${name}`]).toBe(alias);
          expect(typeof semanticThemes[mode][role]).toBe('string');
        }
      }
    }
  });

  it('reuses the default color families and supplies the missing brown, purple and pink grades', () => {
    const names = ['brown', 'red', 'orange', 'green', 'blue', 'purple', 'pink'] as const;
    for (const name of names) {
      expect(semanticThemes.light[`document-text-${name}`]).toBe(primitiveTokens.colors[name][700]);
      expect(semanticThemes.dark[`document-text-${name}`]).toBe(primitiveTokens.colors[name][300]);
      expect(semanticThemes.light[`document-background-${name}`]).toBe(primitiveTokens.colors[name][50]);
      expect(semanticThemes.dark[`document-background-${name}`]).toBe(primitiveTokens.colors[name][900]);
    }
    for (const name of ['brown', 'purple', 'pink'] as const) {
      const family = primitiveTokens.colors[name];
      expect(Object.keys(family)).toEqual(['50', '100', '200', '300', '400', '500', '600', '700', '800', '900']);
      const luminances = Object.values(family).map(relativeLuminance);
      for (let index = 1; index < luminances.length; index += 1) {
        expect(luminances[index], `${name} grades increase in darkness`).toBeLessThan(luminances[index - 1]);
      }
    }
    expect(semanticThemes.light['document-text-default']).toBe(semanticThemes.light['text-primary']);
    expect(semanticThemes.dark['document-text-default']).toBe(semanticThemes.dark['text-primary']);
    expect(semanticThemes.light['document-background-default']).toBe('transparent');
    expect(semanticThemes.dark['document-background-default']).toBe('transparent');
  });

  it('maps actual inline mark attributes and accepts all ten table colors', () => {
    const documentContent = read('../../lib/styles/document-content.css');
    // Table presentation (shared by the live editor and the SSR snapshot) owns the cell colour set.
    const tableExtensions = read('./tiptap/table/table-presentation.ts');

    EDITOR_COLOR_VALUES.filter((color) => color !== 'default').forEach((color) => {
      expect(documentContent).toContain(
        `[data-style-type='textColor']:is([stringvalue='${color}'], [data-style-value='${color}'])`,
      );
      expect(documentContent).toContain(
        `[data-style-type='backgroundColor']:is([stringvalue='${color}'], [data-style-value='${color}'])`,
      );
    });
    const tableColorSet = tableExtensions.match(/const tableColors = new Set\(\[([^\]]+)\]\);/)?.[1];
    expect(tableColorSet).toBeDefined();
    EDITOR_COLOR_VALUES.forEach((color) => expect(tableColorSet).toContain(`'${color}'`));
  });

  it('shows transparent default backgrounds as transparency in swatches', () => {
    const swatches = read('../../components/core/DocumentColorPreview/DocumentColorPreview.module.css');
    const preview = read('../../components/core/DocumentColorPreview/DocumentColorPreview.tsx');
    const blockMenu = read('./tiptap/TiptapBlockMenu.tsx');

    expect(swatches).toContain('[data-transparent]');
    expect(preview).toContain("kind !== 'text' && background === 'default'");
    expect(blockMenu).toContain('colorPreview={{ kind, color }}');
  });

  it('loads the document bridge globally and KaTeX styles with math renderers', () => {
    const appLayout = read('../../app/layout.tsx');
    const storybookPreview = read('../../.storybook/preview.tsx');

    expect(appLayout).toContain("import '@/lib/styles/document-content.css';");
    expect(storybookPreview).toContain("import '../lib/styles/document-content.css';");
    expect(appLayout).not.toContain("import 'katex/dist/katex.min.css';");
    expect(read('./tiptap/math/math-render.ts')).toContain("import 'katex/dist/katex.min.css';");
    expect(read('../page/PageView/blocks/GeneratedMathBlockView.tsx')).toContain("import 'katex/dist/katex.min.css';");
    expect(storybookPreview).toContain("import 'katex/dist/katex.min.css';");
    expect(appLayout).not.toContain("import '@/lib/styles/prose.css';");
  });
});
