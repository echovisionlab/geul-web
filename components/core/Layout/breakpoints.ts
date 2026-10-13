import { primitiveTokens } from '../design-tokens';
export type Breakpoint = keyof typeof primitiveTokens.breakpoints;
/** Below excludes the boundary; at-least owns it. CSS uses the generated projection. */
export function breakpointQuery(name: Breakpoint, range: 'below' | 'at-least' = 'below'): string {
  if (!Object.hasOwn(primitiveTokens.breakpoints, name) || !['below', 'at-least'].includes(range)) {
    throw new RangeError('Use a registered breakpoint and range');
  }
  return `(width ${range === 'below' ? '<' : '>='} ${primitiveTokens.breakpoints[name]})`;
}
