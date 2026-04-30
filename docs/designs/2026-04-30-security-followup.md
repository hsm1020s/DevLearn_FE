# 설계: 2026-04-30-security-followup

**생성:** 2026-04-30 19:38
**워크트리:** /Users/moon/DevLearn_FE_wt/2026-04-30-security-followup
**브랜치:** task/2026-04-30-security-followup

## 목표
직전 풀스캔 결과 중 **프론트엔드만 단독으로 처리 가능한 보안 항목**을 모두 보완한다.
백엔드 협업이 필요한 항목(localStorage 토큰 → httpOnly 쿠키 전환, role 응답 추가)은
이번 태스크 범위에서 제외하고 사용자에게 별도 안내한다.

### 보완 대상 (FE 단독 처리 가능)
1. **A-#3 API URL 하드코딩 폴백 제거**
   - `src/services/api.js:18`, `src/services/monitorApi.js:7`의 `localhost:8080` 폴백 제거.
   - 운영 빌드(`import.meta.env.PROD`)에서 `VITE_API_URL` 미설정 시 명시적 throw.
   - 개발 모드에서는 기존처럼 `localhost:8080/api`를 폴백으로 허용(편의 유지).

2. **A-#2 관리자 페이지 클라이언트 가드 강화 (부분)**
   - 백엔드 role 응답 도입 전이라도, `useAuthStore`에 `role` 필드 자리(없으면 null)를 두고
     `AdminPage`에서 `role === 'ADMIN'`이 아니면 즉시 메인으로 리다이렉트.
   - 백엔드가 role을 내려주기 전까지는 모든 로그인 사용자가 차단되므로,
     **임시 우회 플래그**(`VITE_ADMIN_ALLOW_ANY_LOGIN=true`)로 개발 환경에서만 통과.
   - → 단, 이 정책 변경은 사용자 승인이 필요하므로 **본 태스크에서는 보류**하고 사용자 안내만.

3. **A-#4 운영 배포 메모(README/배포 문서) 보강** — 코드 변경 없이 문서만.
   - 본 태스크에서는 **A-#3만 코드 수정**, A-#2/A-#4는 사용자 안내로 마무리.

### 사용자에게 위임할 항목 (BE 변경 또는 정책 결정 필요)
- A-#1 localStorage → httpOnly 쿠키 (백엔드 Set-Cookie + CORS credentials 변경 필요)
- A-#2 user role 응답 추가 (백엔드 사용자 DTO 확장 필요)
- A-#4 운영 Nginx CSP/HSTS/X-Frame-Options 헤더 강화 (인프라 작업)

## 변경 범위
- `src/services/api.js` — baseURL 결정 로직 분리
- `src/services/monitorApi.js` — baseURL 결정 로직 동일하게 적용
- `src/services/apiBaseUrl.js` *(신규)* — 두 파일이 공유하는 baseURL 결정 헬퍼

## 구현 계획
1. `src/services/apiBaseUrl.js` 신규 작성:
   - `import.meta.env.VITE_API_URL` 우선
   - 없으면 dev 모드에서 `http://localhost:8080/api` 반환
   - 없으면 prod 모드에서 `throw new Error('VITE_API_URL is required for production build')`
2. `api.js` / `monitorApi.js`에서 헬퍼 호출로 교체
3. dev 서버 기동 후 채팅·인증 호출이 정상 동작하는지 확인

## 단위 테스트 계획
- dev 모드(`npm run dev`): VITE_API_URL 그대로 두고 채팅 1회 → 정상
- dev 모드: `.env.local`에서 VITE_API_URL 일시 삭제 → 폴백으로 정상 동작
- 빌드 모드(`VITE_API_URL= npm run build`): 빌드 실패 → 명시적 에러 메시지 노출 확인

## 회귀 테스트 계획
- 마인드맵 페이지 진입 → 노드 생성 동작
- 인증 흐름(로그인 → 로그아웃) 1회
