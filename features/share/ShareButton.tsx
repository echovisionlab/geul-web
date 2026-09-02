'use client';

import { useTranslations } from 'next-intl';
import { useCopyToClipboard } from '@/lib/hooks/useCopyToClipboard';
import { ShareButtonView } from './ui/ShareButtonView';

export interface ShareButtonProps {
  url: string;
  title: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  iconSize?: number;
  minTouchSize?: number;
}

export function ShareButton({ url, title, size = 'lg', iconSize = 18, minTouchSize }: ShareButtonProps) {
  const tCommonActions = useTranslations('common.actions');
  const tCommonMessages = useTranslations('common.messages');
  const { copy } = useCopyToClipboard();

  const handleShare = async () => {
    const shareData = { title, url };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        copy(url, { successMessage: tCommonMessages('urlCopiedToClipboard') });
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        copy(url, { successMessage: tCommonMessages('urlCopiedToClipboard') });
      }
    }
  };

  return (
    <ShareButtonView
      label={tCommonActions('share')}
      onShare={handleShare}
      size={size}
      iconSize={iconSize}
      minTouchSize={minTouchSize}
    />
  );
}
