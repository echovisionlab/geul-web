import type { primitiveTokens } from './design-tokens';

export type ControlTone = 'accent' | 'neutral' | 'positive' | 'warning' | 'danger';

export type ControlSize = Exclude<keyof typeof primitiveTokens.controlHeight, 'compact' | 'chrome'>;
export type ButtonSize = ControlSize | 'compact';

export type ControlEmphasis = 'strong' | 'medium' | 'low' | 'outline';
