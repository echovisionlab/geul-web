import type { DocumentLayout } from './types';
import type { DocumentLayoutViewModel } from './ui/types';

export function toDocumentLayoutViewModel(layout: DocumentLayout): DocumentLayoutViewModel {
  return {
    contentHeight: layout.contentHeight,
    pageChrome: layout.pageChrome,
    footer: layout.footer,
    ...(layout.hideTableOfContents ? { hideTableOfContents: true } : {}),
  };
}

export function toDocumentLayout(viewModel: DocumentLayoutViewModel): DocumentLayout {
  return {
    contentHeight: viewModel.contentHeight,
    pageChrome: viewModel.pageChrome,
    footer: viewModel.footer,
    ...(viewModel.hideTableOfContents ? { hideTableOfContents: true } : {}),
  };
}
