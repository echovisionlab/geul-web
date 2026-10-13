import type { SourceEditorBehaviorOptions } from './source-editor-presentation';
import type { MonacoSourceEditorProps } from './MonacoSourceEditor';

const behavior: SourceEditorBehaviorOptions = { formatOnPaste: false, formatOnType: false, tabSize: 2, wordWrap: 'on' };
const compact: MonacoSourceEditorProps = {
  value: '',
  language: 'javascript',
  ariaLabel: 'Source',
  modelPath: 'sample.js',
  density: 'compact',
  editorOptions: behavior,
};
// @ts-expect-error Feature cannot set an arbitrary source font scale.
const customFont: SourceEditorBehaviorOptions = { fontSize: 13 };
// @ts-expect-error Feature cannot replace shared editor padding.
const customPadding: SourceEditorBehaviorOptions = { padding: { top: 3 } };
// @ts-expect-error Feature cannot enable motion against the shared preference adapter.
const customMotion: SourceEditorBehaviorOptions = { smoothScrolling: true };
// @ts-expect-error Feature cannot select a vendor theme.
const customTheme: SourceEditorBehaviorOptions = { theme: 'vs-dark' };
void [compact, customFont, customPadding, customMotion, customTheme];

const injectedFont = { fontSize: 13, wordWrap: 'on' as const };
// @ts-expect-error Typed option spreads cannot bypass the shared font scale either.
const injectedOptions: SourceEditorBehaviorOptions = injectedFont;
void injectedOptions;
