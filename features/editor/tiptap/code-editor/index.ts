export {
  MonacoSourceEditor,
  type MonacoSourceEditorProps,
  type SourceEditorLanguage,
  type SourceEditorChange,
  type SourceEditorMarker,
  type SourceEditorMarkerSeverity,
  type SourceEditorTextChange,
} from './MonacoSourceEditor';
export { registerGlslLanguage } from './glsl-language';
export {
  isMonacoSourceEditorEvent,
  isMonacoSourceEditorTarget,
  MONACO_SOURCE_EDITOR_SELECTOR,
  withMonacoSourceEditorEvents,
} from './source-editor-boundary';

export type { SourceEditorDensity, SourceEditorBehaviorOptions } from './source-editor-presentation';
