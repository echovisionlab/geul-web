import { describe, expect, it } from 'vitest';
import arRawMessages from '@/messages/ar.json';
import deRawMessages from '@/messages/de.json';
import enRawMessages from '@/messages/en.json';
import esRawMessages from '@/messages/es.json';
import es419RawMessages from '@/messages/es-419.json';
import frRawMessages from '@/messages/fr.json';
import idRawMessages from '@/messages/id.json';
import itRawMessages from '@/messages/it.json';
import jaRawMessages from '@/messages/ja.json';
import koRawMessages from '@/messages/ko.json';
import nlRawMessages from '@/messages/nl.json';
import plRawMessages from '@/messages/pl.json';
import ptBRRawMessages from '@/messages/pt-BR.json';
import ptPTRawMessages from '@/messages/pt-PT.json';
import ruRawMessages from '@/messages/ru.json';
import thRawMessages from '@/messages/th.json';
import trRawMessages from '@/messages/tr.json';
import viRawMessages from '@/messages/vi.json';
import zhCNRawMessages from '@/messages/zh-CN.json';
import zhTWRawMessages from '@/messages/zh-TW.json';
import { SUPPORTED_LOCALES } from './locale';
import { getMessagesForLocale } from './messages';

const RAW_LOCALE_MESSAGES = {
  en: enRawMessages,
  ko: koRawMessages,
  ja: jaRawMessages,
  'zh-CN': zhCNRawMessages,
  'zh-TW': zhTWRawMessages,
  es: esRawMessages,
  'es-419': es419RawMessages,
  fr: frRawMessages,
  de: deRawMessages,
  'pt-BR': ptBRRawMessages,
  'pt-PT': ptPTRawMessages,
  it: itRawMessages,
  nl: nlRawMessages,
  ar: arRawMessages,
  id: idRawMessages,
  vi: viRawMessages,
  th: thRawMessages,
  tr: trRawMessages,
  pl: plRawMessages,
  ru: ruRawMessages,
} as const;

const RAW_FILE_DOWNLOAD_MESSAGES = {
  en: enRawMessages.fileDownloadAccess,
  ko: koRawMessages.fileDownloadAccess,
  ja: jaRawMessages.fileDownloadAccess,
  'zh-CN': zhCNRawMessages.fileDownloadAccess,
  'zh-TW': zhTWRawMessages.fileDownloadAccess,
  es: esRawMessages.fileDownloadAccess,
  'es-419': es419RawMessages.fileDownloadAccess,
  fr: frRawMessages.fileDownloadAccess,
  de: deRawMessages.fileDownloadAccess,
  'pt-BR': ptBRRawMessages.fileDownloadAccess,
  'pt-PT': ptPTRawMessages.fileDownloadAccess,
  it: itRawMessages.fileDownloadAccess,
  nl: nlRawMessages.fileDownloadAccess,
  ar: arRawMessages.fileDownloadAccess,
  id: idRawMessages.fileDownloadAccess,
  vi: viRawMessages.fileDownloadAccess,
  th: thRawMessages.fileDownloadAccess,
  tr: trRawMessages.fileDownloadAccess,
  pl: plRawMessages.fileDownloadAccess,
  ru: ruRawMessages.fileDownloadAccess,
} as const;

// Add only genuinely language-invariant copy here, with a reviewer-visible locale and key.
const FILE_DOWNLOAD_ENGLISH_EQUIVALENCE_ALLOWLIST = new Set<string>();
const AUTH_AND_MAIL_TRANSLATION_ROOTS = [
  'auth.common.codeTiming',
  'auth.login.passkey',
  'auth.login.passkeyUnavailable',
  'auth.login.emailCode',
  'auth.login.code',
  'auth.login.accountLinking',
  'auth.login.newsletterIntent',
  'auth.login.errors.rateLimited',
  'auth.verification.sentEmail.resend',
  'security.passkeys',
  'security.personalAccessTokens',
  'security.notifications.failedToUpdateMainEmail',
  'adminList.emailTemplates',
  'adminList.emailLayouts',
] as const;
const CONTENT_TRANSLATION_ROOTS = [
  'editorMetadata.pageEdit',
  'editorCommon.editor.slashMenu.items.externalVideo',
  'editorCommon.externalVideoInsert',
  'pageShareAccess',
  'releaseShareAccess',
  'pageEditor.externalVideo',
] as const;
const EDITOR_FILE_INGEST_TRANSLATION_KEYS = [
  'backToUpload',
  'openLibrary',
  'unifiedDescription',
  'emptyTitle',
  'emptyDescription',
  'selectFile',
] as const;

function collectStringEntries(
  value: unknown,
  path: string[] = [],
  out: Array<[string, string]> = [],
): Array<[string, string]> {
  if (typeof value === 'string') {
    out.push([path.join('.'), value]);
    return out;
  }

  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const [key, child] of Object.entries(value)) {
      collectStringEntries(child, path.concat(key), out);
    }
  }

  return out;
}

function collectPlaceholders(message: string): string[] {
  const placeholders: string[] = [];
  let depth = 0;

  for (let index = 0; index < message.length; index += 1) {
    const char = message[index];

    if (char === '{') {
      depth += 1;

      let cursor = index + 1;
      let token = '';
      while (cursor < message.length) {
        const next = message[cursor];
        if (next === ',' || next === '}') {
          break;
        }
        token += next;
        cursor += 1;
      }

      const normalizedToken = token.trim();
      if (depth === 1 && /^[a-zA-Z0-9_]+$/.test(normalizedToken)) {
        placeholders.push(normalizedToken);
      }

      index = cursor - 1;
      continue;
    }

    if (char === '}') {
      depth = Math.max(0, depth - 1);
    }
  }

  return placeholders;
}

function collectPlaceholderSet(message: string): string {
  return [...new Set(collectPlaceholders(message))].sort().join('|');
}

function collectNumberArgumentSet(message: string): string {
  return [...message.matchAll(/\{([a-zA-Z0-9_]+),\s*number\}/g)]
    .map((match) => match[1])
    .sort()
    .join('|');
}

function getMessagePath(value: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((current, segment) => {
    if (!current || typeof current !== 'object' || Array.isArray(current)) {
      return undefined;
    }
    return (current as Record<string, unknown>)[segment];
  }, value);
}

describe('getMessagesForLocale', () => {
  it('loads locale overrides when available', async () => {
    const messages = await getMessagesForLocale('ko');

    expect(messages.common.labels.settings).toBe('설정');
    expect(messages.settings.languagePreference.label).toBe('선호 언어');
    expect(messages.common.labels.security).toBe('보안');
    expect(messages.security.sessions.title).toBe('활성 세션');
    expect(messages.common.entities.posts).toBe('포스트');
    expect(messages.common.labels.versionHistory).toBe('버전 기록');
    expect(messages.shareLinks.title).toBe('공유 링크');
    expect(messages.shareLinks.presets.never).toBe('기한 없음');
    expect(messages.auth.login.title).toBe('로그인');
    expect(messages.auth.login.emailCode).toBe('이메일로 계속');
    expect(messages.auth.verification.sentEmail.resend).toBe('새 코드 보내기');
    expect(messages.auth.metadata.routes.cancelDeletion.description).toBe('{siteName} 계정 삭제를 취소합니다');
    expect(messages.common.actions.confirm).toBe('확인');
    expect(messages.common.actions.logIn).toBe('로그인');
    expect(messages.common.actions.tryAgain).toBe('다시 시도');
    expect(messages.common.actions.setAsDefault).toBe('기본값으로 설정');
    expect(messages.common.actions.backToLogin).toBe('로그인으로 돌아가기');
    expect(messages.common.actions.share).toBe('공유');
    expect(messages.common.actions.print).toBe('인쇄');
    expect(messages.common.actions.markdown).toBe('마크다운');
    expect(messages.common.actions.continue).toBe('계속');
    expect(messages.common.states.loading).toBe('불러오는 중...');
    expect(messages.common.states.generating).toBe('생성 중...');
    expect(messages.common.states.anonymous).toBe('익명');
    expect(messages.common.labels.created).toBe('생성일');
    expect(messages.common.labels.updated).toBe('수정일');
    expect(messages.common.labels.collaborators).toBe('협업자');
    expect(messages.common.labels.dashboard).toBe('대시보드');
    expect(messages.common.labels.account).toBe('계정');
    expect(messages.common.labels.profile).toBe('프로필');
    expect(messages.common.labels.authors).toBe('작성자');
    expect(messages.common.labels.members).toBe('멤버');
    expect(messages.common.labels.fields).toBe('필드');
    expect(messages.common.labels.lastUpdated).toBe('마지막 업데이트');
    expect(messages.common.labels.body).toBe('본문');
    expect(messages.common.entities.series).toBe('시리즈');
    expect(messages.common.labels.createdBy).toBe('생성자');
    expect(messages.common.labels.updatedBy).toBe('수정자');
    expect(messages.common.labels.location).toBe('위치');
    expect(messages.common.labels.coordinates).toBe('좌표');
    expect(messages.common.labels.id).toBe('ID');
    expect(messages.common.labels.latitude).toBe('위도');
    expect(messages.common.labels.longitude).toBe('경도');
    expect(messages.common.labels.required).toBe('필수');
    expect(messages.shell.actions.cookieSettings).toBe('쿠키 설정');
    expect(messages.common.actions.toggleColorScheme).toBe('색상 테마 전환');
    expect(messages.adminShell.subtitle).toBe('관리 패널');
    expect(messages.adminShell.sections.content).toBe('콘텐츠');
    expect(messages.common.entities.mapThemes).toBe('지도 테마');
    expect(messages.auth.login.newsletterIntent.applying).toBe('뉴스레터 구독을 설정하고 있습니다...');
    expect(messages.common.actions.unsubscribe).toBe('구독 해지');
    expect(messages.unsubscribe.token.success.title).toBe('구독이 해지되었습니다.');
    expect(messages.featuredImage.label).toBe('대표 이미지');
    expect(messages.artistPage.sections.biography).toBe('소개');
    expect(messages.artistPage.works.loadMore).toBe('더 보기 (남은 {count}개)');
    expect(messages.placeEditor.placeDetails).toBe('장소 상세');
    expect(messages.common.actions.reply).toBe('답글');
    expect(messages.common.providers.google).toBe('Google');
    expect(messages.comments.section.title).toBe('댓글');
    expect(messages.workView.details.period).toBe('기간');
    expect(messages.common.entities.terms).toBe('이용약관');
    expect(messages.common.statuses.archived).toBe('보관됨');
    expect(messages.common.entities.tracks).toBe('트랙');
    expect(messages.legalHistoryCommon.actions.newVersion).toBe('새 버전');
    expect(messages.contentMetadata.preview.post).toBe('포스트 미리보기');
    expect(messages.editorMetadata.workEdit.title).toBe('작업물 편집');
    expect(messages.cookieConsentBanner.actions.customize).toBe('사용자 지정');
    expect(messages.publicForm.navigation.submit).toBe('제출');
    expect(messages.formPasswordPage.title).toBe('비밀번호 보호');
    expect(messages.formDashboardPage.states.invalidLink).toBe('유효하지 않은 대시보드 링크입니다');
    expect(messages.common.actions.continue).toBe('계속');
    expect(messages.formAdmin.navigation.tabs.builder).toBe('빌더');
    expect(messages.formAdmin.submissions.deleteModal.title).toBe('제출 삭제');
    expect(messages.common.actions.insertVariable).toBe('변수 삽입');
    expect(messages.common.actions.openInNewTab).toBe('새 탭에서 열기');
    expect(messages.common.labels.lastManualEdit).toBe('마지막 수동 수정');
    expect(messages.common.messages.noUpdateRecorded).toBe('업데이트 기록 없음');
    expect(messages.common.messages.formSubmittedSuccessfully).toBe('응답이 성공적으로 제출되었습니다.');
    expect(messages.common.messages.userDate).toBe('{user} · {date}');
    expect(messages.common.notifications.featuredImageUpdated).toBe('대표 이미지를 업데이트했습니다');
    expect(messages.common.notifications.featuredImageRemoved).toBe('대표 이미지를 제거했습니다');
    expect(messages.common.notifications.saveSuccess).toBe('저장했습니다');
    expect(messages.common.notifications.saveFailed).toBe('저장에 실패했습니다');
    expect(messages.common.notifications.seriesCreated).toBe('시리즈를 만들었습니다');
    expect(messages.common.notifications.memberAdded).toBe('멤버를 추가했습니다');
    expect(messages.common.notifications.memberRemoved).toBe('멤버를 제거했습니다');
    expect(messages.common.notifications.tagDeleted).toBe('태그를 삭제했습니다');
    expect(messages.common.errors.passwordMismatch).toBe('비밀번호가 일치하지 않습니다');
    expect(messages.common.errors.nameRequired).toBe('이름은 필수입니다');
    expect(messages.common.states.loadingPreview).toBe('미리보기를 불러오는 중...');
    expect(messages.common.placeholders.emailExample).toBe('your@email.com');
    expect(messages.common.placeholders.enterEmailAddress).toBe('이메일 주소를 입력하세요');
    expect(messages.common.placeholders.exampleUrl).toBe('https://example.com');
    expect(messages.common.placeholders.selectDateAndTime).toBe('날짜와 시간을 선택하세요');
    expect(messages.common.placeholders.selectValues).toBe('값 선택...');
    expect(messages.common.placeholders.website).toBe('https://...');
    expect(messages.common.actions.sendTest).toBe('테스트 발송');
    expect(messages.common.actions.sendTestEmail).toBe('테스트 이메일 발송');
    expect(messages.common.notifications.testEmailSent).toBe('테스트 이메일을 보냈습니다');
    expect(messages.common.states.noSubject).toBe('(제목 없음)');
    expect(messages.common.labels.language).toBe('언어');
    expect(messages.common.labels.siteOrigin).toBe('사이트 오리진');
    expect(messages.common.labels.managers).toBe('관리자');
    expect(messages.common.labels.ogImage).toBe('OG 이미지');
    expect(messages.urlSection.fields.publicUrl).toBe('공개 URL');
    expect(messages.common.labels.time).toBe('시간');
    expect(messages.common.labels.social).toBe('소셜');
    expect(messages.adminList.emailTemplates.detail.variables.catalog.name).toBe('이름');
    expect(messages.adminList.emailTemplates.detail.variables.catalog.unsubscribe_link).toBe('구독 해지 링크');
    expect(messages.campaignEditor.actions.sendNow).toBe('지금 발송');
    expect(messages.campaignEditor.fields.recipientScope).toBe('수신자');
    expect(messages.campaignEditor.fields.recipientScopeAllMatchingUsers).toBe('조건에 맞는 모든 사용자');
    expect(messages.campaignEditor.scheduleModal.dateLabel).toBe('예약 발송 일시');
    expect(messages.campaignAnalytics.title).toBe('캠페인 분석');
    expect(messages.common.labels.details).toBe('상세');
    expect(messages.campaignAnalytics.recipientStatuses.sent).toBe('발송됨');
    expect(messages.common.actions.regenerateHtml).toBe('HTML 다시 생성');
    expect(messages.common.labels.source).toBe('원문');
    expect(messages.common.messages.scheduleActivationTitle).toBe('적용 예약');
    expect(messages.common.actions.regenerateHtml).toBe('HTML 다시 생성');
    expect(messages.common.labels.source).toBe('원문');
    expect(messages.common.labels.locale).toBe('언어');
    expect(messages.common.entities.translations).toBe('번역');
    expect(messages.translationPanel.sourceLocale.label).toBe('원문 언어');
    expect(messages.translationPanel.actions.expand).toBe('펼치기');
    expect(messages.translationPanel.actions.regenerateAll).toBe('모든 대상 생성/재생성');
    expect(messages.translationPanel.statuses.existing).toBe('기존');
    expect(messages.localizationNotice.translated.title).toBe('번역본');
    expect(messages.localizationNotice.actions.viewOriginal).toBe('원문 보기 ({source})');
    expect(messages.contentLanguageMenu.label).toBe('번역 보기');
    expect(messages.userProfile.modals.ban.description).toBe('정지 대상: <strong>{name}</strong>');
    expect(messages.userProfile.modals.delete.title).toBe('사용자 삭제');
    expect(messages.common.entities.translations).toBe('번역');
    expect(messages.translationOverviewPage.actions.openSettings).toBe('설정 열기');
    expect(messages.translationJobsPage.title).toBe('번역 작업');
    expect(messages.common.labels.settings).toBe('설정');
    expect(messages.common.labels.priority).toBe('우선순위');
    expect(messages.translationSettingsPage.title).toBe('번역 설정');
    expect('machineGeneratedPublicServe' in messages.translationSettingsPage.fields).toBe(false);
    expect(messages.common.statuses.running).toBe('실행 중');
    expect(messages.common.statuses.inProgress).toBe('진행 중');
    expect(messages.common.statuses.default).toBe('기본값');
    expect(messages.common.statuses.custom).toBe('사용자 설정');
    expect(messages.translationJobsPage.stats.active).toBe('진행 중 {count}개');
    expect(messages.translationPanel.actions.generateLocale).toBe('생성');
    expect(messages.pageEditor.externalVideo.aspectRatioAuto).toBe('자동');
    expect(messages.editorCommon.editor.slashMenu.items.externalVideo.title).toBe('외부 영상');
    expect(messages.editorCommon.externalVideoInsert.insert).toBe('외부 영상 삽입');
    expect(messages.editorCommon.media.ingestDialog.importFromUrl).toBe('URL에서 가져오기');
    expect(messages.editorCommon.media.ingestDialog.directVideoUrlHelp).toBe(
      '직접 영상 파일 URL만 사용할 수 있습니다. YouTube 또는 Vimeo는 외부 영상을 사용하세요.',
    );
  });

  it('falls back to English for keys outside locale seed coverage', async () => {
    const messages = await getMessagesForLocale('sv-SE');

    expect(messages.notFoundPage.title).toBe('Page not found');
    expect(messages.locationSelector.placeholder).toBe('Select location...');
    expect(messages.postHeader.actions.exportMarkdown).toBe('Export post as Markdown');
    expect(messages.urlSection.fields.publicUrl).toBe('Public URL');
    expect(messages.phoneInput.noResults).toBe('No results');
  });

  it('loads Japanese locale overrides when a seeded bundle is available', async () => {
    const messages = await getMessagesForLocale('ja');

    expect(messages.common.labels.settings).toBe('設定');
    expect(messages.settings.languagePreference.save).toBe('言語を保存');
    expect(messages.common.labels.profile).toBe('プロフィール');
    expect(messages.common.labels.security).toBe('セキュリティ');
    expect(messages.auth.login.title).toBe('ログイン');
    expect(messages.auth.confirmRecovery.actions.goToLogin).toBe('ログインへ移動');
    expect(messages.common.actions.tryAgain).toBe('再試行');
    expect(messages.shell.actions.cookieSettings).toBe('Cookie設定');
    expect(messages.auth.login.newsletterIntent.applying).toBe('ニュースレター購読を設定しています...');
    expect(messages.unsubscribe.token.error.title).toBe('購読を解除できません');
    expect(messages.campaignEditor.actions.sendNow).toBe('今すぐ送信');
    expect(messages.campaignAnalytics.title).toBe('キャンペーン分析');
    expect(messages.translationJobsPage.title).toBe('翻訳ジョブ');
    expect(messages.translationSettingsPage.title).toBe('翻訳設定');
    expect(messages.translationPanel.actions.regenerateAll).toBe('Generate/regenerate all eligible locales');
    expect(messages.adminList.emailTemplates.detail.fields.layoutLabel).toBe('レイアウト');
    expect(messages.contentLanguageMenu.label).toBe('翻訳を表示');

    expect(messages.notFoundPage.title).toBe('ページが見つかりません');
    expect(messages.locationSelector.placeholder).toBe('場所を選択...');
    expect(messages.postHeader.actions.exportMarkdown).toBe('投稿を Markdown として書き出し');
    expect(messages.urlSection.fields.publicUrl).toBe('公開 URL');
    expect(messages.phoneInput.noResults).toBe('結果がありません');
  });

  it('loads every supported locale without throwing', async () => {
    const localizedValues = await Promise.all(
      SUPPORTED_LOCALES.map(async (locale) => {
        const messages = await getMessagesForLocale(locale);
        return {
          settings: messages.common.labels.settings,
          importFromUrl: messages.editorCommon.media.ingestDialog.importFromUrl,
          directVideoUrlHelp: messages.editorCommon.media.ingestDialog.directVideoUrlHelp,
        };
      }),
    );

    expect(localizedValues.map(({ settings }) => settings)).toEqual([
      'Settings',
      '설정',
      '設定',
      '设置',
      '設定',
      'Ajustes',
      'Ajustes',
      'Paramètres',
      'Einstellungen',
      'Configurações',
      'Configurações',
      'Impostazioni',
      'Instellingen',
      'الإعدادات',
      'Pengaturan',
      'Cài đặt',
      'การตั้งค่า',
      'Ayarlar',
      'Ustawienia',
      'Настройки',
    ]);
    expect(localizedValues.map(({ importFromUrl }) => importFromUrl)).toEqual([
      'Import from URL',
      'URL에서 가져오기',
      'URLからインポート',
      '从 URL 导入',
      '從 URL 匯入',
      'Importar desde URL',
      'Importar desde URL',
      'Importer depuis une URL',
      'Von URL importieren',
      'Importar pela URL',
      'Importar do URL',
      'Importa da URL',
      'Importeren via URL',
      'استيراد من رابط',
      'Impor dari URL',
      'Nhập từ URL',
      'นำเข้าจาก URL',
      "URL'den içe aktar",
      'Importuj z adresu URL',
      'Импортировать из URL-адреса',
    ]);
    expect(
      localizedValues.filter(
        ({ directVideoUrlHelp }) =>
          directVideoUrlHelp === 'Direct video file URLs only. For YouTube or Vimeo, use External video.',
      ),
    ).toHaveLength(1);
    for (const { directVideoUrlHelp } of localizedValues) {
      expect(directVideoUrlHelp).toContain('YouTube');
      expect(directVideoUrlHelp).toContain('Vimeo');
    }
  });

  it('keeps the map slash-menu description provider-neutral in every supported locale', async () => {
    const providerName = /google|maplibre|apple maps|naver|kakao/i;

    for (const locale of SUPPORTED_LOCALES) {
      const messages = await getMessagesForLocale(locale);

      expect(messages.editorCommon.editor.slashMenu.items.map.subtext, locale).not.toMatch(providerName);
    }
  });

  it('preserves English placeholder sets across every supported locale', () => {
    const englishValues = new Map(collectStringEntries(RAW_LOCALE_MESSAGES.en));
    const englishPlaceholders = new Map([...englishValues].map(([key, value]) => [key, collectPlaceholderSet(value)]));

    for (const locale of SUPPORTED_LOCALES.filter((candidate) => candidate !== 'en')) {
      for (const [key, value] of collectStringEntries(RAW_LOCALE_MESSAGES[locale])) {
        const englishPlaceholderSet = englishPlaceholders.get(key);

        if (englishPlaceholderSet === undefined) {
          continue;
        }

        expect(collectPlaceholderSet(value), `${locale}:${key}`).toBe(englishPlaceholderSet);
        expect(collectNumberArgumentSet(value), `${locale}:${key} number arguments`).toBe(
          collectNumberArgumentSet(englishValues.get(key)!),
        );
      }
    }
  });

  it('keeps authentication and automatic-mail copy complete in every raw locale bundle', () => {
    for (const root of AUTH_AND_MAIL_TRANSLATION_ROOTS) {
      const englishEntries = collectStringEntries(getMessagePath(RAW_LOCALE_MESSAGES.en, root));
      const englishByKey = new Map(englishEntries);
      const englishKeys = englishEntries.map(([key]) => key).sort();

      expect(englishKeys.length, `en:${root} inventory`).toBeGreaterThan(0);
      for (const locale of SUPPORTED_LOCALES.filter((candidate) => candidate !== 'en')) {
        const localizedEntries = collectStringEntries(getMessagePath(RAW_LOCALE_MESSAGES[locale], root));
        expect(localizedEntries.map(([key]) => key).sort(), `${locale}:${root} inventory`).toEqual(englishKeys);

        for (const [key, value] of localizedEntries) {
          const englishValue = englishByKey.get(key);
          expect(englishValue, `${locale}:${root}.${key} English source`).toBeDefined();
          expect(collectPlaceholderSet(value), `${locale}:${root}.${key} placeholders`).toBe(
            collectPlaceholderSet(englishValue!),
          );
        }
      }
    }
  });

  it('keeps every file-download leaf translated in each raw locale bundle', () => {
    const englishEntries = collectStringEntries(RAW_FILE_DOWNLOAD_MESSAGES.en);
    const englishByKey = new Map(englishEntries);
    const englishKeys = englishEntries.map(([key]) => key).sort();

    for (const locale of SUPPORTED_LOCALES.filter((candidate) => candidate !== 'en')) {
      const localizedEntries = collectStringEntries(RAW_FILE_DOWNLOAD_MESSAGES[locale]);
      const localizedKeys = localizedEntries.map(([key]) => key).sort();

      expect(localizedKeys, `${locale}:fileDownloadAccess inventory`).toEqual(englishKeys);
      for (const [key, value] of localizedEntries) {
        const englishValue = englishByKey.get(key);
        expect(englishValue, `${locale}:${key} English source`).toBeDefined();
        if (!FILE_DOWNLOAD_ENGLISH_EQUIVALENCE_ALLOWLIST.has(`${locale}:${key}`)) {
          expect(value, `${locale}:${key} must not retain English copy`).not.toBe(englishValue);
        }
        expect(collectPlaceholderSet(value), `${locale}:${key} placeholders`).toBe(
          collectPlaceholderSet(englishValue!),
        );
      }
    }
  });

  it('keeps editor file-ingest copy translated in every raw locale bundle', () => {
    const root = 'editorCommon.media.ingestDialog';

    for (const locale of SUPPORTED_LOCALES.filter((candidate) => candidate !== 'en')) {
      for (const key of EDITOR_FILE_INGEST_TRANSLATION_KEYS) {
        const englishValue = getMessagePath(RAW_LOCALE_MESSAGES.en, `${root}.${key}`);
        const localizedValue = getMessagePath(RAW_LOCALE_MESSAGES[locale], `${root}.${key}`);

        expect(localizedValue, `${locale}:${root}.${key}`).toEqual(expect.any(String));
        expect(localizedValue, `${locale}:${root}.${key} must not retain English copy`).not.toBe(englishValue);
      }
    }
  });

  it('keeps every Post participant leaf present in each raw locale bundle', () => {
    const englishEntries = collectStringEntries(RAW_LOCALE_MESSAGES.en.postParticipants);
    const englishByKey = new Map(englishEntries);
    const englishKeys = englishEntries.map(([key]) => key).sort();

    for (const locale of SUPPORTED_LOCALES.filter((candidate) => candidate !== 'en')) {
      const localizedEntries = collectStringEntries(getMessagePath(RAW_LOCALE_MESSAGES[locale], 'postParticipants'));

      expect(localizedEntries.map(([key]) => key).sort(), `${locale}:postParticipants inventory`).toEqual(englishKeys);
      for (const [key, value] of localizedEntries) {
        const englishValue = englishByKey.get(key);
        expect(englishValue, `${locale}:postParticipants.${key} English source`).toBeDefined();
        expect(collectPlaceholderSet(value), `${locale}:postParticipants.${key} placeholders`).toBe(
          collectPlaceholderSet(englishValue!),
        );
      }
    }
  });

  it('keeps content editor, share access, and external-video copy complete in every raw locale bundle', () => {
    for (const root of CONTENT_TRANSLATION_ROOTS) {
      const englishEntries = collectStringEntries(getMessagePath(RAW_LOCALE_MESSAGES.en, root));
      const englishByKey = new Map(englishEntries);
      const englishKeys = englishEntries.map(([key]) => key).sort();

      expect(englishKeys.length, `en:${root} inventory`).toBeGreaterThan(0);
      for (const locale of SUPPORTED_LOCALES.filter((candidate) => candidate !== 'en')) {
        const localizedEntries = collectStringEntries(getMessagePath(RAW_LOCALE_MESSAGES[locale], root));
        expect(localizedEntries.map(([key]) => key).sort(), `${locale}:${root} inventory`).toEqual(englishKeys);

        for (const [key, value] of localizedEntries) {
          const englishValue = englishByKey.get(key);
          expect(englishValue, `${locale}:${root}.${key} English source`).toBeDefined();
          expect(collectPlaceholderSet(value), `${locale}:${root}.${key} placeholders`).toBe(
            collectPlaceholderSet(englishValue!),
          );
        }
      }
    }

    for (const locale of SUPPORTED_LOCALES.filter((candidate) => candidate !== 'en')) {
      expect(
        getMessagePath(RAW_LOCALE_MESSAGES[locale], 'pageEditor.sectionTypes.externalVideo'),
        `${locale}:pageEditor.sectionTypes.externalVideo`,
      ).toEqual(expect.any(String));
    }
  });

  it('keeps every missing-media fallback present in each raw locale bundle', () => {
    const root = 'mediaCommon.missing';
    const englishEntries = collectStringEntries(getMessagePath(RAW_LOCALE_MESSAGES.en, root));
    const englishKeys = englishEntries.map(([key]) => key).sort();

    expect(englishKeys).toEqual(['audioDeleted', 'fileDeleted', 'imageDeleted', 'videoDeleted']);
    for (const locale of SUPPORTED_LOCALES.filter((candidate) => candidate !== 'en')) {
      const localizedEntries = collectStringEntries(getMessagePath(RAW_LOCALE_MESSAGES[locale], root));
      expect(localizedEntries.map(([key]) => key).sort(), `${locale}:${root} inventory`).toEqual(englishKeys);
    }
  });

  it('does not contain machine placeholder artifacts in any supported locale', async () => {
    for (const locale of SUPPORTED_LOCALES) {
      const messages = await getMessagesForLocale(locale);

      for (const [key, value] of collectStringEntries(messages)) {
        expect(value, `${locale}:${key}`).not.toMatch(/__P\d+__/);
      }
    }
  });
});
