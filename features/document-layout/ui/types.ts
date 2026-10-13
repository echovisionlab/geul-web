export type DocumentContentHeightViewModel = 'content' | 'viewport';
export type DocumentChromeLayoutViewModel = 'flow' | 'pinned';

/** Serializable shape consumed by document-layout views. */
export interface DocumentLayoutViewModel {
  contentHeight: DocumentContentHeightViewModel;
  pageChrome: DocumentChromeLayoutViewModel;
  footer: DocumentChromeLayoutViewModel;
}

/**
 * The ordinary document flow (content height, flow chrome, flow footer). Documents without an authored
 * layout (legal, changelog, work and event details) use it without loading the collaboration schema.
 */
export const FLOW_DOCUMENT_LAYOUT: DocumentLayoutViewModel = {
  contentHeight: 'content',
  pageChrome: 'flow',
  footer: 'flow',
};
