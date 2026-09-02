/**
 * SVG to PNG conversion utility for editor uploads.
 *
 * Converts SVG files to PNG using the Canvas API before upload,
 * since the editor's editorImage upload type does not accept SVG.
 */

const DEFAULT_SIZE = 1024;

/**
 * Convert an SVG file to PNG using the Canvas API.
 *
 * Resolution is determined by the SVG's intrinsic dimensions:
 * - Uses width/height attributes if present
 * - Falls back to viewBox dimensions
 * - Defaults to 1024x1024 if neither is specified
 */
async function convertSvgToPng(file: File): Promise<File> {
  const svgText = await file.text();
  const { width, height } = parseSvgDimensions(svgText);

  const blob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  try {
    const img = await loadImage(url);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get canvas 2d context');
    }

    ctx.drawImage(img, 0, 0, width, height);

    const pngBlob = await canvasToBlob(canvas, 'image/png');
    const pngName = file.name.replace(/\.svg$/i, '.png');

    return new File([pngBlob], pngName, { type: 'image/png' });
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Check if a file is an SVG that should be converted.
 */
function isSvgFile(file: File): boolean {
  return file.type === 'image/svg+xml';
}

/**
 * If the file is SVG, convert to PNG. Otherwise return as-is.
 */
export async function maybeConvertSvg(file: File): Promise<File> {
  if (isSvgFile(file)) {
    return convertSvgToPng(file);
  }
  return file;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function parseSvgDimensions(svgText: string): { width: number; height: number } {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgText, 'image/svg+xml');
  const svg = doc.querySelector('svg');

  if (!svg) {
    return { width: DEFAULT_SIZE, height: DEFAULT_SIZE };
  }

  // Try explicit width/height attributes first
  const w = parseFloat(svg.getAttribute('width') ?? '');
  const h = parseFloat(svg.getAttribute('height') ?? '');

  if (w > 0 && h > 0) {
    return { width: Math.round(w), height: Math.round(h) };
  }

  // Fall back to viewBox
  const viewBox = svg.getAttribute('viewBox');
  if (viewBox) {
    const parts = viewBox.trim().split(/[\s,]+/);
    if (parts.length === 4) {
      const vbW = parseFloat(parts[2]);
      const vbH = parseFloat(parts[3]);
      if (vbW > 0 && vbH > 0) {
        return { width: Math.round(vbW), height: Math.round(vbH) };
      }
    }
  }

  return { width: DEFAULT_SIZE, height: DEFAULT_SIZE };
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load SVG as image'));
    img.src = src;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error('Canvas toBlob returned null'));
      }
    }, type);
  });
}
