import { describe, expect, it } from 'vitest';
import { inlineEditorColorStyle } from './editor-color-presentation';

describe('inlineEditorColorStyle', () => {
  it('leaves semantic names to the light/dark CSS token mapping', () => {
    expect(inlineEditorColorStyle('textColor', 'blue')).toBeUndefined();
    expect(inlineEditorColorStyle('backgroundColor', 'default')).toBeUndefined();
  });

  it('preserves strictly safe legacy hex colors', () => {
    expect(inlineEditorColorStyle('textColor', '#abc')).toBe('color:#abc');
    expect(inlineEditorColorStyle('textColor', '#abcd')).toBe('color:#abcd');
    expect(inlineEditorColorStyle('backgroundColor', '#b02d23')).toBe('background-color:#b02d23');
    expect(inlineEditorColorStyle('backgroundColor', '#11223344')).toBe('background-color:#11223344');
  });

  it('does not turn arbitrary durable strings into CSS', () => {
    expect(inlineEditorColorStyle('textColor', 'red;background:url(https://example.invalid)')).toBeUndefined();
    expect(inlineEditorColorStyle('backgroundColor', 'rgb(1 2 3)')).toBeUndefined();
    expect(inlineEditorColorStyle('textColor', '#12345')).toBeUndefined();
  });
});
