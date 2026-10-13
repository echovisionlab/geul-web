/** Restore focus within this canvas after its structural controls disappear. */
export function focusPageSection(root: HTMLElement | null, sectionId: string | 'add') {
  if (!root) {
    return;
  }
  if (sectionId === 'add') {
    root.querySelector<HTMLElement>('[data-page-section-add]')?.focus();
    return;
  }
  const section = Array.from(root.querySelectorAll<HTMLElement>('[data-page-section-id]')).find(
    (element) => element.dataset.pageSectionId === sectionId,
  );
  section?.querySelector<HTMLElement>('[data-page-section-toggle]')?.focus();
}
