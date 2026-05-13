# 설계: 2026-05-13-fe-user-settings-page

**생성:** 2026-05-13 19:01
**워크트리:** /Users/moon/DevLearn_FE_wt/2026-05-13-fe-user-settings-page
**브랜치:** task/2026-05-13-fe-user-settings-page

## 목표
일반 사용자가 사이드바의 이름 드롭다운에서 **설정**을 눌렀을 때 보던 500 에러를 없애고, 일반 사용자 전용 **설정 페이지**(`/settings`)로 진입시킨다. 이 페이지에서 **회원정보 수정**(이름·비밀번호)과 **회원 탈퇴**를 수행할 수 있다.

### 현재 문제
[Sidebar.jsx:765](src/components/layout/Sidebar.jsx#L765) 의 "설정" 버튼이 역할과 무관하게 `navigate('/admin')`을 호출한다. SecurityConfig의 `/api/admin/**`는 `ROLE_ADMIN`만 허용하므로 일반 사용자에게는 관리자 화면이 부분적으로 깨지거나 API 호출이 403/500을 일으킨다.

### 목표 동작
- 일반 사용자(`role === 'USER'`): "설정" 클릭 → `/settings`로 라우팅.
- 관리자(`role === 'ADMIN'`): 기존대로 `/admin`로 라우팅 (현행 유지).
- `/settings` 페이지에 두 섹션:
  1. **회원정보 수정** — 이름 변경(필수 입력 검증), 비밀번호 변경(현재 비밀번호 + 새 비밀번호 + 새 비밀번호 확인).
  2. **회원 탈퇴** — 위험 동작이므로 비밀번호 재입력 + 확인 팝오버 → 성공 시 로그아웃 + 메인 이동.

## 변경 범위

### 백엔드 (DevLearn_BE)
신규 엔드포인트 3개 (`/api/users/me` 하위, 인증 필요 — SecurityConfig 기본 정책으로 자동 보호됨):

| Method | Path | 용도 |
|--------|------|------|
| `GET`    | `/api/users/me` | 현재 로그인 사용자 정보(email, name, role, createdAt) 조회 |
| `PATCH`  | `/api/users/me` | 이름 변경 (`name` 필드만 변경) |
| `PATCH`  | `/api/users/me/password` | 비밀번호 변경 (현재 비밀번호 검증 후 교체) |
| `DELETE` | `/api/users/me` | 회원 탈퇴 (현재 비밀번호 재검증 후 users 행 hard delete) |

신규 파일:
- `auth/controller/UserController.java` — 위 4개 엔드포인트
- `auth/dto/UpdateProfileRequest.java` — `name`
- `auth/dto/ChangePasswordRequest.java` — `currentPassword`, `newPassword`
- `auth/dto/WithdrawRequest.java` — `password`
- `auth/dto/UserProfileResponse.java` — id, email, name, role, createdAt
- `auth/service/UserService.java` — 위 4개 메서드 (이메일 중복 검사·BCrypt 비교·MyBatis update/delete 호출)

수정 파일:
- `auth/mapper/UserMapper.java` — `updateName`, `updatePassword`, `deleteById` 추가
- `resources/mapper/auth/UserMapper.xml` — 대응 SQL 추가

**회원 탈퇴 정책 (이번 태스크 한정):**
- 1차로 `users` 행만 hard delete. 의존 데이터(rag_docs, conversations, mindmaps 등)는 schema 상 **논리 FK**라 자동 삭제되지 않고 그대로 남는다.
- 사용자 가시 화면(사이드바 대화 목록 등)은 모두 JWT의 userId 기준으로 조회하므로, 탈퇴 후에는 더 이상 그 userId로 로그인할 수 없어 데이터는 사실상 접근 불가 상태가 된다.
- 잔여 데이터의 일괄 cleanup(소프트 삭제 또는 cascade delete)은 별도 태스크로 분리한다 — 이 PR에서는 다루지 않음을 본 문서에 명시.

### 프론트엔드 (DevLearn_FE)

신규 파일:
- `src/pages/SettingsPage.jsx` — 설정 페이지 컨테이너 (인증 가드 + 두 섹션 마운트)
- `src/components/settings/ProfileSection.jsx` — 회원정보 수정 (이름·비밀번호 변경 폼)
- `src/components/settings/WithdrawSection.jsx` — 회원 탈퇴 (위험 동작, 팝오버 확인)
- `src/services/userApi.js` — `getMe`, `updateProfile`, `changePassword`, `withdraw`

수정 파일:
- `src/App.jsx` — `<Route path="/settings" element={<SettingsPage />} />` 추가 (lazy 로드)
- `src/components/layout/Sidebar.jsx` — "설정" 버튼 onClick:
  ```js
  const target = authUser?.role === 'ADMIN' ? '/admin' : '/settings';
  navigate(target);
  ```
- `src/stores/useAuthStore.js` — `updateProfileLocal({ name })` 액션 추가 (서버 PATCH 성공 후 store의 user.name 갱신용). 비밀번호 변경은 store 불변.

## 구현 계획

### Phase A — 백엔드 API
1. `UserMapper`에 메서드 3개 + XML SQL 3개 추가.
2. `UserService` 구현:
   - `getMe(userId)` → `findById` 후 응답 DTO 변환.
   - `updateProfile(userId, req)` → name 빈값 거부, `updateName` 호출.
   - `changePassword(userId, req)` → `findById` → 현재 비밀번호 `passwordEncoder.matches` 검증 실패 시 `UNAUTHORIZED` → 새 비밀번호 정책 검증(서버는 `@Size min=4` 유지) → `encode` 후 `updatePassword`.
   - `withdraw(userId, req)` → `findById` → 비밀번호 검증 → `deleteById`.
3. `UserController` 구현 — JWT 필터가 SecurityContext에 심어둔 principal(`userId`)을 `@AuthenticationPrincipal` 또는 기존 컨벤션에 맞춰 추출. (※ Phase A 착수 시 다른 인증 필요 컨트롤러가 어떻게 userId를 받는지 1곳 확인 후 동일 패턴 따른다.)

### Phase B — 프론트엔드 라우팅 가드 + 진입점
4. `App.jsx`에 `/settings` 라우트(lazy) 추가.
5. `Sidebar.jsx` "설정" 버튼 분기 — `authUser?.role === 'ADMIN' ? '/admin' : '/settings'`.

### Phase C — 설정 페이지 UI
6. `SettingsPage.jsx`:
   - 미로그인 시 `<ErrorPage code={401} />` 또는 메인 리다이렉트 중 1택(코드베이스 컨벤션 확인 후 결정).
   - 마운트 시 `getMe()` 1회 호출하여 폼 초기값 채움.
   - 좌측 사이드바 레이아웃은 유지(공통 `Sidebar` 재사용), 우측에 두 섹션 카드 형태로 배치.
7. `ProfileSection.jsx`:
   - 이름 변경 폼 — 변경 버튼은 dirty 상태에서만 활성화.
   - 비밀번호 변경 폼 — 클라이언트 정책(영문+숫자 8자 이상, `useAuthStore`의 `validatePasswordPolicy`와 동일 규칙) 적용. 일치 검사.
   - 성공 시 Toast로 알림. 비밀번호 변경 직후 폼은 비움.
8. `WithdrawSection.jsx`:
   - **"회원 탈퇴" 버튼** → 비밀번호 입력 인라인 팝오버(브라우저 `confirm` 사용 금지) → "탈퇴" 확정 시 `withdraw` 호출.
   - 성공 시 `logout()` 호출 → 메인 리다이렉트.

### Phase D — 디자인 토큰 준수
9. 모든 색상은 `globals.css`의 CSS 변수 기반 Tailwind 유틸리티만 사용(`bg-bg-primary`, `text-danger` 등). 하드코딩 금지.

## 단위 테스트 계획
직접 브라우저로 검증(노트는 evidence/unit/notes.md):
1. **일반 사용자 로그인 → 이름 클릭 → 설정 클릭** → `/settings`로 이동, 500 화면이 더 이상 뜨지 않음.
2. **관리자 로그인 → 설정 클릭** → 기존대로 `/admin`로 이동.
3. **이름 변경** → 새 이름 입력 후 저장 → Toast 노출 → 사이드바 상단 이름이 즉시 새 이름으로 바뀜 → 새로고침 후에도 유지.
4. **비밀번호 변경 — 현재 비밀번호 오류** → 401/에러 Toast.
5. **비밀번호 변경 — 새 비밀번호 정책 미달** → 클라이언트 에러 메시지 노출(서버 호출 없음).
6. **비밀번호 변경 — 정상** → Toast → 로그아웃 후 새 비밀번호로 재로그인 가능.
7. **회원 탈퇴 — 비밀번호 오류** → 에러 Toast, 로그인 유지.
8. **회원 탈퇴 — 정상** → 로그아웃 + 메인 이동 → 같은 이메일로 재로그인 실패(존재 X).
9. **백엔드 단위:** Postman/curl로 `/api/users/me` GET·PATCH·DELETE 정상/예외 경로 각 1회.

## 회귀 테스트 계획
이번 변경과 무관한 주요 기능 1개 이상 실사용 후 결과를 evidence/regression/notes.md에 기록:
- **채팅** — 일반 사용자로 로그인 후 자유모드 메시지 1회 송수신, 사이드바 대화 목록 정상 표시.
- **마인드맵** — 모드 전환 후 마인드맵 토글 → 캔버스 렌더 정상.
- **관리자 페이지** — 관리자 계정으로 로그인 후 `/admin` 진입 시 기존처럼 정상 동작(이번에 분기를 건드렸으므로 회귀 위험 영역).
