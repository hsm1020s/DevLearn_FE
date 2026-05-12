# 설계: 2026-05-12-suggestion-fullstack

**생성:** 2026-05-12 15:37
**워크트리:** /Users/moon/DevLearn_FE_wt/2026-05-12-suggestion-fullstack
**브랜치:** task/2026-05-12-suggestion-fullstack

## 목표
"기능개선 제안" 모달을 풀스택으로 동작하게 만든다. 현재는 클라이언트 `localStorage` 에만 저장되어 운영자가 사용자의 제안을 볼 수 없다. 백엔드 테이블 + REST 엔드포인트를 만들고 프론트가 그쪽으로 POST 하도록 교체한다.

## 변경 범위

### 백엔드 (`DevLearn_BE`)
1. **schema.sql** — `suggestions` 테이블 추가
   ```sql
   CREATE TABLE IF NOT EXISTS suggestions (
       id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
       user_id    UUID         NOT NULL,
       title      VARCHAR(200) NOT NULL,
       content    VARCHAR(2000) NOT NULL,
       categories VARCHAR(200) NOT NULL,  -- 콤마 구분, 예: "ui,feature,bug"
       created_at TIMESTAMP    NOT NULL DEFAULT now()
   );
   CREATE INDEX IF NOT EXISTS idx_suggestions_user ON suggestions(user_id, created_at DESC);
   ```
   - 카테고리는 5종 고정(ui/feature/bug/performance/etc)이라 별도 join 테이블은 오버킬. 콤마 구분 문자열로 단순 저장한다. 카테고리 기반 검색 쿼리가 생기면 그때 정규화.
   - 길이 제한은 FE 입력 maxLength(200/2000)와 동일하게 맞춤.

2. **모듈 신설** — `com.moon.devlearn.suggestion` (chat 모듈 구조 모방)
   - `controller/SuggestionController.java` — `POST /api/suggestions`
   - `service/SuggestionService.java` — 입력 화이트리스트 검증 + insert 위임
   - `dto/SuggestionCreateRequest.java` — categories(List<String>), title, content
   - `dto/SuggestionResponse.java` — id, createdAt (확인용 최소 필드)
   - `mapper/SuggestionMapper.java` + `SuggestionEntity.java`
   - `resources/mapper/suggestion/SuggestionMapper.xml`

3. **인증**: SecurityConfig 변경 없음. `/api/**` 는 기본 인증 필요 — `/api/suggestions` 도 자동으로 JWT 필요. userId 는 `SecurityContextHolder.getContext().getAuthentication().getName()` 으로 추출(chat 패턴 동일).

### 프론트엔드 (`DevLearn_FE`)
1. **신규**: `src/services/suggestionApi.js` — `submitSuggestion({categories, title, content})`
   - axios 인스턴스(`api`) 재사용, JWT는 인터셉터가 자동 부착
   - 본 태스크에서는 Mock 분기 추가하지 않음 (운영자 피드백 수집 흐름은 실 BE 가 핵심)

2. **수정**: `src/components/common/SuggestionModal.jsx`
   - `localStorage` 분기 제거
   - `useAuthStore` 의 `isLoggedIn` 체크 → 비로그인 시 안내 Toast + 모달 닫기 (또는 제출 버튼 가드)
   - `submitSuggestion` API 호출 → 성공 Toast / 실패 시 `showError`

## 구현 계획

### BE (의존 순서)
1. `schema.sql` 에 테이블 추가 (서버 부팅 시 자동 적용)
2. `SuggestionEntity` + `SuggestionMapper` (인터페이스) + `SuggestionMapper.xml`
3. `SuggestionCreateRequest` + `SuggestionResponse` DTOs
4. `SuggestionService` — request → entity 변환, categories List<String> → CSV 직렬화(서비스에서 `String.join(",", ...)`), 화이트리스트 외 카테고리 거름, mapper.insert 후 생성된 id/createdAt 반환
5. `SuggestionController` — `POST /api/suggestions`, `@Valid`, `getCurrentUserId()` 헬퍼 (chat과 동일 패턴)

### FE
6. `services/suggestionApi.js` 작성
7. `SuggestionModal.jsx` 의 `handleSubmit` 을 API 호출로 교체, 로그인 가드 추가

## 단위 테스트 계획
1. 로그인 상태에서 모달 → 카테고리/제목/내용 입력 → 제출 → 성공 Toast 노출
2. 제출 직후 BE DB(psql)에서 `SELECT * FROM suggestions ORDER BY created_at DESC LIMIT 1;` 로 행 확인 — user_id / title / content / categories(CSV) 정확히 적재
3. 비로그인 상태에서 제안 모달 열고 제출 시 안내 Toast + API 미호출(네트워크 탭 확인)
4. 카테고리 미선택 / 빈 제목 / 빈 내용 → 클라이언트 가드(기존 동작 유지) + 서버 도달 안 함

## 회귀 테스트 계획
- 채팅 메시지 1회 송수신 — 인증 흐름 영향 없음 확인
- 사이드바 다른 모달(문서 업로드 또는 파이프라인) 열기/닫기

## 보안 / 견고성 메모
- `categories` 화이트리스트 검증: 서비스에서 FE 와 동일 5종 집합 외 값을 거른다(임의 큰 문자열 주입 방지).
- 길이 제한: VARCHAR(200/2000) 으로 1차 컷, `@Size` 어노테이션으로 2차 컷.
- 빈 카테고리는 `@NotEmpty` 로 차단.
