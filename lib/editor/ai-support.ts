export type AIContextMode = 'modify' | 'generate';

export interface AIEditorContext {
  currentBlockId: string;
  isSupported: boolean;
  mode: AIContextMode;
  selectedBlockIds: string[];
}
