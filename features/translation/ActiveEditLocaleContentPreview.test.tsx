// @vitest-environment jsdom

import { expect, it } from 'vitest';
import { render, screen } from '@/test/render';
import koMessages from '@/messages/ko.json';
import { ActiveEditLocaleContentPreview } from './ActiveEditLocaleContentPreview';

it('labels the read-only locale preview and preserves custom rendering', () => {
  render(
    <ActiveEditLocaleContentPreview localeLabel="한국어" hasLiveRow contentPreview="translated preview">
      <div>editor body</div>
    </ActiveEditLocaleContentPreview>,
    { locale: 'ko', messages: koMessages },
  );
  const preview = screen.getByRole('group', { name: '한국어 본문 미리보기' });
  expect(preview).toHaveAccessibleDescription('기존 번역 문서를 구조와 서식을 유지한 채 표시합니다.');
  expect(preview).toHaveAttribute('aria-busy', 'false');
  expect(screen.getByText('editor body')).toBeVisible();
});

it('shows the shared loader during locale preparation and distinguishes a resolved empty preview', () => {
  const { rerender } = render(
    <ActiveEditLocaleContentPreview localeLabel="English" hasLiveRow contentPreview="old preview" loading />,
    { locale: 'ko', messages: koMessages },
  );
  expect(screen.getByRole('group')).toHaveAttribute('aria-busy', 'true');
  expect(screen.getByRole('status')).toHaveTextContent(koMessages.translationPanel.activeEditLocale.loading);
  expect(screen.queryByText('old preview')).not.toBeInTheDocument();
  rerender(<ActiveEditLocaleContentPreview localeLabel="English" hasLiveRow contentPreview="" />);
  expect(screen.getByRole('group')).toHaveAttribute('aria-busy', 'false');
  expect(screen.getByRole('status')).toHaveTextContent(koMessages.translationPanel.activeEditLocale.bodyPreviewEmpty);
});
