# 설계: 2026-04-23-cert-quiz-cache

**생성:** 2026-04-23 13:42
**워크트리:** /Users/moon/DevLearn_FE_wt/2026-04-23-cert-quiz-cache
**브랜치:** task/2026-04-23-cert-quiz-cache

## 목표
자격증 퀴즈 생성 UX 의 두 가지 문제를 함께 해결한다.

1. **타임아웃** — 프론트 axios 기본 30초, 백엔드 `llmRestTemplate` read-timeout 60초로
   EXAONE 32B 같은 느린 로컬 LLM 의 생성 시간을 못 견디고 cancel 된다.
2. **캐싱** — 같은 `(사용자, 문서, 챕터 조합, 문제 수, 난이도, 유형, LLM)` 요청은 DB 에
   보관해 두고, 재요청 시 LLM 호출 없이 DB 에서 즉시 반환한다.

## 변경 범위

### DB 스키마
1. **`schema.sql`** / 운영 DB 마이그레이션
   - `quizzes` 테이블에 `cache_key VARCHAR(64) NULL` 컬럼 추가.
   - `CREATE UNIQUE INDEX IF NOT EXISTS idx_quizzes_user_cache ON quizzes(user_id, cache_key) WHERE cache_key IS NOT NULL`.
   - 기존 DB 업데이트는 ALTER TABLE 문을 설계 문서 끝에 동봉 — 운영에서 수동 실행.

### 엔티티 / 매퍼
2. **`QuizEntity`**: `cacheKey` 필드 추가.
3. **`QuizMapper`**
   - `findQuizByUserAndCacheKey(userId, cacheKey)` → `QuizEntity` 추가.
   - XML `insertQuiz` 에 `cache_key` 컬럼 포함.
4. **기존 `findQuestionsByQuizId(quizId)`** 은 이미 있음 — 재사용.

### 서비스
5. **`StudyService.generateQuiz(userId, request)`**
   - 소유자/청크 검증 후 `buildCacheKey(userId, docId, chapters, count, difficulty, types, llm)` 계산(SHA-256 → 64자 hex).
   - `findQuizByUserAndCacheKey` hit:
     - 해당 `quizId` 의 문제를 `findQuestionsByQuizId` 로 로드 → `QuestionDto` 구성 (answer/explanation 은 그대로 null).
     - LLM 호출 없이 즉시 반환. 로그: `퀴즈 캐시 hit: quizId=...`.
   - miss → 기존 로직 그대로 진행하되 `QuizEntity` 에 `cacheKey` 세팅해 insert.
6. **`buildCacheKey`** 헬퍼 (private) — `MessageDigest("SHA-256")` 사용.

### 백엔드 타임아웃 완화
7. **`LlmConfig.llmRestTemplate`**: `setReadTimeout(60s)` → `240s`. 로컬 32B·20B 생성 시간
   여유. connect-timeout 은 그대로 5초.

### 프론트 타임아웃 완화
8. **`studyApi.generateQuiz`** 에만 `timeout: 300_000` 명시 (5분). `api.js` 전역 타임아웃
   (30초) 은 다른 API 에 영향주지 않게 그대로.

### 테스트
9. **`StudyServiceTest.generateQuiz_stubMode_...`**
   - `quizMapper.findQuizByUserAndCacheKey(any(), any())` 가 null 반환 모킹 (cache miss 경로).
10. **(선택) 캐시 hit 테스트** 추가
    - `findQuizByUserAndCacheKey` 가 QuizEntity 반환 → `findQuestionsByQuizId` 로 기존 문제 반환 → LLM 호출 없이 응답. `verify(llmClient, never()).call(...)`.

## 구현 계획
1. schema.sql 수정. 운영용 ALTER TABLE 스크립트 작성 (문서 끝).
2. QuizEntity + QuizMapper(인터페이스·XML) 업데이트.
3. StudyService 에 cacheKey 생성·조회·hit 경로 + miss 경로의 insertQuiz 에 cacheKey 세팅.
4. LlmConfig read-timeout 240s.
5. studyApi.generateQuiz axios timeout 300s.
6. 테스트: miss 경로 모킹 수정 + (가능하면) hit 경로 케이스 추가.
7. BE 컴파일 / FE 빌드 / headless 렌더 확인.

## 단위 테스트 계획
자동:
- BE `./gradlew compileJava compileTestJava --rerun-tasks` 성공.
- FE `vite build` 성공. studyApi 번들에 `timeout: 300` 노출 확인.

수동:
- 본인 문서·챕터·LLM 조합으로 "퀴즈 시작" → 최초엔 LLM 호출(오래) 후 캐시 저장. 같은
  조합으로 다시 누르면 **즉시** 응답.
- 조합을 하나라도 바꾸면 새로 생성.
- EXAONE 로 첫 생성 시 이전보다 안정적으로 응답 수신 (타임아웃 여유).

## 회귀 테스트 계획
1. 파인만 학습/파이프라인·사이드바 문서 파이프라인 영향 없음.
2. 자격증 퀴즈 풀이·채점·통계 경로 영향 없음.
3. `quizzes` 테이블에 cache_key 컬럼이 없는 환경은 ALTER 전까지 INSERT 실패할 수 있음 —
   설계 문서/WORK_LOG 에 안내.

## 운영 DB 마이그레이션 스크립트 (별도 실행)
```sql
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS cache_key VARCHAR(64);
CREATE UNIQUE INDEX IF NOT EXISTS idx_quizzes_user_cache
  ON quizzes(user_id, cache_key)
  WHERE cache_key IS NOT NULL;
```
