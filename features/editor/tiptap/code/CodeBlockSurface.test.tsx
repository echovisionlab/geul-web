// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MantineProvider } from '@mantine/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CodeBlockSurface } from './CodeBlockSurface';

const monacoProps = vi.hoisted(() => vi.fn());

vi.mock('../code-editor', () => ({
  MonacoSourceEditor: (props: Record<string, unknown>) => {
    monacoProps(props);
    return <div data-testid="mock-monaco">{String(props.value)}</div>;
  },
}));

vi.mock('./PrintCodeSource', () => ({
  PrintCodeSource: ({ language, source }: { language: string; source: string }) => (
    <pre data-print-code-source="" data-language={language}>
      <code>{source}</code>
    </pre>
  ),
}));

const roots: { unmount: () => void }[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) {
    act(() => root.unmount());
  }
  document.body.replaceChildren();
  vi.restoreAllMocks();
  monacoProps.mockClear();
});

describe('CodeBlockSurface', () => {
  it('shares the localized title, read-only Monaco layout and copy action', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    const host = document.createElement('div');
    document.body.append(host);
    const root = createRoot(host);
    roots.push(root);

    await act(async () => {
      root.render(
        <MantineProvider env="test">
          <CodeBlockSurface
            title="번역된 예제"
            fallbackTitle="코드 블록"
            titleLabel="제목"
            languageName="TypeScript"
            source='const greeting = "안녕하세요";'
            sourceLabel="소스"
            copyLabel="복사"
            monacoLanguage="typescript"
            modelPath="public/code/example.ts"
          />
        </MantineProvider>,
      );
    });

    expect(host.textContent).toContain('번역된 예제');
    expect(host.textContent).toContain('TypeScript');
    expect(host.querySelector('input')).toBeNull();
    expect(host.querySelector('[data-code-block-print-source]')?.textContent).toBe('const greeting = "안녕하세요";');
    expect(monacoProps).toHaveBeenLastCalledWith(
      expect.objectContaining({
        readOnly: true,
        bordered: false,
        editorOptions: {
          lineDecorationsWidth: 16,
          renderValidationDecorations: 'off',
        },
      }),
    );

    await act(async () => host.querySelector<HTMLButtonElement>('button[aria-label="복사"]')?.click());
    expect(writeText).toHaveBeenCalledWith('const greeting = "안녕하세요";');
  });

  it('edits only the localized title when title editing is enabled', async () => {
    const onTitleChange = vi.fn();
    const onLanguageChange = vi.fn();
    const host = document.createElement('div');
    document.body.append(host);
    const root = createRoot(host);
    roots.push(root);

    await act(async () => {
      root.render(
        <MantineProvider env="test">
          <CodeBlockSurface
            title=""
            fallbackTitle="Code block"
            titleLabel="Title"
            languageName="JavaScript"
            languageLabel="Language"
            languageValue="javascript"
            languageOptions={[
              { label: 'JavaScript', value: 'javascript' },
              { label: 'Python', value: 'python' },
            ]}
            source="const value = 1;"
            sourceLabel="Source"
            copyLabel="Copy"
            monacoLanguage="javascript"
            modelPath="code/example.js"
            titleEditable
            sourceReadOnly={false}
            onTitleChange={onTitleChange}
            onLanguageChange={onLanguageChange}
          />
        </MantineProvider>,
      );
    });

    const input = host.querySelector<HTMLInputElement>('input[aria-label="Title"]');
    expect(input?.placeholder).toBe('Code block');
    await act(async () => {
      input?.focus();
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      setter?.call(input, 'Localized title');
      input?.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(onTitleChange).toHaveBeenCalledWith('Localized title');
    const languageButton = host.querySelector<HTMLButtonElement>('button[aria-label="Language: JavaScript"]');
    expect(languageButton?.dataset.tone).toBe('neutral');
    expect(languageButton?.dataset.emphasis).toBe('low');
    await act(async () => languageButton?.click());
    const pythonOption = [...document.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')].find((option) =>
      option.textContent?.includes('Python'),
    );
    await act(async () => pythonOption?.click());
    expect(onLanguageChange).toHaveBeenCalledWith('python');
    expect(monacoProps).toHaveBeenLastCalledWith(
      expect.objectContaining({
        readOnly: false,
        editorOptions: {
          lineDecorationsWidth: 16,
          renderValidationDecorations: 'on',
        },
      }),
    );
  });
});
