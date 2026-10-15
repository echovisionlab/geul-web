// @vitest-environment jsdom

import mermaid from 'mermaid';
import { describe, expect, it } from 'vitest';
import { semanticThemes } from '@/components/core/design-tokens';
import { getMermaidAppearance, getMermaidThemeVariables } from './mermaid-appearance';

describe('Mermaid theme engine integration', () => {
  it.each(['light', 'dark'] as const)('keeps %s token assignments after deriving the base theme', (theme) => {
    const variables = getMermaidThemeVariables(theme, getMermaidAppearance(theme));
    mermaid.initialize({ theme: 'base', themeVariables: variables, startOnLoad: false });
    const resolved = mermaid.mermaidAPI.getConfig().themeVariables as Record<string, unknown>;
    const colors = semanticThemes[theme];
    // The base theme normally darkens these category/branch colors and chooses
    // independent ER row, pie and Gantt colors; explicit overrides must survive.
    expect(resolved.cScale11).toBe(colors['surface-muted']);
    expect(resolved.git7).toBe(colors['chart-series-secondary']);
    expect(resolved.attributeBackgroundColorEven).toBe(colors['surface-muted']);
    expect(resolved.pie3).toBe(colors['surface-muted']);
    expect(resolved.todayLineColor).toBe(colors['status-danger']);
    expect(resolved.taskTextLightColor).toBe(colors['text-primary']);
    expect(resolved.xyChart).toMatchObject({ backgroundColor: colors.background });
  });
});
