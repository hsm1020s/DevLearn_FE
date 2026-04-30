# 설계: 2026-04-30-security-hardening

**생성:** 2026-04-30 16:05
**워크트리:** /Users/moon/DevLearn_FE_wt/2026-04-30-security-hardening
**브랜치:** task/2026-04-30-security-hardening

## 목표
풀스캔 보안 감사에서 도출된 P1·P2·P3 이슈를 일괄 해소해 운영 배포 가능 수준으로 끌어올린다. P0(테스트 비밀번호 `12345` 제거)는 사용자 지시에 따라 본 태스크 범위 밖.

## 변경 범위
- **P1: CSP/보안 헤더** — `index.html` 에 CSP / X-Frame-Options(meta는 무시되므로 frame-ancestors 사용) / X-Content-Type-Options 메타 추가
- **P1: refresh token 동시성** — `src/services/api.js`, `src/services/chatApi.js`, `src/services/feynmanApi.js` refresh 호출을 단일 Promise 캐시로 통합
- **P2: 부팅 가드** — `src/main.jsx` 에 `hasAccessToken` 비대칭 상태 검증 추가
- **P2: 회원가입 비밀번호 정책** — `src/stores/useAuthStore.js` register 진입 전 클라이언트 검증
- **P2: LoginModal autocomplete** — 이메일/비밀번호 필드에 표준 autocomplete 토큰 명시
- **P2: ErrorBoundary DEV 가드** — `componentDidCatch` console.error 를 `import.meta.env.DEV` 로 감쌈
- **P3: dead deps 제거** — `package.json` 에서 사용처 0건인 `react-syntax-highlighter` 제거
- **P3: Vite sourcemap 명시** — `vite.config.js` 에 `build.sourcemap: false` 명시

> 참고: P1 중 백엔드 `/admin/**` ROLE_ADMIN 검증은 BE 변경 사항이라 본 FE 태스크 범위 밖. 사용자에게 별도 안내.

## 구현 계획
1. `index.html` 에 CSP / nosniff 메타 추가, frame-ancestors 정책
2. `src/services/api.js` refresh 호출에 `refreshPromise` 싱글톤 도입, 401 인터셉터 큐화
3. `src/services/chatApi.js`, `src/services/feynmanApi.js` 의 fetch 경로도 동일한 단일 refresh 함수로 통합 — `api.js` 에서 `getValidAccessToken()` export → fetch 경로가 그것을 사용
4. `src/main.jsx` 부팅 가드 보강
5. `src/stores/useAuthStore.js` register 비밀번호 정책 (8자+, 소문자/대문자/숫자)
6. `src/components/common/LoginModal.jsx` autocomplete 명시
7. `src/components/common/ErrorBoundary.jsx` DEV 가드
8. `react-syntax-highlighter` 의존성 삭제 + `package.json` 갱신
9. `vite.config.js` `build.sourcemap: false`

## 단위 테스트 계획
- 빌드 성공: `npm run build`
- dev 서버 부팅 후 메인 페이지 정상 렌더 (CSP 위반 없는지 콘솔 확인)
- 로그인 → 401 강제 시나리오는 실제로 백엔드 의존이라 코드 정합성 리뷰 + 빌드로 갈음
- 부팅 가드: `localStorage.removeItem('accessToken')` 후 새로고침 → 사용자 캐시 클리어 확인
- 회원가입 약한 비밀번호 입력 시 클라이언트 측 거부 메시지 확인
- LoginModal 에서 autocomplete 동작 확인
- 마인드맵·채팅·문서 등 기능에 react-syntax-highlighter 사용처 0건이므로 회귀 영향 없음 (확인 grep)

## 회귀 테스트 계획
- 채팅 모드 진입 → 메시지 송수신 (CSP 위반 없이 마크다운 렌더되는지)
- 마인드맵 캔버스 진입 → 노드 추가/이동
- 파인만(문서 업로드) 모달 진입
- 로그아웃 → 재로그인 → 데이터 초기화 정상
