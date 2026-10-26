import type { ClosedVisualProps } from '../visual-contract';
import control from '../Control.module.css';
import dropdown from '../DropdownMenu/DropdownMenu.module.css';
import display from '../Display/Display.module.css';
import input from '../Input/Input.module.css';
import overlay from '../Overlay.module.css';
import { applyTextPresentation } from '../Typography/dom-text';
import classes from './VideoControls.module.css';

export interface VideoMediaPresentation extends ClosedVisualProps {
  kind: 'video-js';
}
/** Adapter owns SDK chrome; SDK keeps its playback, menu keyboard, fullscreen and seeking behaviors. */
export function applyVideoMediaPresentation(root: HTMLElement, { kind }: VideoMediaPresentation) {
  if (kind !== 'video-js') {
    throw new RangeError('Unregistered Core media adapter');
  }
  root.classList.add(classes.video);
  const project = () => {
    // Video.js's BigPlayButton omits the regular vjs-button class.
    root.querySelectorAll<HTMLElement>('.vjs-button, .vjs-big-play-button').forEach((element) => {
      if (!element.classList.contains(control.root)) {
        element.classList.add(control.root);
      }
      element.dataset.controlKind = element.matches('.vjs-default-button, .vjs-done-button') ? 'button' : 'icon';
      element.dataset.controlSize = element.classList.contains('vjs-big-play-button') ? 'lg' : 'chrome';
      element.dataset.emphasis = 'low';
      element.dataset.tone = 'neutral';
      element.dataset.contrast = element.closest('.vjs-modal-dialog') ? 'standard' : 'inverse';
      if (
        element.getAttribute('aria-disabled') === 'true' ||
        (element instanceof HTMLButtonElement && element.disabled)
      ) {
        element.dataset.disabled = 'true';
      } else {
        delete element.dataset.disabled;
      }
    });
    root.querySelectorAll<HTMLElement>('.vjs-menu-content').forEach((element) => {
      if (!element.classList.contains(dropdown.dropdown)) {
        element.classList.add(overlay.menuSurface, dropdown.dropdown);
      }
      element.dataset.size = 'compact';
    });
    root.querySelectorAll<HTMLElement>('.vjs-menu-item').forEach((element) => {
      if (!element.classList.contains(dropdown.item)) {
        element.classList.add(dropdown.item);
      }
      if (element.classList.contains('vjs-selected')) {
        element.dataset.coreSelected = 'true';
      } else {
        delete element.dataset.coreSelected;
      }
      if (element.getAttribute('aria-disabled') === 'true') {
        element.dataset.disabled = 'true';
      } else {
        delete element.dataset.disabled;
      }
    });
    root.querySelectorAll<HTMLElement>('.vjs-time-control, .vjs-playback-rate-value').forEach((element) => {
      if (!element.dataset.mediaTypography) {
        applyTextPresentation(element, { size: 'xs', tone: 'inverse', weight: 'regular' });
        element.dataset.mediaTypography = 'true';
      }
    });
    root.querySelectorAll<HTMLElement>('.vjs-modal-dialog-content').forEach((element) => {
      if (!element.dataset.mediaTypography) {
        applyTextPresentation(element, { size: 'sm', tone: 'primary' });
        element.dataset.mediaTypography = 'true';
      }
    });
    root.querySelectorAll<HTMLSelectElement>('.vjs-text-track-settings select').forEach((element) => {
      if (element.closest('[data-geul-media-input]')) {
        return;
      }
      const field = element.ownerDocument.createElement('div');
      field.classList.add(input.root);
      field.dataset.geulInputSize = 'xs';
      field.dataset.geulMediaInput = 'true';
      const wrapper = element.ownerDocument.createElement('div');
      wrapper.classList.add(input.wrapper);
      element.replaceWith(field);
      field.appendChild(wrapper);
      wrapper.appendChild(element);
      element.classList.add(input.input);
    });
    root.querySelectorAll<HTMLElement>('.vjs-loading-spinner').forEach((element) => {
      if (!element.querySelector('[data-geul-media-loading-indicator]')) {
        const indicator = element.ownerDocument.createElement('span');
        indicator.classList.add(display.spinner);
        indicator.dataset.geulMediaLoadingIndicator = 'true';
        indicator.dataset.size = 'md';
        indicator.dataset.tone = 'inherit';
        indicator.setAttribute('aria-hidden', 'true');
        element.appendChild(indicator);
      }
    });
  };
  const mark = (event: Event, name: 'hovered' | 'focused', active: boolean) => {
    const item = event.target instanceof Element ? event.target.closest<HTMLElement>('.vjs-menu-item') : null;
    if (item && root.contains(item)) {
      if (active) {
        item.dataset[name] = 'true';
      } else {
        delete item.dataset[name];
      }
    }
  };
  const hovered = (event: Event) => mark(event, 'hovered', true);
  const unhovered = (event: Event) => mark(event, 'hovered', false);
  const focused = (event: Event) => mark(event, 'focused', true);
  const blurred = (event: Event) => mark(event, 'focused', false);
  root.addEventListener('pointerover', hovered);
  root.addEventListener('pointerout', unhovered);
  root.addEventListener('focusin', focused);
  root.addEventListener('focusout', blurred);
  project();
  const observer = new MutationObserver(project);
  observer.observe(root, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class', 'aria-disabled', 'disabled'],
  });
  return () => {
    observer.disconnect();
    root.removeEventListener('pointerover', hovered);
    root.removeEventListener('pointerout', unhovered);
    root.removeEventListener('focusin', focused);
    root.removeEventListener('focusout', blurred);
  };
}

export function applyMediaActionSlot(element: HTMLElement) {
  element.classList.add(classes.actionSlot);
}
