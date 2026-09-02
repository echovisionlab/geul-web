// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import {
  mediaStyleToString,
  readCanonicalMediaName,
  resolveMediaContainerStyle,
  resolveMediaDisplayName,
  resolveMediaDownloadName,
} from './shared';

describe('media shared helpers', () => {
  it('preserves the authored shared media name verbatim', () => {
    expect(
      resolveMediaDisplayName({
        name: 'Birdsong version 1.2',
        fallback: 'Untitled media',
      }),
    ).toBe('Birdsong version 1.2');
  });

  it('does not derive or strip extensions from an authored shared name', () => {
    expect(
      resolveMediaDisplayName({
        name: 'birdsong-recording.wav',
        fallback: 'Untitled media',
      }),
    ).toBe('birdsong-recording.wav');
  });

  it('uses the fallback when the shared name is missing', () => {
    expect(
      resolveMediaDisplayName({
        fallback: 'Untitled media',
      }),
    ).toBe('Untitled media');
  });

  it('adds a safe download extension without putting it in the shared display name', () => {
    expect(
      resolveMediaDownloadName({
        name: 'Field notes',
        mimeType: 'application/pdf',
        url: 'https://cdn.example.com/signed-download',
      }),
    ).toBe('Field notes.pdf');
    expect(
      resolveMediaDownloadName({
        name: 'Field notes',
        mimeType: 'application/octet-stream',
        url: 'https://cdn.example.com/files/source.PDF?signature=abc',
      }),
    ).toBe('Field notes.pdf');
    expect(
      resolveMediaDownloadName({
        name: 'Field notes.pdf',
        mimeType: 'application/pdf',
      }),
    ).toBe('Field notes.pdf');
  });

  it('reads canonical blank names without importing presentation fallbacks', () => {
    const element = document.createElement('div');
    element.setAttribute('data-media-name', '');
    element.innerHTML = '<span class="media-title">Untitled audio</span>';

    expect(readCanonicalMediaName(element, '.media-title')).toBe('');
    element.removeAttribute('data-media-name');
    expect(readCanonicalMediaName(element, '.media-title')).toBe('Untitled audio');
  });

  it('resolves aligned container styles for partial-width media blocks', () => {
    expect(resolveMediaContainerStyle('39', 'left')).toEqual({
      width: '39%',
      marginLeft: '0',
      marginRight: 'auto',
    });
    expect(resolveMediaContainerStyle('39', 'center')).toEqual({
      width: '39%',
      marginLeft: 'auto',
      marginRight: 'auto',
    });
    expect(resolveMediaContainerStyle('39', 'right')).toEqual({
      width: '39%',
      marginLeft: 'auto',
      marginRight: '0',
    });
  });

  it('clamps tiny widths and omits full-width wrappers', () => {
    expect(resolveMediaContainerStyle('5', 'left')).toEqual({
      width: '10%',
      marginLeft: '0',
      marginRight: 'auto',
    });
    expect(resolveMediaContainerStyle('100', 'right')).toEqual({});
  });

  it('serializes container style records for exported HTML', () => {
    expect(
      mediaStyleToString({
        width: '62%',
        marginLeft: '0',
        marginRight: 'auto',
      }),
    ).toBe('width:62%;margin-left:0;margin-right:auto');
  });
});
