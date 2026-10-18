import { describe, expect, it } from 'vitest';
import { parseColorToRgba } from './ThemeEditorCanvas';

describe('parseColorToRgba', () => {
  it('parses every color form allowed by the Map Theme contract', () => {
    expect(parseColorToRgba('#123')).toEqual({ r: 17, g: 34, b: 51, a: 1 });
    expect(parseColorToRgba('#1234')).toEqual({ r: 17, g: 34, b: 51, a: 68 / 255 });
    expect(parseColorToRgba('#112233')).toEqual({ r: 17, g: 34, b: 51, a: 1 });
    expect(parseColorToRgba('#11223344')).toEqual({ r: 17, g: 34, b: 51, a: 68 / 255 });
    expect(parseColorToRgba(' rgb( 17 , 34 , 51 ) ')).toEqual({ r: 17, g: 34, b: 51, a: 1 });
    expect(parseColorToRgba('rgba( 17, 34 , 51, 0.5 )')).toEqual({ r: 17, g: 34, b: 51, a: 0.5 });
    expect(parseColorToRgba('transparent')).toEqual({ r: 0, g: 0, b: 0, a: 0 });
    expect(() => parseColorToRgba('rgb(999, 34, 51)')).toThrow('Unsupported Map Theme color');
  });
});
