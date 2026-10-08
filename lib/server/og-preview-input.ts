import { z } from 'zod';

const color = z.string().regex(/^#(?:[\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/i);
const dimension = z.number().finite().nonnegative();
const fontSize = z.number().finite().positive();
const fontWeight = z.number().int().min(100).max(900).multipleOf(100);
const logo = z.object({ width: dimension, height: dimension });
const siteTitle = z.object({ fontSize, fontWeight, color });
const homeConfig = z.object({ darkBackground: color, logo, siteTitle });
const contentConfig = z.object({
  darkBackground: color,
  title: z.object({
    maxLength: z.number().int().positive(),
    fontSizeThreshold: z.number().int().nonnegative(),
    fontSizeLarge: fontSize,
    fontSizeSmall: fontSize,
    fontWeight,
    color,
    lineHeight: z.number().finite().positive(),
    padding: z.object({ top: dimension, right: dimension, bottom: dimension, left: dimension }),
  }),
  logo: logo.extend({ position: z.object({ bottom: dimension, right: dimension }) }),
  siteTitle: siteTitle.extend({ opacity: z.number().min(0).max(1) }),
});

export const ogPreviewInput = z.discriminatedUnion('type', [
  z.object({ type: z.literal('home'), config: homeConfig.nullish() }),
  z.object({ type: z.literal('content'), title: z.string().min(1), config: contentConfig.nullish() }),
]);
