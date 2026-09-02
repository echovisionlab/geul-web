export interface NumberFieldConfig {
  numberType?: 'integer' | 'float';
  decimalPlaces: number;
}

/**
 * Validate number format and return error message if invalid
 */
export function getFormatError(str: string, config: NumberFieldConfig): string | null {
  if (str === '' || str === '-') {
    return null;
  }

  const isInteger = config.numberType === 'integer';

  if (isInteger) {
    if (str.includes('.')) {
      return 'Integer only';
    }
  } else if (config.numberType === 'float') {
    const decimalMatch = str.match(/\.(\d+)$/);
    if (decimalMatch && decimalMatch[1].length > config.decimalPlaces) {
      return `Max ${config.decimalPlaces} decimal places`;
    }
  }
  return null;
}

/**
 * Parse string to number with type-specific handling
 */
export function parseNumber(str: string, config: NumberFieldConfig): number | null {
  const parsed = parseFloat(str);
  if (isNaN(parsed)) {
    return null;
  }

  const isInteger = config.numberType === 'integer';

  if (isInteger) {
    return Math.trunc(parsed);
  }
  // Round to decimal places for float
  if (config.numberType === 'float') {
    const factor = 10 ** config.decimalPlaces;
    return Math.round(parsed * factor) / factor;
  }
  return parsed;
}
