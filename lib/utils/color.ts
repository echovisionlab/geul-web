/**
 * Parse opacity from a color string (hex, rgb, rgba, or 'transparent')
 * Returns 1 for opaque colors, 0 for transparent, or the alpha value for rgba
 */
export function parseColorOpacity(color: string): number {
  if (color === 'transparent') {
    return 0;
  }

  // Handle rgba() and rgb()
  const rgbaMatch = color.match(/rgba?\([\d.]+,\s*[\d.]+,\s*[\d.]+(?:,\s*([\d.]+))?\)/);
  if (rgbaMatch) {
    return rgbaMatch[1] ? parseFloat(rgbaMatch[1]) : 1;
  }

  // Handle 8-digit hex (#RRGGBBAA)
  if (color.startsWith('#') && color.length === 9) {
    const alpha = parseInt(color.slice(7, 9), 16) / 255;
    return alpha;
  }

  // Handle 4-digit hex (#RGBA)
  if (color.startsWith('#') && color.length === 5) {
    const alpha = parseInt(color[4] + color[4], 16) / 255;
    return alpha;
  }

  // Default: opaque (hex without alpha, named colors, etc.)
  return 1;
}
