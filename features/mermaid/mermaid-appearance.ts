import { primitiveTokens, semanticThemes } from '@/components/core/design-tokens';
import type { MermaidAppearance, MermaidTheme } from './mermaid-renderer';

const colorRoles = {
  background: 'background',
  foreground: 'text-primary',
  secondaryText: 'text-secondary',
  surface: 'surface',
  mutedSurface: 'surface-muted',
  border: 'border-default',
  strongBorder: 'border-strong',
  line: 'text-muted',
  accent: 'status-accent',
  positive: 'status-positive',
  warning: 'status-warning',
  danger: 'status-danger',
  onAction: 'text-on-action',
  seriesPrimary: 'chart-series-primary',
  seriesSecondary: 'chart-series-secondary',
  seriesTertiary: 'chart-series-tertiary',
} as const;
type ColorRole = (typeof colorRoles)[keyof typeof colorRoles];
const roleProperties: Record<ColorRole, string> = {
  background: 'var(--geul-background)',
  'text-primary': 'var(--geul-text-primary)',
  'text-secondary': 'var(--geul-text-secondary)',
  surface: 'var(--geul-surface)',
  'surface-muted': 'var(--geul-surface-muted)',
  'border-default': 'var(--geul-border-default)',
  'border-strong': 'var(--geul-border-strong)',
  'text-muted': 'var(--geul-text-muted)',
  'status-accent': 'var(--geul-status-accent)',
  'status-positive': 'var(--geul-status-positive)',
  'status-warning': 'var(--geul-status-warning)',
  'status-danger': 'var(--geul-status-danger)',
  'text-on-action': 'var(--geul-text-on-action)',
  'chart-series-primary': 'var(--geul-chart-series-primary)',
  'chart-series-secondary': 'var(--geul-chart-series-secondary)',
  'chart-series-tertiary': 'var(--geul-chart-series-tertiary)',
};

function createAppearance(read: (role: ColorRole) => string, fontFamily: string, fontSize: string): MermaidAppearance {
  const colors = Object.fromEntries(Object.entries(colorRoles).map(([key, role]) => [key, read(role)])) as Record<
    keyof typeof colorRoles,
    string
  >;
  return { fontFamily, fontSize, ...colors };
}

/** Every rendering entry point uses the site palette, including non-DOM callers. */
export function getMermaidAppearance(theme: MermaidTheme): MermaidAppearance {
  return createAppearance((role) => semanticThemes[theme][role], 'sans-serif', primitiveTokens.fontSize.sm);
}

/** Mermaid parses concrete CSS colors, not custom properties, light-dark() or color-mix(). */
export function readMermaidAppearance(element: HTMLElement, theme: MermaidTheme): MermaidAppearance {
  const styles = getComputedStyle(element);
  const probe = document.createElement('span');
  probe.hidden = true;
  element.appendChild(probe);
  const read = (role: ColorRole) => {
    probe.style.color = roleProperties[role];
    const color = getComputedStyle(probe).color.trim();
    return /^(?:#[\da-f]{3,8}|rgba?\([^)]*\)|hsla?\([^)]*\))$/iu.test(color) ? color : semanticThemes[theme][role];
  };
  try {
    return createAppearance(read, styles.fontFamily || 'sans-serif', styles.fontSize || primitiveTokens.fontSize.sm);
  } finally {
    probe.remove();
  }
}

/** Explicit assignments prevent Mermaid's base theme from inventing unrelated hues.
 * Category palettes stay neutral; authored classDef/style directives still belong to the document. */
export function getMermaidThemeVariables(theme: MermaidTheme, appearance: MermaidAppearance) {
  const a = appearance;
  const series = [a.seriesPrimary, a.seriesSecondary, a.seriesTertiary];
  const surfaces = [a.surface, a.background, a.mutedSurface];
  // The tertiary chart ink is suitable for lines, but cannot carry small inverse
  // labels in light mode. Pie uses neutral surfaces; filled Git labels use the
  // two chart inks that support the shared inverse text role.
  const branchSeries = [a.seriesPrimary, a.seriesSecondary];
  const categoryVariables = Object.fromEntries(
    Array.from({ length: 12 }, (_, index) => [
      [`cScale${index}`, surfaces[index % surfaces.length]],
      [`cScaleInv${index}`, a.line],
      [`cScalePeer${index}`, a.mutedSurface],
      [`cScaleLabel${index}`, a.foreground],
      [`pie${index + 1}`, surfaces[index % surfaces.length]],
      [`venn${index + 1}`, series[index % series.length]],
    ]).flat(),
  );
  const branchVariables = Object.fromEntries(
    Array.from({ length: 8 }, (_, index) => [
      [`git${index}`, branchSeries[index % branchSeries.length]],
      [`gitInv${index}`, a.surface],
      [`gitBranchLabel${index}`, a.onAction],
      [`fillType${index}`, surfaces[index % surfaces.length]],
    ]).flat(),
  );
  const surfaceVariables = Object.fromEntries(
    Array.from({ length: 5 }, (_, index) => [
      [`surface${index}`, surfaces[index % surfaces.length]],
      [`surfacePeer${index}`, a.mutedSurface],
    ]).flat(),
  );
  return {
    ...categoryVariables,
    ...branchVariables,
    ...surfaceVariables,
    darkMode: theme === 'dark',
    fontFamily: a.fontFamily,
    fontSize: a.fontSize,
    radius: Number(primitiveTokens.radius.square),
    useGradient: false,
    background: a.background,
    mainBkg: a.surface,
    nodeBkg: a.surface,
    primaryColor: a.surface,
    primaryTextColor: a.foreground,
    primaryBorderColor: a.border,
    secondaryColor: a.background,
    secondaryTextColor: a.foreground,
    secondaryBorderColor: a.border,
    tertiaryColor: a.mutedSurface,
    tertiaryTextColor: a.foreground,
    tertiaryBorderColor: a.border,
    textColor: a.foreground,
    titleColor: a.foreground,
    lineColor: a.line,
    arrowheadColor: a.line,
    nodeTextColor: a.foreground,
    nodeBorder: a.border,
    clusterBkg: a.background,
    clusterBorder: a.border,
    defaultLinkColor: a.line,
    edgeLabelBackground: a.background,
    actorBkg: a.surface,
    actorBorder: a.border,
    actorTextColor: a.foreground,
    actorLineColor: a.line,
    signalColor: a.line,
    signalTextColor: a.foreground,
    labelBoxBkgColor: a.surface,
    labelBoxBorderColor: a.border,
    labelTextColor: a.foreground,
    loopTextColor: a.foreground,
    noteBkgColor: a.mutedSurface,
    noteBorderColor: a.border,
    noteTextColor: a.foreground,
    activationBkgColor: a.mutedSurface,
    activationBorderColor: a.border,
    sequenceNumberColor: a.background,
    rectBkgColor: a.mutedSurface,
    classText: a.foreground,
    personBkg: a.surface,
    personBorder: a.border,
    rowOdd: a.surface,
    rowEven: a.mutedSurface,
    attributeBackgroundColorOdd: a.surface,
    attributeBackgroundColorEven: a.mutedSurface,
    transitionColor: a.line,
    transitionLabelColor: a.foreground,
    stateLabelColor: a.foreground,
    stateBkg: a.surface,
    labelBackgroundColor: a.background,
    compositeBackground: a.background,
    altBackground: a.mutedSurface,
    compositeTitleBackground: a.surface,
    compositeBorder: a.border,
    errorBkgColor: a.surface,
    errorTextColor: a.danger,
    sectionBkgColor: a.mutedSurface,
    sectionBkgColor2: a.surface,
    altSectionBkgColor: a.background,
    excludeBkgColor: a.mutedSurface,
    taskBkgColor: a.surface,
    taskBorderColor: a.strongBorder,
    activeTaskBkgColor: a.surface,
    activeTaskBorderColor: a.accent,
    doneTaskBkgColor: a.mutedSurface,
    doneTaskBorderColor: a.positive,
    critBkgColor: a.surface,
    critBorderColor: a.danger,
    todayLineColor: a.danger,
    vertLineColor: a.line,
    gridColor: a.border,
    taskTextColor: a.foreground,
    taskTextOutsideColor: a.foreground,
    taskTextLightColor: a.foreground,
    taskTextDarkColor: a.foreground,
    taskTextClickableColor: a.accent,
    scaleLabelColor: a.foreground,
    pieTitleTextColor: a.foreground,
    pieSectionTextColor: a.foreground,
    pieLegendTextColor: a.foreground,
    pieTitleTextSize: a.fontSize,
    pieSectionTextSize: a.fontSize,
    pieLegendTextSize: a.fontSize,
    pieStrokeColor: a.background,
    pieOuterStrokeColor: a.border,
    pieOpacity: '1',
    vennTitleTextColor: a.foreground,
    vennSetTextColor: a.foreground,
    quadrant1Fill: a.surface,
    quadrant2Fill: a.background,
    quadrant3Fill: a.mutedSurface,
    quadrant4Fill: a.surface,
    quadrant1TextFill: a.foreground,
    quadrant2TextFill: a.foreground,
    quadrant3TextFill: a.foreground,
    quadrant4TextFill: a.foreground,
    quadrantPointFill: a.accent,
    quadrantPointTextFill: a.foreground,
    quadrantXAxisTextFill: a.foreground,
    quadrantYAxisTextFill: a.foreground,
    quadrantInternalBorderStrokeFill: a.border,
    quadrantExternalBorderStrokeFill: a.border,
    quadrantTitleFill: a.foreground,
    requirementBackground: a.surface,
    requirementBorderColor: a.border,
    requirementTextColor: a.foreground,
    relationColor: a.line,
    relationLabelBackground: a.background,
    relationLabelColor: a.foreground,
    tagLabelColor: a.foreground,
    tagLabelBackground: a.surface,
    tagLabelBorder: a.border,
    commitLabelColor: a.foreground,
    commitLabelBackground: a.background,
    archEdgeColor: a.line,
    archEdgeArrowColor: a.line,
    archGroupBorderColor: a.border,
    xyChart: {
      backgroundColor: a.background,
      titleColor: a.foreground,
      dataLabelColor: a.foreground,
      legendTextColor: a.foreground,
      xAxisTitleColor: a.foreground,
      xAxisLabelColor: a.secondaryText,
      xAxisTickColor: a.line,
      xAxisLineColor: a.line,
      yAxisTitleColor: a.foreground,
      yAxisLabelColor: a.secondaryText,
      yAxisTickColor: a.line,
      yAxisLineColor: a.line,
      plotColorPalette: series.join(','),
    },
    radar: { axisColor: a.line, graticuleColor: a.border },
    cynefin: {
      boundaryColor: a.border,
      cliffColor: a.danger,
      arrowColor: a.line,
      complexBg: a.surface,
      complicatedBg: a.surface,
      chaoticBg: a.surface,
      clearBg: a.surface,
      confusionBg: a.mutedSurface,
      textColor: a.foreground,
      labelColor: a.foreground,
    },
    wardleyEvolutionColor: a.accent,
    wardley: {
      backgroundColor: a.background,
      axisColor: a.line,
      axisTextColor: a.foreground,
      gridColor: a.border,
      componentFill: a.surface,
      componentStroke: a.border,
      componentLabelColor: a.foreground,
      linkStroke: a.line,
      evolutionStroke: a.accent,
      annotationStroke: a.border,
      annotationTextColor: a.foreground,
      annotationFill: a.surface,
    },
    emUiFill: a.surface,
    emUiStroke: a.border,
    emProcessorFill: a.surface,
    emProcessorStroke: a.border,
    emReadModelFill: a.surface,
    emReadModelStroke: a.positive,
    emCommandFill: a.surface,
    emCommandStroke: a.accent,
    emEventFill: a.surface,
    emEventStroke: a.warning,
    emSwimlaneBackgroundOdd: a.background,
    emSwimlaneBackgroundStroke: a.border,
    emArrowhead: a.line,
    emRelationStroke: a.line,
  };
}
