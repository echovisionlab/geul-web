import type { primitiveTokens } from './design-tokens';

export type ControlTone = 'accent' | 'neutral' | 'positive' | 'warning' | 'danger';

/** Button tones; brand fills with the configured site color and is reserved for SaveButton. */
export type ButtonTone = ControlTone | 'brand';

export type ControlSize = Exclude<keyof typeof primitiveTokens.controlHeight, 'compact' | 'chrome'>;
export type ButtonSize = ControlSize | 'compact';

export type ControlEmphasis = 'strong' | 'medium' | 'low' | 'outline';
