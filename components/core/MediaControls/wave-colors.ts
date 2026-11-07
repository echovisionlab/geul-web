import { semanticThemes } from '@echovisionlab/design-system/tokens';

/** Canvas colors follow the same semantic authority as the surrounding transport. */
export function readWaveMediaColors(container: HTMLElement) {
  const root = container.closest<HTMLElement>('[data-audio-player]') || container;
  const themeRoot = root.closest<HTMLElement>('[data-geul-theme]') || document.documentElement;
  const scheme = themeRoot.dataset.geulTheme === 'dark' ? 'dark' : 'light';
  const styles = getComputedStyle(root);
  const color = (role: 'wave-muted' | 'action-primary' | 'wave-cursor') =>
    styles.getPropertyValue(`--geul-${role}`).trim() || semanticThemes[scheme][role];
  return { waveColor: color('wave-muted'), progressColor: color('action-primary'), cursorColor: color('wave-cursor') };
}
