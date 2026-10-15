'use client';

import { type UIEvent, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { BlockCanvasPreviewProps } from '../types';
import { ImmersiveSceneRenderer } from './SceneRenderer';
import { parseImmersiveSceneConfig, type ImmersiveSceneProps } from './schema';
import { useAuthenticatedImmersiveSceneProps } from './useAuthenticatedMedia';

const CANVAS_PREVIEW_HEIGHT = 420;

export function ImmersiveSceneCanvasPreview({ props }: BlockCanvasPreviewProps<ImmersiveSceneProps>) {
  const hydratedProps = useAuthenticatedImmersiveSceneProps(props);
  return <ImmersiveScenePreview props={hydratedProps} />;
}

export function ImmersiveScenePreview({ props }: Pick<BlockCanvasPreviewProps<ImmersiveSceneProps>, 'props'>) {
  const t = useTranslations('pageEditor');
  const config = parseImmersiveSceneConfig(props);
  const [scrollProgress, setScrollProgress] = useState(0);
  const isScrollPreview = config.units.length > 1 && config.playback === 'scroll';

  useEffect(() => {
    setScrollProgress(0);
  }, [config.heightVh, config.unitsJson, isScrollPreview]);

  if (isScrollPreview) {
    const parsedScrollHeight = Number(config.heightVh);
    const scrollHeightPercent = Number.isFinite(parsedScrollHeight)
      ? Math.min(900, Math.max(120, parsedScrollHeight))
      : 360;
    const updateScrollProgress = (event: UIEvent<HTMLDivElement>) => {
      const element = event.currentTarget;
      const scrollDistance = element.scrollHeight - element.clientHeight;
      setScrollProgress(scrollDistance > 0 ? element.scrollTop / scrollDistance : 0);
    };

    /* eslint-disable jsx-a11y/no-noninteractive-tabindex -- The named scroll viewport needs keyboard focus to scroll authored units. */
    return (
      <div
        role="region"
        aria-label={t('sectionTypes.immersiveScene')}
        tabIndex={0}
        data-immersive-scene-preview-scroll
        data-preview-progress={scrollProgress}
        onScroll={updateScrollProgress}
        style={{
          height: CANVAS_PREVIEW_HEIGHT,
          overflowY: 'auto',
          overscrollBehaviorY: 'contain',
          scrollbarGutter: 'stable',
        }}
      >
        <div style={{ height: `${scrollHeightPercent}%`, minHeight: '100%', position: 'relative' }}>
          <div style={{ position: 'sticky', top: 0, height: CANVAS_PREVIEW_HEIGHT }}>
            <ImmersiveSceneRenderer config={config} preview progress={scrollProgress} />
          </div>
        </div>
      </div>
    );
    /* eslint-enable jsx-a11y/no-noninteractive-tabindex */
  }

  return (
    <div style={{ height: CANVAS_PREVIEW_HEIGHT }}>
      <ImmersiveSceneRenderer config={config} preview />
    </div>
  );
}
