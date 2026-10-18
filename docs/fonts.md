# Geul 자체 호스팅 폰트

Noto를 유일한 폰트 시스템으로 사용한다. 소유 파일은 `scripts/fonts/fonts.config.mjs`, `scripts/fonts/`, `lib/styles/font-assignment.css`다. 앱과 Storybook은 같은 Geul family와 해시 stylesheet 매핑을 소비한다. 산출물은 Cloudflare R2의 `static.rawsector.com/fonts/`에서 제공한다.

## 재빌드와 검증

저장소 루트에서 설치된 Node·pnpm을 사용한다.

```sh
pnpm fonts:build
pnpm fonts:test
pnpm fonts:check
pnpm fonts:lint
pnpm exec vitest run lib/styles/font-stylesheet.test.ts lib/public-runtime-config.test.ts lib/public-runtime-config.server.test.ts .storybook/document-locale.test.ts
pnpm design-system:generate
pnpm design-system:check
```

- `fonts:build`는 필요한 원본을 모두 검증한 뒤 `.artifacts/fonts/dist`를 교체한다. 출력은 `.artifacts/fonts/dist/fonts/` 한 곳이다.
- `fonts:build --only sans,mono`는 부분 개발 빌드다. manifest의 `complete`가 `false`이며 `fonts:check`는 이를 거부한다. 앱의 생성 매핑도 갱신하지 않는다. 배포 전에는 전체 빌드를 다시 실행한다.
- 원본은 검증된 `.artifacts/fonts/cache/<id>/source.ttf`를 우선 사용한다. 캐시가 없으면 config의 `localFile`을 `.artifacts/fonts/sources/` 아래에서 찾고, 로컬 복사본도 없으면 고정 URL에서 다운로드한다. 모든 경로에서 SHA-256을 검사한다. 해시가 다르면 실패하며 다른 경로로 우회하지 않는다.
- `fonts:check`는 파일 해시·cmap, family/weight별 중복, 프로필·소스 누락, CSS와 manifest의 범위·weight, 가변 weight 축, Arabic·Thai shaping과 앱 생성 매핑의 최신성을 검사한다. 결과는 `.artifacts/fonts/review/checks.json`에 기록한다.
- `fonts:ranges`는 Google Fonts CSS API에서 경계를 다시 가져와 `unicode-ranges.json`을 바꾸는 수동 유지보수 명령이다. 이번 변경은 기존 경계 값을 유지하고 참조 키만 Noto 이름으로 정리했다. 재수집은 경계를 변경하므로 별도로 검토한다. 일반 빌드는 이 API에 접속하지 않는다.

`fonts:lint`는 루트 ESLint에서 제외되는 Node ESM 스크립트를 전용 설정으로 검사한다. 웹 전체 빌드는 필요하지 않다. 기존 `lib/assets/fonts`의 TTF는 OG 이미지 생성용으로 유지하며 Storybook에서는 사용하지 않는다.

## 산출물과 프로필

`.artifacts/fonts/dist/fonts/`는 다음 파일을 제공한다.

- `<family-slug>/<sha256 앞 16자리>.woff2`: 물리 슬라이스 파일.
- `geul-<profile>.<hash>.css`: 프로필 전체의 `@font-face` 선언. URL은 CSS 위치 기준 상대 경로다.
- `manifest.json`: 전체/부분 빌드 여부, 프로필별 CSS 파일명·원본/Brotli 바이트, family 스택과 파일별 weight·범위·바이트 수.
- `sources.json`, `licenses/`: 실제 사용한 고정 원본 정보와 저작권 고지·OFL 본문.

전체 빌드는 버전 관리 대상인 `lib/styles/geul-fonts.generated.ts`도 생성한다. stylesheet 해시가 바뀌면 이 모듈과 해당 산출물을 함께 배포한다. 프로필당 CSS 한 장을 로드하며 `base`와 다른 프로필을 겹쳐 로드하지 않는다.

| LocaleFontProfile     | 출력 프로필 | Sans 스택                                 |
| --------------------- | ----------- | ----------------------------------------- |
| `latin`, `arabic`     | `base`      | Geul Sans → Geul Emoji                    |
| `korean`              | `ko`        | Geul Sans → Geul Sans Han TC → Geul Emoji |
| `japanese`            | `ja`        | Geul Sans → Geul Sans Han JP → Geul Emoji |
| `chinese-simplified`  | `zh-hans`   | Geul Sans → Geul Sans Han SC → Geul Emoji |
| `chinese-traditional` | `zh-hant`   | Geul Sans → Geul Sans Han TC → Geul Emoji |

Sans 끝에는 `sans-serif` fallback을 둔다. Mono는 Geul Mono → Geul Sans → 기존 시스템 monospace fallback → Geul Emoji → `monospace`다. Noto Sans Mono를 사용한다.

Geul Sans는 Noto Sans(Latin·Cyrillic·Greek·Vietnamese), Arabic, Thai, KR(non-Han), JP(non-Han) 순서로 문자를 배정한다. 실제 제공 범위는 고정 경계 템플릿, 원본 cmap, 앞선 소스의 소유 범위와 Han 필터로 결정된다. 같은 family·weight의 한 코드 포인트는 한 slice만 소유한다. Han JP/SC/TC는 형태 차이를 보존하려고 별도 family로 둔다. 한국어 Hanja는 TC를 사용한다. KR의 U+301A–301B는 보충 slice로 제공한다.

동일 family의 composite face가 단일 weight로 매칭되도록 variable 원본도 `font-weight: 400`, `500`, `600`의 규칙 세 개로 선언한다. 각 규칙은 같은 variable WOFF2 URL을 가리킨다. `wdth,wght` 원본은 width 100으로 고정하고 weight 400–600만 남긴다. 현재 normal 400/500/600을 제공하며 italic과 다른 weight는 지원 범위가 아니다. Emoji는 400만 제공한다.

## 앱과 Storybook 연결 및 마이그레이션

`lib/styles/font-stylesheet.ts`는 생성 매핑의 정확한 파일명을 폰트 base URL에 붙인다. 기존 Google Fonts 프록시 쿼리를 생성하던 경로를 교체했다. `PUBLIC_FONT_BASE_URL`의 기본값은 `https://static.rawsector.com/fonts`다. 경로를 포함한 전체 base를 지정하며 마지막 `/`는 정규화한다. 기존 자산용 `PUBLIC_CDN_URL`과 별개다.

기존 public runtime config 방식에 따라 서버가 URL을 검증하고 `<html data-geul-font-base-url>`로 전달한다. 브라우저는 `getPublicFontBaseUrl()`로 읽는다. root layout은 해당 호스트 origin으로 preconnect하고 locale별 CSS를 로드한다. 별도 font preload는 추가하지 않았다.

Storybook을 시작할 때 완전한 로컬 manifest와 생성 매핑의 CSS 파일이 모두 있으면 dist/fonts를 `/fonts`로 제공한다. 산출물이 없거나 부분 빌드·오래된 매핑이면 `PUBLIC_FONT_BASE_URL` 또는 기본 정적 호스트를 사용한다. 따라서 CI는 로컬 산출물 없이 구성할 수 있지만 실제 폰트 표시에는 정적 호스트 업로드가 필요하다. locale 소유권 전환과 함께 같은 stylesheet link를 교체하고 마지막 소유자가 해제되면 원래 URL을 복원한다. 로컬 빌드 후에는 Storybook을 재시작한다.

소비자는 Core·theme의 기존 `--font-family-sans`와 `--font-mono`를 계속 사용한다. Feature나 페이지에서 family를 덮어쓰지 않는다. 이전 프록시의 동적 family 쿼리에 의존하는 웹 배포는 먼저 아래 업로드를 완료한 뒤 이 매핑을 포함한 앱으로 전환한다.

## 원본과 라이선스

모든 원본은 OFL 1.1이다. Noto Sans / KR / JP / SC / TC / Arabic / Thai / Sans Mono / Color Emoji를 google/fonts 커밋 `47d54ca1ebb14fd864695f1d39dc734f39017c33`에 고정한다. 파일별 SHA-256과 URL은 config에 기록한다. 원본 변경 때 파일과 라이선스·고지를 함께 확인한다.

산출물의 소스별 고지는 고정 원본의 라이선스·name table에 기록된 저작권을 보존한다. CJK 원본의 Adobe 고지에는 `Source` 이름이 포함되며 그대로 배포한다. 나머지는 Noto Project Authors 또는 Google 고지다. 공통 OFL 본문은 `scripts/fonts/licenses/OFL-1.1.txt`에 보관한다.

## 정적 호스트 (Cloudflare R2)

2026-10-18에 구성했다.

| 항목          | 값                                                                                                                                                                                                            |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| bucket        | `rawsector-static` (계정 `9f0f8d06051d7a08312dab4f49650dbb`, r2.dev 공개 URL 미사용)                                                                                                                          |
| custom domain | `static.rawsector.com` (zone `rawsector.com`, 최소 TLS 1.2)                                                                                                                                                   |
| 경로          | `dist/fonts/`의 상대 경로를 그대로 `fonts/` 아래 key로 사용                                                                                                                                                   |
| CORS          | GET·HEAD, origin `https://www.rawsector.com`, `https://rawsector.com`, 도구 4곳(`hwp`·`portadj`·`transcode`·`youtube-audio.rawsector.com`), `http://localhost:3000`, `:6010`, `:5173`, `:8080`, max age 86400 |
| 캐시          | 해시 CSS·WOFF2 `public, max-age=31536000, immutable`, 고정 별칭 `geul-<profile>.css`·`manifest.json`·`sources.json`·`licenses/` `public, max-age=300`                                                         |

고정 별칭 `geul-<profile>.css`는 해시 stylesheet와 내용이 같다. 생성된 매핑을 가질 수 없는 소비자(geul-tools)가 쓴다. 존의 Browser Cache TTL(4시간)이 짧은 `max-age`를 덮어써서, 별칭 갱신은 브라우저에 최대 4시간 늦게 반영된다. 이전 별칭이 가리키는 해시 WOFF2는 지우지 않으므로 그동안에도 동작한다.

Content-Type은 `.woff2` `font/woff2`, `.css` `text/css; charset=utf-8`, `.json` `application/json`, `.txt` `text/plain; charset=utf-8`이다.

재업로드는 `pnpm fonts:build` 뒤 같은 key·헤더로 덮어쓴다. 해시 파일은 내용이 바뀌면 이름이 바뀌므로 기존 객체를 지우지 않아도 이전 배포가 계속 동작한다. Wrangler 예시:

```sh
wrangler r2 object put "rawsector-static/fonts/<path>" --file "<path>" \
  --content-type "font/woff2" --cache-control "public, max-age=31536000, immutable" --remote
```

토큰은 `Account → Workers R2 Storage → Edit`와 `rawsector.com`의 `Zone → Read`, `DNS → Edit` 권한이 필요하다.

## 남은 배포 절차

1. production 앱을 전환한다. 필요하면 `PUBLIC_FONT_BASE_URL`로 배포 대상 base를 지정한다.
2. 새 앱의 폰트 요청을 검증한 뒤 별도 geul-api 저장소에서 기존 폰트 프록시를 폐기한다.

## 검증 범위와 Claude 브라우저 인계

`fonts:check`의 shaping 비교는 Arabic 결합·모음 부호와 Thai mark를 400/500/600 각각에서 실행한다. variable 원본 전체 glyph에 같은 width 100·weight 400–600 축 제한을 적용한 기준 폰트와 glyph 윤곽·cluster·advance·offset이 정확히 같은지, GSUB/GPOS가 존재하는지 검사한다. 축 제한 전 원본과의 일치 여부(`rawSourceExact`)와 최대 배치 차이(`maxRawPositionDelta`, font unit)도 별도로 기록한다. 좌표 허용 오차로 차이를 숨기지 않는다.

Claude는 `pnpm fonts:build && pnpm fonts:check` 후 `pnpm storybook`으로 다음을 확인한다. 실제 페이지는 같은 dist/fonts를 제공하는 로컬 정적 서버와 `PUBLIC_FONT_BASE_URL`을 사용한다.

- 앱의 실제 production View 사용처와 Storybook에서 light/dark, 모바일·태블릿·데스크탑, locale 전환과 포털의 폰트 상속을 확인한다.
- en/ar/th의 `base`, ko의 Hangul과 `漢字` TC 형태, ja의 kana/Han, 중국어 간체·번체의 Han 형태를 확인한다.
- 400/500/600의 실제 font 선택, Mono, 컬러 Emoji·결합 시퀀스, Arabic 결합·모음 부호와 Thai mark를 확인한다. Storybook 500이 400/700 TTF의 합성으로 표시되지 않는지 확인한다.
- 장문 줄바꿈·스크롤·hover/focus, 같은 variable URL의 weight별 재사용, WOFF2 요청 수·바이트, CORS와 CSS/WOFF2 오류를 기록한다. 정적 호스트 업로드 후에는 산출물이 없는 Storybook의 호스트 fallback도 확인한다.

이번 작업에서는 브라우저 도구가 Chrome 접근을 거부해 변경 전후의 실제 페이지·Storybook을 시각적으로 확인하지 못했다. 자동 검사를 시각 검토 완료로 간주하지 않는다. cmap/CSS 누락은 checks.json의 `fallback`에 기록하며 브라우저의 정규화·조합이나 시스템 fallback 선택을 확인한 결과가 아니다.

## 산출물 크기

2026-10-18 전체 빌드는 457개 슬라이스, WOFF2 총 15,608,752바이트다. 이는 물리 파일 전체이며 페이지 전송량이 아니다. Brotli 크기는 Node `brotliCompressSync` 기본 설정으로 계산한다. 정확한 파일명은 생성 매핑과 manifest에서 확인한다.

| 프로필  | stylesheet                          | CSS 바이트 | Brotli 바이트 |
| ------- | ----------------------------------- | ---------: | ------------: |
| base    | `geul-base.4c420863a115655f.css`    |    146,694 |        10,167 |
| ko      | `geul-ko.ec890c0cb8daa54d.css`      |    414,291 |        26,809 |
| ja      | `geul-ja.2bbbe7410e223111.css`      |    455,745 |        29,335 |
| zh-hans | `geul-zh-hans.f759eb7eba794dd5.css` |    415,863 |        26,806 |
| zh-hant | `geul-zh-hant.ec890c0cb8daa54d.css` |    414,291 |        26,809 |

Arabic·Thai 슬라이스는 각 weight에서 축을 제한한 기준 폰트와 정확히 일치했다. 축 제한 전 Noto Arabic 원본과는 500에서 최대 1 font unit의 배치 차이가 있으며 윤곽 일치 여부도 `shaping` 기록에 남긴다.
