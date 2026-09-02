export type LocalMonacoWorkerKind = 'editor' | 'typescript' | 'html' | 'css' | 'json';

export function localMonacoWorkerKind(label: string): LocalMonacoWorkerKind {
  if (label === 'typescript' || label === 'javascript') {
    return 'typescript';
  }
  if (label === 'html' || label === 'handlebars' || label === 'razor') {
    return 'html';
  }
  if (label === 'css' || label === 'scss' || label === 'less') {
    return 'css';
  }
  if (label === 'json') {
    return 'json';
  }
  return 'editor';
}
