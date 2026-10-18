import { describe, expect, it } from 'vitest';
import { parseEmbedProps } from './schema';

describe('parseEmbedProps', () => {
  it.each([undefined, null, {}])('applies the shared contract defaults to stored props %j', (props) => {
    expect(parseEmbedProps(props)).toEqual({
      uri: '',
      title: '',
      heightMode: 'fixed',
      height: '640',
      allowScripts: 'true',
      allowSameOrigin: 'true',
      allowForms: 'false',
      allowDownloads: 'false',
      allowPopups: 'false',
      allowMicrophone: 'false',
      allowSpeakerSelection: 'false',
      allowFullscreen: 'false',
    });
  });

  it.each(['180', '2160'])('keeps a stored whole-pixel height of %s at the contract bounds', (height) => {
    expect(parseEmbedProps({ height }).height).toBe(height);
  });

  it.each([
    { height: '179' },
    { height: '2161' },
    { height: '12.5' },
    { height: '' },
    { height: 480 },
    { heightMode: 'fill' },
    { allowForms: 'maybe' },
    { allowScripts: true },
  ])('rejects malformed stored props %j', (props) => {
    expect(() => parseEmbedProps(props)).toThrow();
  });
});
