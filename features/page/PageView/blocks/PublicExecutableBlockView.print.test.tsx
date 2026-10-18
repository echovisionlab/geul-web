import { NextIntlClientProvider } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { ShaderProgramDocument } from '@/features/editor/tiptap/shader/shader-program';
import { DesignSystemProvider } from '@/lib/providers/DesignSystemProvider';
import enMessages from '@/messages/en.json';
import { PublicExecutableBlockView } from './PublicExecutableBlockView';

// The real component highlights in an effect through a dynamically imported highlighter; the stand-in keeps the
// language it receives visible in the static markup.
vi.mock('@/features/editor/tiptap/code/PrintCodeSource', () => ({
  PrintCodeSource: ({ language, source }: { language: string; source: string }) => (
    <pre data-print-code-source="" data-language={language}>
      <code>{source}</code>
    </pre>
  ),
}));

const shaderProgram: ShaderProgramDocument = {
  sources: {
    common: '',
    vertex: 'vertex source',
    bufferA: '',
    bufferB: '',
    bufferC: '',
    bufferD: '',
    cubemap: '',
    sound: '',
    image: 'original source',
  },
  channels: {},
};

function renderPrintSource(type: 'p5Sketch' | 'threeScene' | 'shader', language: string): string {
  const html = renderToStaticMarkup(
    <NextIntlClientProvider locale="en" timeZone="UTC" messages={enMessages}>
      <DesignSystemProvider locale="en" forceColorScheme="light">
        {type === 'shader' ? (
          <PublicExecutableBlockView
            blockId="shader-1"
            title="Printable source"
            type="shader"
            program={shaderProgram}
            language="glsl"
            previewHeight={360}
          />
        ) : (
          <PublicExecutableBlockView
            blockId={`${type}-1`}
            title="Printable source"
            type={type}
            source="original source"
            language={language}
            previewHeight={360}
          />
        )}
      </DesignSystemProvider>
    </NextIntlClientProvider>,
  );
  const printSource = new RegExp(`data-executable-print-source="${type}">([\\s\\S]*?)</div>`, 'u').exec(html)?.[1];
  if (printSource === undefined) {
    throw new Error(`Missing ${type} print source`);
  }
  return printSource;
}

describe('PublicExecutableBlockView print output', () => {
  it.each([
    ['p5Sketch', 'javascript', ['original source']],
    ['threeScene', 'typescript', ['original source']],
    ['shader', 'glsl', ['vertex source', 'original source']],
  ] as const)('uses highlighted source instead of the %s runtime for print', (type, language, sources) => {
    const printSource = renderPrintSource(type, language);
    const printed = [
      ...printSource.matchAll(/<pre data-print-code-source="" data-language="([^"]*)"><code>([^<]*)<\/code><\/pre>/gu),
    ];

    expect(printSource).not.toContain('<img');
    expect(printed.map(([, , source]) => source)).toEqual(sources);
    expect(printed.map(([, printedLanguage]) => printedLanguage)).toEqual(sources.map(() => language));
  });
});
