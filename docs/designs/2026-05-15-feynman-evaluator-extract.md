# 설계: 2026-05-15-feynman-evaluator-extract

**생성:** 2026-05-15 12:55
**워크트리:** /Users/moon/DevLearn_FE_wt/2026-05-15-feynman-evaluator-extract
**브랜치:** task/2026-05-15-feynman-evaluator-extract

## 목표
파인만 채팅 재설계 3단계 시리즈 중 1단계. 파인만 채팅에서 사용자 답변을 받았을 때 전용 평가기 프롬프트(`feynman.evaluator`) 가 (a) 출제된 질문의 linked_chunks (gold reference) + (b) 사용자 답변 기반 RAG 검색 청크 를 함께 입력받아 구조화된 평가 JSON (`correct_points / missing_points / incorrect_points / supplement / score`) 을 반환하도록 한다. `streamPreGen` 경로가 이 평가기를 호출하도록 교체하고, 결과 JSON 을 SSE done 이벤트와 DB에 함께 저장한다. FE는 일단 evalJson 을 메시지 meta 에 저장만 하고 UI 렌더는 본 태스크 범위 밖(3단계).

### 본 태스크가 해결하는 사용자 보고
1. "벡터 검색 하지 않는 경우가 있다" — pre-gen 경로가 RAG 우회하던 문제 해결.
2. "답변/질문 품질이 이상하다" — 평가기 프롬프트 명료화 + 구조화된 JSON 출력으로 일관성 확보.

### 본 태스크가 해결하지 않는 것 (별도 후속)
- **2단계 `feynman-mindmap-leak-fix`**: 마인드맵이 답변에 통째로 노출되는 문제.
- **3단계 `feynman-evaluation-card-ui`**: 구조화된 evalJson 을 FE 카드 UI로 렌더.

## 변경 범위

### BE (`/Users/moon/IdeaProjects/DevLearn_BE`)

**1. 신규 프롬프트 추가** — `src/main/resources/db/seed-prompts.sql`
- 새 키: `feynman.evaluator`
- 변수: `chapter`, `question`, `idealAnswer`, `goldChunks`, `userRagChunks`, `userAnswer`
- 출력 강제: 순수 JSON
  ```json
  {
    "score": 0-100,
    "correct_points": ["..."],
    "missing_points": ["..."],
    "incorrect_points": ["..."],
    "supplement": "원문 근거 기반 보충 설명 (인용 포함)"
  }
  ```
- 시스템 프롬프트 핵심 지시: "원문 근거(goldChunks/userRagChunks)에 없는 내용을 정답으로 인정하지 마라. 마인드맵·노드·구조 같은 단어를 평가에 포함하지 마라. supplement 는 반드시 goldChunks 원문을 인용하라."
- 기존 `answer-grader` 키는 deprecated 주석 추가하고 **삭제하지 않음** (기존 attempts 데이터의 해석 호환성).

**2. AnswerGraderService 시그니처 확장** — `src/main/java/com/moon/devlearn/feynman/service/AnswerGraderService.java`
- 신규 record:
  ```java
  public record EvalResult(
      int score,
      List<String> correctPoints,
      List<String> missingPoints,
      List<String> incorrectPoints,
      String supplement,
      String feedbackMarkdown   // 기존 호환 — 채팅 본문에 흘릴 마크다운
  ) {}
  ```
- 신규 메소드:
  ```java
  public EvalResult evaluate(String userId,
                             ChapterQuestionEntity question,
                             String userAnswer,
                             List<Map<String, Object>> userRagChunks,
                             String messageId)
  ```
  - 내부: linkedChunks fetch → `promptService.render("feynman.evaluator", vars)` → LLM 호출 → JSON 파싱.
  - JSON 파싱 실패 시 graceful fallback: 모든 list 빈 배열, supplement 는 raw 응답, score=50.
  - `answer_attempts` 저장 시 score/missing_concepts/feedback (기존 컬럼) + 신규 `eval_json` (전체 EvalResult JSON 직렬화) 두 곳에 함께 기록.
  - 기존 `grade()` 메소드는 **유지** 하되 내부에서 `evaluate()` 호출 후 `GradeResult` 로 다운캐스트 (호환 어댑터). 점진적 마이그레이션.
- `feedbackMarkdown` 생성 규칙:
  ```
  **점수**: {score}/100

  **잘 짚은 부분**
  - point1
  - point2

  **빠진 부분**
  - missing1

  **보완 설명**
  {supplement}
  ```
  (이게 stage 3에서 카드 UI로 교체되기 전까지 사용자에게 보이는 텍스트)

**3. streamPreGen 경로 변경** — `FeynmanService.java:814-873`
- 사용자 답변(이전 assistant 가 pre-gen 질문이고 user 가 답변한 경우, 라인 828-843 분기) 직전에:
  ```java
  RagResult rag = buildRagContext(docId, chapter, message);  // 신규 추가
  EvalResult eval = answerGraderService.evaluate(
      userId, prevQ, message, rag.chunks(), saved.getId()
  );
  ```
- body 조립은 `eval.feedbackMarkdown()` 사용.
- `persistMessageSources(saved.getId(), rag.chunks())` 도 같이 호출해서 RAG 청크 스냅샷 보존(기존 onDemand 와 동일 패턴).
- 인접한 미답변 질문 픽업 로직(847-857) 은 그대로 유지.

**4. DB 스키마 확장** — `src/main/resources/schema.sql` + 마이그레이션
- `answer_attempts` 테이블에 `eval_json JSONB` 컬럼 추가 (nullable, default NULL).
- 기존 row는 NULL 로 두고, 새 평가부터 채움.
- migration: `ALTER TABLE answer_attempts ADD COLUMN IF NOT EXISTS eval_json JSONB;`

**5. SSE done 이벤트 확장** — `StreamEvent.java`
- 신규 팩토리:
  ```java
  public static StreamEvent doneWithEval(String conversationId,
                                          String content,
                                          List<SourceRef> sources,
                                          String evalJson)
  ```
  - 직렬화 시 `evalJson` 필드를 raw JSON string 으로 포함 (null 가능).
- streamPreGen 의 done 발행을 신규 팩토리로 교체.

### FE (`/Users/moon/DevLearn_FE`)

**6. SSE 응답 파싱 확장** — `src/services/feynmanApi.js:205-281`
- `done` 이벤트 파싱에서 `evalJson` 필드를 추출(없으면 null) → `onDone({conversationId, content, sources, evalJson})` 호출.

**7. 메시지 meta 에 evalJson 보관** — `src/hooks/useStreamingChat.js:199-210`
- `pushMessage` 호출 시 `meta: { style: 'feynman', evalJson: result.evalJson || null }`.
- 현재 메시지 렌더 컴포넌트는 evalJson 을 사용하지 않음(stage 3에서 처음 사용). 단지 데이터만 흘려보낸다.

**중요: FE 측 UI 렌더링 변경 없음.** 사용자가 보는 것은 여전히 markdown feedback. 단지 메타데이터로 evalJson 이 메시지에 따라붙어 stage 3 가 사용할 수 있게 준비됨.

## 구현 계획

### Step A — BE 기반 (DB + 프롬프트)
1. `seed-prompts.sql` 에 `feynman.evaluator` 키 추가. 새 row 와 함께 `INSERT ON CONFLICT DO UPDATE` 패턴.
2. `schema.sql` 에 `answer_attempts.eval_json JSONB` 컬럼 추가 + 마이그레이션 SQL 작성.
3. DB 에 직접 ALTER 적용 (개발 DB 만, 운영은 본 태스크 범위 밖).

### Step B — BE 평가기 분리
4. `AnswerGraderService` 에 `EvalResult` record + `evaluate()` 메소드 추가.
5. 기존 `grade()` 는 `evaluate()` 호출 후 `GradeResult` 로 매핑하는 어댑터로 변경.
6. `answer_attempts` insert 시 `eval_json` 컬럼도 채우도록 mapper 갱신.

### Step C — BE 스트림 경로 통합
7. `FeynmanService.streamPreGen` 에서 사용자 답변 직전에 `buildRagContext()` 호출 + `evaluate()` 로 교체.
8. `persistMessageSources` 호출 추가.
9. `StreamEvent.doneWithEval` 팩토리 + streamPreGen 의 done 발행 교체.

### Step D — FE 메타데이터 패스스루
10. `feynmanApi.js` 의 done 파싱에 `evalJson` 추가.
11. `useStreamingChat.js` 의 pushMessage 에서 meta 에 `evalJson` 보관.

### Step E — 검증
12. 기존 completed 문서(자바의정석4판 또는 SQL전문가가이드) 의 chapter_questions 중 미답변 질문에 답변 → DB `answer_attempts.eval_json` 정상 저장 확인.
13. 채팅 화면 markdown 응답이 새 포맷("잘 짚은 부분 / 빠진 부분 / 보완 설명")으로 출력되는지 확인.
14. RAG 우회 사라졌는지: BE 로그에서 `buildRagContext` 호출 + `feynmanMapper.findSimilarChunks` 쿼리 발생 확인.

## 단위 테스트 계획

**시나리오 A — 프롬프트 렌더링**
- `PromptService.render("feynman.evaluator", vars)` 호출 시 모든 변수가 치환된 문자열이 반환되는지 (`{{...}}` 잔류 없음).

**시나리오 B — evaluate() JSON 파싱**
- 정상 JSON 응답 → `EvalResult` 모든 필드 채워짐.
- 깨진 JSON 응답 → fallback (score=50, 빈 배열, supplement=raw text).

**시나리오 C — streamPreGen RAG 호출**
- BE 로그에서 pre-gen 경로 사용자 답변 처리 시 `findSimilarChunks` SQL 이 호출되는지 확인.
- 이전 버그: pre-gen 경로에서 이 SQL 이 호출되지 않았었음.

**시나리오 D — DB 저장**
- `answer_attempts` 의 신규 row 에 `eval_json` 컬럼이 JSON 으로 채워졌는지.

**시나리오 E — FE meta 패스스루**
- 채팅 메시지 store 에서 마지막 assistant 메시지의 `meta.evalJson` 이 null 이 아닌 JSON 인지.

증거 경로: `.claude/state/evidence/2026-05-15-feynman-evaluator-extract/unit/notes.md`

## 회귀 테스트 계획

**회귀 대상 1**: 일반 채팅(`/api/chat/stream`) RAG 검색 — 본 변경과 무관한 경로지만 `buildRagContext` 의 다른 호출처라 영향 확인.
**회귀 대상 2**: streamOnDemand 경로 — 사전 질문 없는 챕터에서 자유응답 LLM 호출이 여전히 동작.
**회귀 대상 3**: 마인드맵 자동생성 — chapter_questions 생성 로직은 본 태스크에서 손대지 않으므로 정상 작동.

증거 경로: `.claude/state/evidence/2026-05-15-feynman-evaluator-extract/regression/notes.md`

## 위험 / 함정

- **임베딩 API 비용 2배**: pre-gen 경로에서도 `buildRagContext` 가 호출되므로 사용자 답변마다 임베딩 1회. 일단 수용. 향후 답변 길이가 짧으면 skip 하는 휴리스틱 추가 가능.
- **JSON 파싱 실패**: LLM 이 마크다운으로 응답하거나 JSON 앞뒤에 군더더기를 붙이는 경우. fallback 으로 사용자 경험은 망가지지 않지만 evalJson 이 null 에 가까워짐. 시스템 프롬프트에 "오직 JSON 만 출력" 강조 + 응답 후처리에서 ` ```json ` 펜스 stripping 처리.
- **answer-grader 데드 코드화**: 새 `feynman.evaluator` 채택 후 기존 `answer-grader` 프롬프트는 호출되지 않음. 본 태스크에서는 보존(데이터 호환), 차후 정리 태스크에서 삭제.
- **마인드맵 leak 미해결**: 본 태스크 범위 밖이라 답변에 여전히 마인드맵이 통째로 나올 수 있음. 이건 stage 2 에서 해결.
