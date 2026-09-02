export interface MarqueeResolvedItem {
  id: string;
  text: string;
  href?: string;
  logoUrl?: string | null;
  logoLightUrl?: string | null;
  logoDarkUrl?: string | null;
}

export interface MarqueeViewOptions {
  direction: 'left' | 'right';
  speed: 'slow' | 'normal' | 'fast';
  speedPxPerSecond?: number;
  itemHeight: 'sm' | 'md' | 'lg' | 'xl';
  itemHeightPx?: number;
  gap: 'sm' | 'md' | 'lg' | 'xl';
  pauseOnHover: boolean;
  linkTarget: 'same-tab' | 'new-tab';
  logoScale?: 'contain' | 'fill-height';
  fallbackMode?: 'name' | 'hide';
}

export type MarqueeSelectorItem = {
  id: string;
  name: string;
};
