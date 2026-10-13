import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { Meta, StoryObj } from '@storybook/nextjs';
import { expect } from 'storybook/test';
import { LayoutInline, LayoutStack } from '@/components/core/Layout';
import { Text } from '@/components/core/Typography';
import { getThemeTokens } from '@/lib/theme/themes';
import {
  EDITOR_COLOR_VALUES,
  EditorColorStyleButton,
  EditorColorSwatch,
  type EditorColor,
} from './EditorColorStyleButton';

function AuthoredPalettePreview() {
  const t = useTranslations('editorCommon.editor');
  const [textColor, setTextColor] = useState<EditorColor>('blue');
  const [backgroundColor, setBackgroundColor] = useState<EditorColor>('yellow');
  const labels = {
    button: t('drag.colors'),
    text: t('colors.text'),
    background: t('colors.background'),
    colors: Object.fromEntries(EDITOR_COLOR_VALUES.map((color) => [color, t(`colors.names.${color}`)])) as Record<
      EditorColor,
      string
    >,
  };
  return (
    <LayoutStack gap="md">
      <EditorColorStyleButton
        labels={labels}
        textColor={textColor}
        backgroundColor={backgroundColor}
        onTextColorChange={setTextColor}
        onBackgroundColorChange={setBackgroundColor}
      />
      <div className="prose document-content" data-editor-color-selected-preview>
        <span data-style-type="backgroundColor" data-style-value={backgroundColor}>
          <span data-style-type="textColor" data-style-value={textColor}>
            {labels.text}
          </span>
        </span>
      </div>
      {EDITOR_COLOR_VALUES.map((color) => (
        <LayoutInline key={color} gap="sm">
          <EditorColorSwatch kind="text" color={color} />
          <EditorColorSwatch kind="background" color={color} />
          <Text>{labels.colors[color]}</Text>
          <div className="prose document-content">
            <span data-style-type="backgroundColor" data-style-value={color}>
              <span data-style-type="textColor" data-style-value={color}>
                {labels.colors[color]}
              </span>
            </span>
          </div>
        </LayoutInline>
      ))}
    </LayoutStack>
  );
}

const meta = {
  title: 'Feature/Editor/Color Palette',
  component: AuthoredPalettePreview,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof AuthoredPalettePreview>;
export default meta;

export const DurableColors: StoryObj<typeof meta> = {
  play: async ({ canvasElement, globals }) => {
    const palette = getThemeTokens(globals.theme);
    const rgb = (hex: string) =>
      `rgb(${[1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16)).join(', ')})`;
    for (const color of EDITOR_COLOR_VALUES.filter((value) => value !== 'default')) {
      const text = canvasElement.querySelector(`[data-color-kind='text'][data-color='${color}']`)!;
      const background = canvasElement.querySelector(`[data-color-kind='background'][data-color='${color}']`)!;
      expect(getComputedStyle(text).color).toBe(rgb(palette[`document-text-${color}`]));
      expect(getComputedStyle(background).backgroundColor).toBe(rgb(palette[`document-background-${color}`]));
      const documentText = canvasElement.querySelector(`[data-style-type='textColor'][data-style-value='${color}']`)!;
      const documentBackground = canvasElement.querySelector(
        `[data-style-type='backgroundColor'][data-style-value='${color}']`,
      )!;
      expect(getComputedStyle(documentText).color).toBe(rgb(palette[`document-text-${color}`]));
      expect(getComputedStyle(documentBackground).backgroundColor).toBe(rgb(palette[`document-background-${color}`]));
    }
  },
};
