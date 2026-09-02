export type DocumentContentHeightViewModel = 'content' | 'viewport';
export type DocumentChromeLayoutViewModel = 'flow' | 'pinned';

/** Serializable shape consumed by document-layout views. */
export interface DocumentLayoutViewModel {
  contentHeight: DocumentContentHeightViewModel;
  pageChrome: DocumentChromeLayoutViewModel;
  footer: DocumentChromeLayoutViewModel;
}
