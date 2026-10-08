# Three.js 런타임 CDN

Geul의 파티클 화면, 에러 숫자 및 Three.js 편집기 미리보기는
`lib/three/cdn-runtime.ts`의 공용 로더로 실행 코드를 받는다.
Ionian 0.2.0과 `three-stdlib`는 npm 의존성으로 설치하고 Geul 번들에
포함한다. Three.js 실행 코드만 jsDelivr에서 받으며, 로컬 Three.js 및
타입 패키지는 빌드와 타입 검사에 사용한다.

`scripts/prepare-three-runtime.mjs`는 설치된 패키지의 정확한 버전을 읽어
`lib/three/cdn-runtime-manifest.json`과 Three.js 연결 모듈
`lib/three/three-cdn-module.generated.mjs`를 생성한다. Next.js와 Storybook 빌드
설정에서 실행되므로 라이브러리를 업데이트할 때 CDN URL도 함께 바뀐다.
`latest`나 버전 범위는 CDN URL에 사용하지 않는다.

CDN URL은 `https://cdn.jsdelivr.net/npm/three@버전/build/three.module.min.js`다.
Geul의 브라우저 빌드에서만 `three` 참조를 연결 모듈로 바꾼다.
Ionian과 `three-stdlib` 내부의 표준 Three.js import도 같은 모듈에 연결되어
한 화면에서 동일한 생성자와 런타임을 공유한다. 연결 모듈은 CDN 로딩이
끝난 후 설치된 버전의 이름별 export를 제공한다.

Ionian 자체에는 CDN 주소나 Geul 연결 설정을 넣지 않는다. Ionian을 쓰는
다른 앱은 기존처럼 npm 번들, 원하는 CDN 또는 자체 호스팅을 선택한다.
브라우저와 편집기 워커는 실행 영역이 다르므로 각각의 모듈 인스턴스를
가지며 파일 다운로드는 브라우저의 캐시 정책을 따른다.

로더는 동시 요청을 공유하고 15초 이상 응답하지 않으면 실패로 처리한다.
기존 화면의 오류 표시 또는 일반 숫자 표시가 유지된다. 오류가 발생한
뒤에는 로더의 Promise 캐시를 비워 다음 시도를 허용한다.
편집기 워커의 사용자 코드 실행은 CDN 로딩 완료 후 시작하며, 기존
네트워크·스토리지 제한과 짧은 프레임 감시 제한은 유지한다.

Ionian은 CDN 로딩이 끝난 뒤 Web의 코드 청크에서 가져온다. CDN 요청이
실패하면 Ionian을 평가하지 않아 이후 재시도가 가능하다.

근거: [Three.js 공식 설치 안내](https://threejs.org/manual/pages/installation.html),
[Next.js 브라우저 별칭 설정](https://nextjs.org/docs/app/api-reference/config/next-config-js/turbopack#resolving-aliases).
