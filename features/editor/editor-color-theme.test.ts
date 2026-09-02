import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { EDITOR_COLOR_VALUES } from './toolbars/EditorColorStyleButton';

const read = (relativePath: string) => readFileSync(new URL(relativePath, import.meta.url), 'utf8');

function hexVariable(css: string, name: string): string {
  const value = css.match(new RegExp(`--${name}: (#[0-9a-f]{6});`, 'i'))?.[1];
  if (!value) {
    throw new Error(`Missing hex color variable: ${name}`);
  }
  return value;
}

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
    const variables = read('../../lib/styles/variables.css');

    EDITOR_COLOR_VALUES.forEach((color) => {
      ['text', 'background'].forEach((kind) => {
        const declaration = `--editor-${kind}-color-${color}:`;
        expect(variables.split(declaration)).toHaveLength(3);
      });
    });
    expect(variables).toContain("[data-mantine-color-scheme='dark'] {");
    expect(variables).toContain('--editor-background-color-default: transparent;');
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
    expect(quoteRule).toContain('font-size: var(--mantine-font-size-md);');
    expect(quoteRule).toContain('line-height: var(--mantine-line-height-md);');
  });

  it('keeps light-theme text readable on white and on its same-name background', () => {
    const allVariables = read('../../lib/styles/variables.css');
    const paletteStart = allVariables.indexOf('/* Durable editor color names');
    const darkPaletteStart = allVariables.indexOf("[data-mantine-color-scheme='dark'] {", paletteStart);
    const variables = allVariables.slice(paletteStart, darkPaletteStart);

    EDITOR_COLOR_VALUES.filter((color) => color !== 'default').forEach((color) => {
      const text = hexVariable(variables, `editor-text-color-${color}`);
      const background = hexVariable(variables, `editor-background-color-${color}`);
      expect(contrastRatio(text, '#ffffff'), `${color} on white`).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(text, background), `${color} on ${color}`).toBeGreaterThanOrEqual(4.5);
    });
  });

  it('maps actual inline mark attributes and accepts all ten table colors', () => {
    const documentContent = read('../../lib/styles/document-content.css');
    const tableExtensions = read('./tiptap/table/table-extensions.tsx');

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
    const swatches = read('./toolbars/EditorColorStyleButton.module.css');
    const blockMenu = read('./tiptap/TiptapBlockMenu.tsx');

    expect(swatches).toContain("[data-color-kind='background'][data-color='default']");
    expect(swatches).toContain("[data-editor-color-swatch='pair'][data-background-color='default']");
    expect(blockMenu).toContain('<EditorColorSwatch kind={kind} color={color} />');
  });

  it('loads the Mantine document bridge and KaTeX vendor styles at both global entrypoints', () => {
    const appLayout = read('../../app/layout.tsx');
    const storybookPreview = read('../../.storybook/preview.tsx');

    expect(appLayout).toContain("import '@/lib/styles/document-content.css';");
    expect(storybookPreview).toContain("import '../lib/styles/document-content.css';");
    expect(appLayout).toContain("import 'katex/dist/katex.min.css';");
    expect(storybookPreview).toContain("import 'katex/dist/katex.min.css';");
    expect(appLayout).not.toContain("import '@/lib/styles/prose.css';");
  });
});
