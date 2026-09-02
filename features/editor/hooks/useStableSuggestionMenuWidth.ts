'use client';

import { useEffect } from 'react';

const SUGGESTION_MENU_SELECTOR = '.bn-suggestion-menu';
const SUGGESTION_MENU_WIDTH_VAR = '--suggestion-menu-width';

interface TrackedSuggestionMenu {
  disconnect: () => void;
  scheduleMeasure: () => void;
}

let activeSubscriptions = 0;
let documentObserver: MutationObserver | null = null;
let trackedMenus = new Map<HTMLElement, TrackedSuggestionMenu>();
let resizeHandler: (() => void) | null = null;

function getMenuElements(node: Node): HTMLElement[] {
  if (!(node instanceof Element)) {
    return [];
  }

  const menus: HTMLElement[] = [];
  if (node instanceof HTMLElement && node.matches(SUGGESTION_MENU_SELECTOR)) {
    menus.push(node);
  }

  for (const menu of node.querySelectorAll(SUGGESTION_MENU_SELECTOR)) {
    if (menu instanceof HTMLElement) {
      menus.push(menu);
    }
  }

  return menus;
}

function untrackMenu(menu: HTMLElement) {
  const trackedMenu = trackedMenus.get(menu);
  if (!trackedMenu) {
    return;
  }

  trackedMenu.disconnect();
  trackedMenus.delete(menu);
}

function trackMenu(menu: HTMLElement) {
  if (trackedMenus.has(menu)) {
    return;
  }

  let maxWidth = 0;
  let frame: number | null = null;

  const measureNaturalWidth = () => {
    frame = null;

    menu.style.removeProperty(SUGGESTION_MENU_WIDTH_VAR);
    const width = Math.ceil(menu.getBoundingClientRect().width);
    if (width > maxWidth) {
      maxWidth = width;
    }

    if (maxWidth > 0) {
      menu.style.setProperty(SUGGESTION_MENU_WIDTH_VAR, `${maxWidth}px`);
    }
  };

  const scheduleMeasure = () => {
    if (frame !== null) {
      window.cancelAnimationFrame(frame);
    }

    frame = window.requestAnimationFrame(measureNaturalWidth);
  };

  const menuObserver = new MutationObserver(scheduleMeasure);
  menuObserver.observe(menu, {
    characterData: true,
    childList: true,
    subtree: true,
  });

  trackedMenus.set(menu, {
    disconnect: () => {
      if (frame !== null) {
        window.cancelAnimationFrame(frame);
      }
      menuObserver.disconnect();
      menu.style.removeProperty(SUGGESTION_MENU_WIDTH_VAR);
    },
    scheduleMeasure,
  });

  scheduleMeasure();
}

function startStableSuggestionMenuWidth() {
  if (typeof window === 'undefined' || typeof document === 'undefined' || !document.body) {
    return () => {};
  }

  activeSubscriptions += 1;

  if (activeSubscriptions > 1) {
    return () => {
      activeSubscriptions -= 1;
    };
  }

  trackedMenus = new Map();
  document.querySelectorAll(SUGGESTION_MENU_SELECTOR).forEach((menu) => {
    if (menu instanceof HTMLElement) {
      trackMenu(menu);
    }
  });

  documentObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      mutation.addedNodes.forEach((node) => getMenuElements(node).forEach(trackMenu));
      mutation.removedNodes.forEach((node) => getMenuElements(node).forEach(untrackMenu));
    }
  });
  documentObserver.observe(document.body, { childList: true, subtree: true });

  resizeHandler = () => {
    trackedMenus.forEach((trackedMenu) => trackedMenu.scheduleMeasure());
  };
  window.addEventListener('resize', resizeHandler);

  return () => {
    activeSubscriptions -= 1;
    if (activeSubscriptions > 0) {
      return;
    }

    documentObserver?.disconnect();
    documentObserver = null;

    if (resizeHandler) {
      window.removeEventListener('resize', resizeHandler);
      resizeHandler = null;
    }

    trackedMenus.forEach((trackedMenu) => trackedMenu.disconnect());
    trackedMenus.clear();
  };
}

export function useStableSuggestionMenuWidth() {
  useEffect(() => startStableSuggestionMenuWidth(), []);
}
