/** Durable language metadata for code blocks, independent of a renderer. */
export interface CodeBlockLanguageOption {
  aliases: readonly string[];
  name: string;
}

export interface CodeBlockOptions {
  defaultLanguage: string;
  supportedLanguages: Readonly<Record<string, CodeBlockLanguageOption>>;
}

export interface ResolvedCodeBlockLanguage {
  /** Canonical durable language stored in the ProseMirror node. */
  durableLanguage: string;
  /** Monaco language id. Unsupported durable languages deliberately use plaintext. */
  monacoLanguage: string;
  /** Stable model suffix used by Monaco language services. */
  fileExtension: string;
  syntaxHighlighting: boolean;
}

/**
 * Authoring and rendering surfaces use this common vocabulary. Syntax
 * highlighting is intentionally a renderer concern, not persisted state.
 */
export const codeBlockOptions = {
  defaultLanguage: 'javascript',
  supportedLanguages: {
    text: { name: 'Plain Text', aliases: ['text', 'txt', 'plain'] },
    c: { name: 'C', aliases: ['c'] },
    cpp: { name: 'C++', aliases: ['cpp', 'c++'] },
    css: { name: 'CSS', aliases: ['css'] },
    glsl: { name: 'GLSL', aliases: ['glsl'] },
    go: { name: 'Go', aliases: ['go', 'golang'] },
    graphql: { name: 'GraphQL', aliases: ['graphql', 'gql'] },
    haml: { name: 'Ruby Haml', aliases: ['haml'] },
    html: { name: 'HTML', aliases: ['html'] },
    java: { name: 'Java', aliases: ['java'] },
    javascript: { name: 'JavaScript', aliases: ['javascript', 'js'] },
    json: { name: 'JSON', aliases: ['json'] },
    jsonc: { name: 'JSON with Comments', aliases: ['jsonc'] },
    jsonl: { name: 'JSON Lines', aliases: ['jsonl'] },
    jsx: { name: 'JSX', aliases: ['jsx'] },
    julia: { name: 'Julia', aliases: ['julia', 'jl'] },
    less: { name: 'Less', aliases: ['less'] },
    markdown: { name: 'Markdown', aliases: ['markdown', 'md'] },
    mdx: { name: 'MDX', aliases: ['mdx'] },
    php: { name: 'PHP', aliases: ['php'] },
    postcss: { name: 'PostCSS', aliases: ['postcss'] },
    pug: { name: 'Pug', aliases: ['pug', 'jade'] },
    python: { name: 'Python', aliases: ['python', 'py'] },
    r: { name: 'R', aliases: ['r'] },
    regexp: { name: 'RegExp', aliases: ['regexp', 'regex'] },
    sass: { name: 'Sass', aliases: ['sass'] },
    scss: { name: 'SCSS', aliases: ['scss'] },
    shellscript: { name: 'Bash', aliases: ['shellscript', 'bash', 'sh', 'shell', 'zsh'] },
    sql: { name: 'SQL', aliases: ['sql'] },
    svelte: { name: 'Svelte', aliases: ['svelte'] },
    typescript: { name: 'TypeScript', aliases: ['typescript', 'ts'] },
    vue: { name: 'Vue', aliases: ['vue'] },
    'vue-html': { name: 'Vue HTML', aliases: ['vue-html'] },
    wasm: { name: 'WebAssembly', aliases: ['wasm'] },
    wgsl: { name: 'WGSL', aliases: ['wgsl'] },
    xml: { name: 'XML', aliases: ['xml'] },
    yaml: { name: 'YAML', aliases: ['yaml', 'yml'] },
    tsx: { name: 'TSX', aliases: ['tsx', 'typescriptreact'] },
    haskell: { name: 'Haskell', aliases: ['haskell', 'hs'] },
    csharp: { name: 'C#', aliases: ['c#', 'csharp', 'cs'] },
    latex: { name: 'LaTeX', aliases: ['latex'] },
    lua: { name: 'Lua', aliases: ['lua'] },
    mermaid: { name: 'Mermaid', aliases: ['mermaid', 'mmd'] },
    ruby: { name: 'Ruby', aliases: ['ruby', 'rb'] },
    rust: { name: 'Rust', aliases: ['rust', 'rs'] },
    scala: { name: 'Scala', aliases: ['scala'] },
    swift: { name: 'Swift', aliases: ['swift'] },
    kotlin: { name: 'Kotlin', aliases: ['kotlin', 'kt', 'kts'] },
    'objective-c': { name: 'Objective C', aliases: ['objective-c', 'objc'] },
  },
} as const satisfies CodeBlockOptions;

type CodeBlockLanguage = keyof typeof codeBlockOptions.supportedLanguages;

const codeBlockEditorLanguages = {
  text: ['plaintext', 'txt'],
  c: ['c', 'c'],
  cpp: ['cpp', 'cpp'],
  css: ['css', 'css'],
  glsl: ['glsl', 'glsl'],
  go: ['go', 'go'],
  graphql: ['graphql', 'graphql'],
  haml: ['plaintext', 'haml'],
  html: ['html', 'html'],
  java: ['java', 'java'],
  javascript: ['javascript', 'js'],
  json: ['json', 'json'],
  jsonc: ['json', 'jsonc'],
  jsonl: ['json', 'jsonl'],
  jsx: ['javascript', 'jsx'],
  julia: ['julia', 'jl'],
  less: ['less', 'less'],
  markdown: ['markdown', 'md'],
  mdx: ['mdx', 'mdx'],
  php: ['php', 'php'],
  postcss: ['css', 'pcss'],
  pug: ['pug', 'pug'],
  python: ['python', 'py'],
  r: ['r', 'r'],
  regexp: ['plaintext', 'regex'],
  sass: ['scss', 'sass'],
  scss: ['scss', 'scss'],
  shellscript: ['shell', 'sh'],
  sql: ['sql', 'sql'],
  svelte: ['plaintext', 'svelte'],
  typescript: ['typescript', 'ts'],
  vue: ['html', 'vue'],
  'vue-html': ['html', 'vue'],
  wasm: ['plaintext', 'wat'],
  wgsl: ['wgsl', 'wgsl'],
  xml: ['xml', 'xml'],
  yaml: ['yaml', 'yaml'],
  tsx: ['typescript', 'tsx'],
  haskell: ['plaintext', 'hs'],
  csharp: ['csharp', 'cs'],
  latex: ['plaintext', 'tex'],
  lua: ['lua', 'lua'],
  mermaid: ['plaintext', 'mmd'],
  ruby: ['ruby', 'rb'],
  rust: ['rust', 'rs'],
  scala: ['scala', 'scala'],
  swift: ['swift', 'swift'],
  kotlin: ['kotlin', 'kt'],
  'objective-c': ['objective-c', 'm'],
} as const satisfies Record<CodeBlockLanguage, readonly [monacoLanguage: string, fileExtension: string]>;

export const CODE_BLOCK_AUTHORING_LANGUAGES = [
  'cpp',
  'c',
  'javascript',
  'typescript',
  'glsl',
  'go',
  'python',
  'shellscript',
  'html',
] as const satisfies readonly CodeBlockLanguage[];

function canonicalCodeBlockLanguage(value: unknown): CodeBlockLanguage {
  const candidate = typeof value === 'string' ? value.trim().toLowerCase() : '';
  for (const [language, option] of Object.entries(codeBlockOptions.supportedLanguages)) {
    if (language === candidate || option.aliases.includes(candidate as never)) {
      return language as CodeBlockLanguage;
    }
  }
  return 'text';
}

export function resolveCodeBlockLanguage(value: unknown): ResolvedCodeBlockLanguage {
  const durableLanguage = canonicalCodeBlockLanguage(value);
  const [monacoLanguage, fileExtension] = codeBlockEditorLanguages[durableLanguage];
  return {
    durableLanguage,
    monacoLanguage,
    fileExtension,
    syntaxHighlighting: monacoLanguage !== 'plaintext',
  };
}

export function getCodeBlockLanguageName(value: unknown): string {
  const { durableLanguage } = resolveCodeBlockLanguage(value);
  return codeBlockOptions.supportedLanguages[durableLanguage as CodeBlockLanguage].name;
}
