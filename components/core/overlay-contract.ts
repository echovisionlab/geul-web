import type { ClosedVisualProps } from './visual-contract';
/** Typed spreads cannot smuggle Feature presentation into a Core overlay. */
export type OverlayPresentationProps = ClosedVisualProps;

/** Only inert consumer data markers may cross a closed overlay presentation boundary. */
export function overlayDataAttributes(
  props: Record<string, unknown>,
): Record<string, string | number | boolean | undefined> {
  const result: Record<string, string | number | boolean | undefined> = {};
  for (const [key, value] of Object.entries(props)) {
    if (
      !key.startsWith('data-') ||
      /^data-(?:geul-|core-|selected$|tone$|disabled$|focused$|size$|position$|placement$|padding$|shape$|emphasis$|hovered$|pressed$|focus-visible$|entering$|exiting$|expanded$|loading$|close-policy$|level$|multiline$)/.test(
        key,
      )
    ) {
      continue;
    }
    if (value === undefined || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      result[key] = value;
    }
  }
  return result;
}
