import { describe, expect, it, vi } from 'vitest';
import { convertPostContent } from './post';
import { encodeLegacyWireDocument, type WireBlockFixture } from './test-fixtures';

vi.mock('./map-data', () => ({ injectMapData: vi.fn(async (html: string) => html) }));

describe('post executable block conversion', () => {
  const noneChannels = () => Array.from({ length: 4 }, () => ({ kind: 'none' }));
  const shaderStages = (
    sources: Partial<Record<string, string>> = {},
  ): NonNullable<WireBlockFixture['shaderStages']> => [
    { type: 'shaderCommon' as const, content: [{ type: 'text' as const, text: sources.shaderCommon ?? '' }] },
    { type: 'shaderVertex' as const, content: [{ type: 'text' as const, text: sources.shaderVertex ?? '' }] },
    ...(['A', 'B', 'C', 'D'] as const).map((name) => ({
      type: `shaderBuffer${name}` as const,
      props: { channels: noneChannels() },
      content: [{ type: 'text' as const, text: sources[`shaderBuffer${name}`] ?? '' }],
    })),
    {
      type: 'shaderCubemap' as const,
      props: { channels: noneChannels() },
      content: [{ type: 'text' as const, text: sources.shaderCubemap ?? '' }],
    },
    {
      type: 'shaderSound' as const,
      props: { channels: noneChannels() },
      content: [{ type: 'text' as const, text: sources.shaderSound ?? '' }],
    },
    {
      type: 'shaderImage' as const,
      props: { channels: noneChannels() },
      content: [{ type: 'text' as const, text: sources.shaderImage ?? '' }],
    },
  ];

  it('preserves executable identity in JSON and safe HTML while exporting ordinary Markdown fences', async () => {
    const converted = await convertPostContent(
      encodeLegacyWireDocument([
        {
          id: 'p5',
          type: 'p5Sketch',
          props: {
            mode: 'preview',
            previewWidth: '55',
            textAlignment: 'center',
            capabilities: 'camera microphone',
          },
          content: [{ type: 'text', text: 'createCanvas(320, 180);\nconst marker = "<script>";' }],
        },
        {
          id: 'three',
          type: 'threeScene',
          props: { language: 'typescript' },
          content: [{ type: 'text', text: 'const scene: THREE.Scene = new THREE.Scene();' }],
        },
        {
          id: 'shader',
          type: 'shader',
          shaderStages: shaderStages({
            shaderCommon: 'float shared = 1.0;',
            shaderVertex: 'void main() { gl_Position = vec4(0.0); }',
            shaderBufferA: 'void mainImage(out vec4 c, in vec2 p) { c = vec4(shared); }',
            shaderSound: 'vec2 mainSound(float time) { return vec2(0.0); }',
            shaderImage: 'void mainImage(out vec4 color, in vec2 coord) { color = vec4(1.0); }',
          }),
        },
      ]),
      'post-1',
    );

    expect(converted.json).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'p5Sketch',
          props: expect.objectContaining({ capabilities: 'camera microphone' }),
        }),
        expect.objectContaining({ type: 'threeScene', props: expect.objectContaining({ language: 'typescript' }) }),
        expect.objectContaining({ type: 'shader' }),
      ]),
    );
    expect(converted.html).toContain('data-content-type="p5Sketch"');
    expect(converted.html).toContain('data-content-type="threeScene"');
    expect(converted.html).toContain('data-content-type="shader"');
    expect(converted.html).not.toContain('<script>');
    expect(converted.markdown).toContain('```javascript\ncreateCanvas(320, 180);');
    expect(converted.markdown).toContain('```typescript\nconst scene: THREE.Scene');
    expect(converted.json).toContainEqual(
      expect.objectContaining({
        type: 'shader',
        content: expect.arrayContaining([
          expect.objectContaining({ type: 'shaderCommon' }),
          expect.objectContaining({ type: 'shaderBufferA' }),
          expect.objectContaining({ type: 'shaderSound' }),
          expect.objectContaining({ type: 'shaderImage' }),
        ]),
      }),
    );
    expect(converted.html).toContain('data-shader-filename="buffer-a.glsl"');
    expect(converted.html).toContain('data-shader-filename="sound.glsl"');
    expect(converted.markdown).toContain('### vert.glsl\n\n```glsl\nvoid main()');
    expect(converted.markdown).toContain('### frag.glsl\n\n```glsl\nvoid mainImage');
    expect(converted.markdown).not.toContain('```glsl vertex');
    expect(converted.text).toContain('gl_Position');
    expect(converted.text).toContain('createCanvas(320, 180)');
  });

  it('rejects obsolete executable source attributes instead of silently dropping them', async () => {
    await expect(
      convertPostContent(
        encodeLegacyWireDocument([{ id: 'p5', type: 'p5Sketch', props: { source: 'legacyP5();' }, content: [] }]),
        'post-1',
      ),
    ).rejects.toThrow('Unsupported durable editor p5Sketch attribute: source');
  });

  it('chooses a fence longer than backtick runs in executable source', async () => {
    const converted = await convertPostContent(
      encodeLegacyWireDocument([
        {
          id: 'p5',
          type: 'p5Sketch',
          content: [{ type: 'text', text: 'const markdown = "```nested```";' }],
        },
      ]),
      'post-1',
    );

    expect(converted.markdown).toContain('````javascript\nconst markdown = "```nested```";\n````');
  });

  it('preserves typed File channels without accepting URL-shaped channel state', async () => {
    const stages = shaderStages({
      shaderImage: 'void mainImage(out vec4 c, in vec2 p) { c = texture(iChannel0, p); }',
    });
    stages[8]!.props = {
      channels: [
        { kind: 'textureFile', fileId: 'image-file', sampler: { filter: 'linear', wrap: 'repeat', vflip: true } },
        { kind: 'videoFile', fileId: 'video-file', sampler: { filter: 'linear', wrap: 'clamp', vflip: false } },
        {
          kind: 'cubemapFiles',
          fileIds: ['px', 'nx', 'py', 'ny', 'pz', 'nz'],
          sampler: { filter: 'nearest', wrap: 'clamp', vflip: false },
        },
        { kind: 'cubemapPass', sampler: { filter: 'linear', wrap: 'clamp', vflip: false } },
      ],
    };
    const converted = await convertPostContent(
      encodeLegacyWireDocument([{ id: 'shader', type: 'shader', shaderStages: stages }]),
      'post-1',
    );

    const shader = (converted.json as Array<{ content: Array<{ type: string; props?: Record<string, unknown> }> }>)[0]!;
    expect(shader.content[8]?.props?.channels).toEqual(stages[8]?.props?.channels);
    expect(converted.html).toContain('image-file');
    expect(converted.html).not.toContain('https://');

    const invalid = shaderStages();
    invalid[8]!.props = {
      channels: [{ kind: 'textureFile', fileId: 'image', url: 'https://bad.test/x' }, ...noneChannels().slice(1)],
    };
    await expect(
      convertPostContent(encodeLegacyWireDocument([{ id: 'shader', type: 'shader', shaderStages: invalid }]), 'post-1'),
    ).rejects.toThrow('Invalid durable editor shader channel');

    const obsolete = shaderStages();
    obsolete[8]!.props = {
      channels: [
        { kind: 'soundFFT', sampler: { filter: 'linear', wrap: 'clamp', vflip: false } },
        ...noneChannels().slice(1),
      ],
    };
    await expect(
      convertPostContent(
        encodeLegacyWireDocument([{ id: 'shader', type: 'shader', shaderStages: obsolete }]),
        'post-1',
      ),
    ).rejects.toThrow('Invalid durable editor shader channel');
  });

  it('rejects mutual buffer dependency cycles while allowing self-feedback', async () => {
    const cyclic = shaderStages();
    cyclic[2]!.props = { channels: [{ kind: 'buffer', buffer: 'B' }, ...noneChannels().slice(1)] };
    cyclic[3]!.props = { channels: [{ kind: 'buffer', buffer: 'A' }, ...noneChannels().slice(1)] };
    await expect(
      convertPostContent(encodeLegacyWireDocument([{ id: 'shader', type: 'shader', shaderStages: cyclic }]), 'post-1'),
    ).rejects.toThrow('shader buffer dependency cycle');

    const feedback = shaderStages();
    feedback[2]!.props = { channels: [{ kind: 'buffer', buffer: 'A' }, ...noneChannels().slice(1)] };
    await expect(
      convertPostContent(
        encodeLegacyWireDocument([{ id: 'shader', type: 'shader', shaderStages: feedback }]),
        'post-1',
      ),
    ).resolves.toMatchObject({ json: [expect.objectContaining({ type: 'shader' })] });
  });

  it('does not silently accept executable attributes or styled source outside the contract', async () => {
    await expect(
      convertPostContent(
        encodeLegacyWireDocument([{ id: 'p5', type: 'p5Sketch', props: { camera: 'yes' }, content: [] }]),
        'post-1',
      ),
    ).rejects.toThrow('Invalid durable editor p5Sketch device capability');

    await expect(
      convertPostContent(
        encodeLegacyWireDocument([{ id: 'shader', type: 'shader', props: { source: 'not durable' }, content: [] }]),
        'post-1',
      ),
    ).rejects.toThrow('Unsupported durable editor shader attribute: source');

    await expect(
      convertPostContent(
        encodeLegacyWireDocument([
          {
            id: 'shader',
            type: 'shader',
            shaderStages: shaderStages().reverse(),
          },
        ]),
        'post-1',
      ),
    ).rejects.toThrow('Invalid durable editor shader stage content');

    await expect(
      convertPostContent(
        encodeLegacyWireDocument([
          {
            id: 'p5',
            type: 'p5Sketch',
            content: [{ type: 'text', text: 'styled', styles: { bold: true } }],
          },
        ]),
        'post-1',
      ),
    ).rejects.toThrow('Invalid durable editor p5Sketch source content');
  });
});
