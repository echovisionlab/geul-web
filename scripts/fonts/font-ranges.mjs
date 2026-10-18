import { WEIGHTS } from './fonts.config.mjs';

export function expandRange(unicodeRange) {
  const points = [];
  for (const token of unicodeRange.split(',')) {
    const [start, end] = token.trim().replace(/^U\+/i, '').split('-');
    const from = Number.parseInt(start.replace(/\?/g, '0'), 16);
    const to = Number.parseInt((end ?? start).replace(/\?/g, 'f'), 16);
    for (let codePoint = from; codePoint <= to; codePoint += 1) {
      points.push(codePoint);
    }
  }
  return points;
}

export function compressRange(points) {
  const sorted = [...new Set(points)].sort((a, b) => a - b);
  const parts = [];
  for (let index = 0; index < sorted.length;) {
    let end = index;
    while (end + 1 < sorted.length && sorted[end + 1] === sorted[end] + 1) {
      end += 1;
    }
    const from = sorted[index].toString(16);
    parts.push(end === index ? `U+${from}` : `U+${from}-${sorted[end].toString(16)}`);
    index = end + 1;
  }
  return parts.join(', ');
}

export function claimPoints(unicodeRange, available, covered, filter = () => true) {
  const points = [...new Set(expandRange(unicodeRange))].filter(
    (point) => available.has(point) && !covered.has(point) && filter(point),
  );
  points.forEach((point) => covered.add(point));
  return points;
}

export function faceRules(family, file, points, variable, weight) {
  const weights = variable ? WEIGHTS : [Number(weight)];
  return weights.map(
    (weight) =>
      `@font-face{font-family:'${family}';font-style:normal;font-weight:${weight};font-display:swap;` +
      `src:url(${file}) format('woff2');unicode-range:${compressRange(points)}}`,
  );
}
