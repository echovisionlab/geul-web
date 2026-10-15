import { fromJson } from '@bufbuild/protobuf';
import {
  RichTextBlockDataSchema,
  RichTextBlockLocaleDataSchema,
} from '@echovisionlab/geul-proto/content/block_content_pb.ts';
import { NextIntlClientProvider } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DesignSystemProvider } from '@/lib/providers/DesignSystemProvider';
import { SHADER_STAGE_DEFINITIONS, DEFAULT_SHADER_PROGRAM } from '@/features/editor/tiptap/shader/shader-program';
import enMessages from '@/messages/en.json';
import { GeneratedExecutableBlockView } from './GeneratedExecutableBlockView';

function publishedShader(channelCount = 0) {
  const base = fromJson(RichTextBlockDataSchema, {
    shader: {
      props: {
        stages: SHADER_STAGE_DEFINITIONS.map(([stage], index) => ({
          kind: index + 1,
          source: DEFAULT_SHADER_PROGRAM.sources[stage],
          ...(index >= 2 ? { channels: Array.from({ length: channelCount }, () => ({ kind: 1 })) } : {}),
        })),
      },
    },
  });
  const locale = fromJson(RichTextBlockLocaleDataSchema, { shader: { props: { title: 'Edited shader title' } } });
  if (base.value.case !== 'shader' || locale.value.case !== 'shader') {
    throw new Error('Expected Shader fixture');
  }
  return renderToStaticMarkup(
    <NextIntlClientProvider locale="en" timeZone="UTC" messages={enMessages}>
      <DesignSystemProvider locale="en" forceColorScheme="light">
        <GeneratedExecutableBlockView
          block={{
            id: 'default-shader',
            kind: 'shader',
            base: base.value.value,
            locale: locale.value.value,
            children: [],
          }}
        />
      </DesignSystemProvider>
    </NextIntlClientProvider>,
  );
}

describe('Generated executable publication', () => {
  it('publishes a newly inserted Shader with omitted channels and its authored title', () => {
    const html = publishedShader();
    expect(html).toContain('data-runtime-surface="shader"');
    expect(html).toContain('Edited shader title');
    expect(html).not.toContain('data-invalid-executable-block');
  });

  it.each([1, 5])('rejects %s explicit channel entries instead of silently normalizing malformed input', (count) => {
    const html = publishedShader(count);
    expect(html).toContain('data-invalid-executable-block="shader"');
    expect(html).not.toContain('data-runtime-surface="shader"');
  });
});
