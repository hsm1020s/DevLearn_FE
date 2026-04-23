# 설계: 2026-04-23-quiz-async-job

**생성:** 2026-04-23 13:53
**워크트리:** /Users/moon/DevLearn_FE_wt/2026-04-23-quiz-async-job
**브랜치:** task/2026-04-23-quiz-async-job

## 목표
자격증 퀴즈 생성을 **비동기 잡 + 폴링** 패턴으로 재구성한다. 느린 로컬 LLM(EXAONE 32B 등)
때문에 HTTP 타임아웃을 계속 늘리는 대신, 서버가 즉시 `quizId` 를 반환하고 백그라운드
스레드에서 LLM 을 호출하며, 프론트는 상태 조회 엔드포인트를 주기적으로 폴링해 완료되면
문제를 받아온다.

## 흐름

```
[초기 요청]
POST /api/study/generate-quiz
  → 캐시 hit: { quizId, status:"completed", questions:[...] } 즉시 반환 (기존과 동일)
  → 캐시 miss:
     1) quiz 레코드 insert (status="processing", cache_key 포함)
     2) @Async 로 generateQuizAsync 호출 → LLM 호출 + 문제 저장 + status 업데이트
     3) { quizId, status:"processing" } 즉시 반환

[프론트 폴링]
GET  /api/study/quizzes/{quizId}
  → { status, questions?, errorMessage? }
  → 프론트는 3초 간격 폴링, 최대 10분 (200회). 완료/실패 시 종료.
```

## 변경 범위

### DB 스키마
1. `quizzes.status VARCHAR(20) NOT NULL DEFAULT 'completed'` 추가.
   - 값: `processing` / `completed` / `failed`
   - 기본값 'completed' 로 기존 레코드 자동 완료 상태.
2. `quizzes.error_message TEXT NULL` 추가 (실패 원인 보관, 필수 아님).
3. 운영 DB 마이그레이션 ALTER 문은 설계 말미 + WORK_LOG.

### 엔티티 / 매퍼
4. `QuizEntity`: `status`, `errorMessage` 필드 추가.
5. `QuizMapper`:
   - `insertQuiz` 에 status/error_message 포함.
   - `findQuizById(quizId)` 추가 (상태 조회용).
   - `updateQuizStatus(quizId, status, errorMessage)` 추가.

### DTO
6. `QuizResponse`:
   - `status` 필드 추가 (`processing|completed|failed`).
   - `errorMessage` 필드 추가 (nullable).
   - 기존 `quizId`, `questions` 유지. processing 일 때 questions 는 null/비어있음.

### 서비스
7. `StudyService.generateQuiz(userId, request)`
   - 소유자/청크 검증, 캐시 조회.
   - 캐시 hit → 기존처럼 `status='completed' + questions` 구성해 반환.
   - 캐시 miss → `insertQuiz(status='processing', cacheKey)` 후 `{quizId, status:'processing'}` 반환.
     - 주의: 같은 클래스 내 `this.generateQuizAsync(...)` 는 프록시를 타지 않으므로
       컨트롤러에서 async 호출을 분리 실행 (파인만 `runPipelineAsync` 패턴과 동일).
   - 반환 타입을 `QuizResponse` 단일화 — status 로 분기.
8. `StudyService.generateQuizAsync(userId, quizId, request, docText)`
   - `@Async @Transactional`. LLM 호출 → parse → DB 저장. 성공 시 `updateQuizStatus(completed)`,
     실패/파싱실패 시 스텁 폴백 문제 저장 후 `completed`. 진짜 치명적 실패만 `failed`.
9. `StudyService.getQuizStatus(userId, quizId)`
   - `findQuizById` → 소유자 체크 → 상태별 응답 구성.
   - `completed` 면 `findQuestionsByQuizId` 로 문제 로드해 포함.

### 컨트롤러
10. `StudyController`
    - `POST /generate-quiz`: 두 단계 — (a) 서비스 `prepareGenerate` 로 캐시/검증/insert. (b) miss 면 `studyService.generateQuizAsync(...)` 를 외부 호출해 @Async 프록시 경유.
    - `GET /quizzes/{quizId}` 신규: `getQuizStatus(userId, quizId)` 호출.
    - 더 단순한 설계: `generateQuiz` 가 prepare 결과를 반환(quizId/status/cacheHit 플래그 등)해
      컨트롤러에서 async 호출 트리거.

### 프론트
11. `services/studyApi.js`:
    - `generateQuiz(params)` — 이제 `timeout` 은 짧게(30초 이내) 충분. 서버가 즉시 응답.
    - 신규 `fetchQuizStatus(quizId)` → `GET /study/quizzes/{quizId}`.
12. `services/mock/studyMock.js`: 빠르게 완료된 형태로 즉시 `status=completed` 반환 유지
    (mock 은 단순화). 신규 mock `fetchQuizStatus` 도 `completed` 고정.
13. `components/study/QuizSettings.jsx`:
    - `handleGenerate` 가 응답의 `status` 를 본다:
      - `completed` → 기존처럼 `setQuiz(...)` + `setStudyStep('quiz')`.
      - `processing` → 폴링 시작: 3초 간격 `fetchQuizStatus`. 최대 200회(10분).
        완료되면 동일 처리. 실패 시 토스트.
    - 로딩 UI: 버튼 라벨 "생성 중... (최대 N분)" + 현재 시도 카운트 또는 경과 시간.
    - 폴링 도중 컴포넌트 unmount 시 취소.

### 테스트
14. `StudyServiceTest.generateQuiz_stubMode_...`
    - `generateQuiz` 가 이제 단일 요청에서 DB insert 만 하고 `@Async` 는 안 태우므로 test 는
      miss 경로에서 `{quizId, status='processing'}` 반환을 기대하도록 수정.
    - `generateQuizAsync` 는 별도 단위 테스트(or 생략 — integration 성격).

## 구현 순서
1. schema.sql 수정 + ALTER 문 작성.
2. QuizEntity (status, errorMessage) / QuizMapper (insertQuiz/findQuizById/updateQuizStatus).
3. QuizResponse DTO 에 status/errorMessage.
4. StudyService 재구성 + generateQuizAsync(@Async) + getQuizStatus.
5. StudyController: POST 는 prepare 후 async 트리거, GET /quizzes/{id} 신규.
6. 테스트 업데이트.
7. 프론트 studyApi.fetchQuizStatus + QuizSettings 폴링 + mock 보완.
8. BE 컴파일 / FE 빌드 / headless 렌더.

## 단위 테스트 계획
자동:
- BE compileJava/compileTestJava 성공.
- FE vite build 성공.
- QuizSettings 번들에 `fetchQuizStatus` · `polling` 관련 심볼 포함.

수동:
- 첫 요청: 즉시 "생성 중..." UI → 수 초~수 분 후 자동으로 문제 화면 전환.
- 같은 요청 재시도: 캐시 hit 으로 거의 즉시 문제 화면.
- 네트워크 탭에서 `/generate-quiz` 는 202/200 즉시, 이후 `/quizzes/{id}` 폴링 3초 간격.
- 악의적으로 다른 사용자의 quizId 로 `/quizzes/{id}` 호출 시 FORBIDDEN.

## 회귀 테스트 계획
- 파인만 모듈 전반 무영향.
- 채팅/스트리밍/마인드맵/STT 무영향.
- `submitAnswer`·`getStudyStats` 는 QuizQuestion/Answer 경로라 이번 변경에 무관.

## 운영 DB 마이그레이션 (별도 실행)
```sql
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'completed';
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS error_message TEXT;
```
기존 레코드는 `completed` 로 채워져 있어 status 조회 시 자연스럽게 완료 상태로 뜬다.
