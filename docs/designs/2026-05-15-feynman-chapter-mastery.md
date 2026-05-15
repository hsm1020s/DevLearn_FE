# 설계: 2026-05-15-feynman-chapter-mastery

**생성:** 2026-05-15 14:37
**워크트리:** /Users/moon/DevLearn_FE_wt/2026-05-15-feynman-chapter-mastery
**브랜치:** task/2026-05-15-feynman-chapter-mastery

## 목표
[1줄 요약] 파인만 챕터 학습의 종료 조건을 **"준비된 질문을 모두 풀었다"** → **"챕터 마인드맵의 모든 노드를 임계점수 이상으로 통과했다"** 로 바꾼다. 직전 1단계(`feynman-questions-by-node`) 에서 만든 `chapter_questions.node_id` 매핑을 바탕으로, 다음 질문 픽업 순서를 트리 BFS(상위→하위) 로 정렬하고, SSE done 이벤트에 `progress: {mastered, total, currentNodeId, complete}` 페이로드를 동봉해 FE 가 진행도를 추적할 수 있도록 한다.

### 본 태스크가 해결하는 사용자 의도
- "챕터를 다 익히는 과정"을 명시적으로 정의 — 노드 단위 마스터리(임계 점수 통과) 를 종료 조건으로.
- 출제 순서가 트리 상위 개념부터 → 자연스러운 학습 곡선.

### 본 태스크가 다루지 않는 것 (의도적 스코프 축소)
- **FE 진행 바 / 노드 하이라이트 / 완료 카드 UI** → 후속 `feynman-mastery-ui` 태스크.
- **다각도 출제(`question_kind` 별 추가 질문 합성)** — 본 단계는 1단계 결과물(`definition` 1종) 가 만든 질문 풀로 마스터리 흐름만 검증. 후속 보강.
- **운영 데이터 마이그레이션 / 전 챕터 일괄 재합성** — 1단계의 hook 으로 신규/마인드맵 재생성 챕터부터 자연 적용.

## 변경 범위

### BE (`/Users/moon/IdeaProjects/DevLearn_BE`)

**1. ChapterQuestionMapper — 트리 BFS 픽업 SQL 신설**
- 파일: `mapper/feynman/ChapterQuestionMapper.xml` + `feynman/mapper/ChapterQuestionMapper.java`

`pickNextQuestion` 의 우선순위를 1개 SQL 로 통합한다.

```sql
-- 신규: findNextByMastery
-- 우선순위 (한 ORDER BY 안에서):
--   tier 1) node_id 가 있는 질문 중, 노드 best_score < THRESHOLD (또는 attempts 0) 인 것 — depth ASC, node.seq ASC, q.seq ASC
--   tier 2) node_id 가 NULL 인 폴백 질문 중 미통과 — q.seq ASC
-- 1건 반환. 없으면 null = 챕터 완료(또는 폴백 챕터 다 풀음).
SELECT q.*
FROM chapter_questions q
LEFT JOIN mindmap_nodes mn ON mn.id = q.node_id
LEFT JOIN LATERAL (
  SELECT MAX(a.score) AS best
  FROM answer_attempts a
  WHERE a.question_id = q.id AND a.user_id = #{userId}::uuid
) s ON true
WHERE q.doc_id = #{docId}::uuid
  AND q.chapter = #{chapter}
  AND q.status = 'active'
  AND (s.best IS NULL OR s.best < #{threshold})
ORDER BY
  CASE WHEN q.node_id IS NULL THEN 1 ELSE 0 END,  -- 노드 매핑 우선
  COALESCE(mn.depth, 99) ASC,
  COALESCE(mn.seq, 99999) ASC,
  q.seq ASC
LIMIT 1
```

- `threshold` 는 service 상수 `MASTERY_SCORE = 70`.
- 기존 `findOneUnansweredByUser` / `findOneLowestScoredByUser` 는 호출처에서 제거하지 않고 보존(보강 진단/대시보드용으로 남길 수 있음). `FeynmanService.pickNextQuestion` 만 신규 SQL 호출로 교체.

**2. ChapterQuestionMapper — 마스터리 집계 SQL 신설**

```sql
-- 신규: getMasteryProgress, resultType=HashMap
SELECT
  COUNT(DISTINCT q.node_id) FILTER (WHERE q.node_id IS NOT NULL)
                                                                       AS total,
  COUNT(DISTINCT q.node_id) FILTER (WHERE q.node_id IS NOT NULL AND s.best >= #{threshold})
                                                                       AS mastered
FROM chapter_questions q
LEFT JOIN LATERAL (
  SELECT MAX(a.score) AS best
  FROM answer_attempts a
  WHERE a.question_id = q.id AND a.user_id = #{userId}::uuid
) s ON true
WHERE q.doc_id = #{docId}::uuid
  AND q.chapter = #{chapter}
  AND q.status = 'active'
```

- `total == 0` 이면 챕터에 노드 매핑된 질문이 없음 (마인드맵 없거나 concept-only). 이 경우 마스터리 완료를 강제하지 않고 기존 "다 풀었어요" UX 로 폴백.
- `complete = (total > 0 AND mastered == total)`.

**3. `FeynmanService` 변경 — `streamPreGen`**
- 파일: `feynman/service/FeynmanService.java`
- `pickNextQuestion(...)` 구현 교체:
  ```java
  // 신규 통합 SQL — 트리 BFS + 점수 기반.
  return chapterQuestionMapper.findNextByMastery(docId, chapter, userId, MASTERY_SCORE);
  ```
- `streamPreGen` 마지막에 마스터리 진행도 조회 + SSE done 페이로드 동봉:
  ```java
  Map<String,Object> prog = chapterQuestionMapper.getMasteryProgress(docId, chapter, userId, MASTERY_SCORE);
  int total = toInt(prog.get("total"));
  int mastered = toInt(prog.get("mastered"));
  boolean complete = (total > 0) && (mastered == total);

  if (complete) {
      // 직전 채점 결과(있으면)는 위쪽에서 이미 body 에 append 되어 있음.
      body.append("🎉 챕터 마스터 완료! ").append(total).append("개 노드를 모두 통과하셨어요.");
      nextQ = null; // 다음 질문 안 냄.
  } else if (nextQ == null) {
      // 미통과 노드도 없고 마스터리도 아직 (예: total=0 폴백) → 기존 종료 메시지.
      body.append("이 챕터의 준비된 질문을 모두 풀어보셨어요. 🎉");
  }
  // 이미 nextQ 가 잡혀있고 complete=false 면 평소처럼 "다음 질문" append.
  ```
- `currentNodeId / currentNodeLabel` 은 nextQ 의 node_id (이번에 사용자가 받는 질문) 기반으로 채움. nextQ.nodeId 가 null 이면 currentNodeId/Label 도 null.
- `emitter.send(StreamEvent.doneWithEvalAndProgress(...))` 로 페이로드 확장 (아래 4번).

**4. `StreamEvent` 확장**
- 파일: `chat/dto/StreamEvent.java`
- 신규 필드:
  ```java
  /** 파인만 챕터 마스터리 진행도 (raw JSON 문자열). 비파인만 경로/일반 채팅에서는 null. */
  private String progressJson;
  ```
- 신규 팩토리:
  ```java
  public static StreamEvent doneWithEvalAndProgress(
      String conversationId, String content, List<SourceRef> sources,
      String evalJson, String progressJson) { ... }
  ```
- 기존 `doneWithEval` 은 그대로 유지 (다른 호출처 영향 없음).
- streamPreGen 의 done 발행만 새 팩토리로 교체.
- progressJson 의 스키마:
  ```json
  {
    "total": 5,
    "mastered": 2,
    "currentNodeId": "uuid-or-null",
    "currentNodeLabel": "string-or-null",
    "complete": false
  }
  ```

**5. 같은 질문 반복 UX 보강**
- 신규 SQL 이 가장 최근에 답변한 미통과 질문을 그대로 다시 돌려줄 수 있다 (동일 ID).
- 응답 본문 조립 시: 직전 질문 ID == 이번 nextQ.id 이면 "이 노드를 한 번 더 짚어볼게요" 한 줄을 질문 위에 prefix.
- 직전 ID 비교는 이미 `MessageEntity.questionId` 를 `messageMapper.findLastAssistant` 로 조회하는 흐름이 있으니 재사용.

### FE (`/Users/moon/DevLearn_FE`)

**6. SSE 응답 파싱 확장**
- 파일: `src/services/feynmanApi.js` (done 이벤트 파싱)
- `progressJson` 필드 추출 → 안전 파싱(JSON.parse with try) → `onDone({ ..., progress })`.
- 파싱 실패하거나 null 이면 그대로 null 통과.

**7. 채팅 store 에 progress 보관**
- 파일: `src/hooks/useStreamingChat.js`
- `pushMessage` 호출 시 `meta` 에 `progress: parsedProgress` 보관 (`evalJson` 과 동일 패턴).
- **본 단계에서 UI 렌더 변경 없음.** 단지 메타데이터 패스스루.

> 후속 UI 태스크가 `lastMessage.meta.progress.mastered / total / complete` 를 읽어 진행 바를 그린다.

## 구현 계획

### Step A — DB/Mapper
1. `ChapterQuestionMapper.xml` 에 `findNextByMastery` + `getMasteryProgress` SQL 추가.
2. `ChapterQuestionMapper.java` 에 메소드 시그니처 + javadoc 추가.

### Step B — DTO 확장
3. `StreamEvent` 에 `progressJson` 필드 + `doneWithEvalAndProgress` 팩토리 추가.

### Step C — Service 통합
4. `FeynmanService.pickNextQuestion` 구현을 신규 SQL 호출로 교체. `MASTERY_SCORE = 70` 상수 추가.
5. `FeynmanService.streamPreGen`:
   - 다음 질문 픽 → 마스터리 진행도 조회 → body 조립.
   - 같은 질문 반복이면 안내 prefix.
   - complete 면 챕터 완료 멘트 + nextQ=null.
   - `progressJson` 직렬화 + `doneWithEvalAndProgress` 로 done 발행.

### Step D — FE 패스스루
6. `feynmanApi.js` done 파싱에 `progressJson` 추출 + JSON.parse.
7. `useStreamingChat.js` pushMessage 에서 `meta.progress` 보관.

### Step E — 컴파일 + 검증
8. `./gradlew compileJava` 통과.
9. BE 재기동 → 1단계에서 노드 매핑된 chapter_questions 가 있는 챕터 대상 라이브 검증.

## 단위 테스트 계획

증거: `.claude/state/evidence/2026-05-15-feynman-chapter-mastery/unit/notes.md`

**시나리오 A — findNextByMastery 순서**
- 작은 챕터(노드 5개) 가 있는 doc 에서 파인만 학습 시작.
- 첫 질문: depth=1 의 seq=0 노드.
- 그 질문에 70점 미만 답변 → 동일 질문 다시 나오는지(미통과 재출제) + "한 번 더 짚어볼게요" prefix.
- 70점 이상 답변 → 다음 노드 (depth=1, seq=1 또는 depth=2, seq=0) 의 질문으로 이동.

**시나리오 B — 마스터리 진행도 SSE 페이로드**
- 동일 챕터에서 5개 노드 중 2개 통과 후 응답을 받았을 때, SSE done 이벤트 raw 에 `progressJson` 이 들어있고 파싱 시 `{total:5, mastered:2, complete:false}`.

**시나리오 C — 챕터 완료**
- 모든 노드를 70+ 점수로 통과 → 응답 본문이 "🎉 챕터 마스터 완료" 문구로 바뀌고 `progressJson.complete = true`, `currentNodeId = null`.

**시나리오 D — 노드 매핑 없는 챕터 폴백**
- `node_id` 가 모두 NULL 인 챕터(1단계 이전 합성).
- `total = 0` 이므로 마스터리 강제 안 됨. concept 폴백 질문이 `q.seq ASC` 로 서빙.
- 모두 70+ 통과해도 complete=false (total=0). 기존 "다 풀었어요" 메시지로 자연 종료.

**시나리오 E — FE 메타 패스스루**
- 채팅 메시지 store 의 마지막 assistant 메시지에 `meta.progress` 가 null 이 아닌 객체.
- 객체 안에 `total / mastered / complete` 필드 존재.

## 회귀 테스트 계획

증거: `.claude/state/evidence/2026-05-15-feynman-chapter-mastery/regression/notes.md`

**회귀 대상 1**: `streamOnDemand` 폴백 채팅 — `pickNextQuestion` 변경은 pre-gen 경로에만 영향. onDemand 무관. 확인.
**회귀 대상 2**: 일반 채팅(`/api/chat/stream`) — `StreamEvent.done(... sources)` 기존 팩토리 그대로 사용. 신규 필드 `progressJson` 은 null 직렬화. FE 파싱 측에서 `progressJson` 미존재 시 그대로 null — 영향 없음.
**회귀 대상 3**: 1단계 합성 hook — 마인드맵 생성 시 노드 보강 트리거 정상.
**회귀 대상 4**: 채팅 평가기 — `doneWithEval` 호출처가 본 변경에서 doneWithEvalAndProgress 로 교체되므로 evalJson 페이로드가 그대로 흘러야 함.

## 위험 / 함정

- **신규 SQL 의 성능**: `LEFT JOIN LATERAL` + `MAX(score)` 가 attempt 수에 비례. 한 챕터 attempts 수가 수백 ~ 수천 정도면 무시 가능. 그 이상이면 인덱스 (`idx_aa_user_question`) 가 이미 있어 충분히 빠름. 운영에서 측정해서 캐싱 추가 여부 결정.
- **같은 질문 반복**: 사용자가 한 노드에서 70점을 넘기지 못하면 같은 질문이 계속 나옴 → 본 단계에서 의도된 동작. prefix 안내로 어색함 완화. 후속 다각도 출제 단계에서 question_kind 다양화로 본격 해결.
- **chapter_questions 가 비어 있는 챕터**: `hasPreGen=false` 로 streamOnDemand 폴백. 본 변경과 무관.
- **모든 노드 매핑 row 0 + concept row 만 존재(1단계 이전 데이터)**: 마스터리 total=0 이라 complete 트리거 안 됨. `findNextByMastery` 가 tier 2 로 concept row 를 정상 서빙. UX: 진행도 표시 없이 기존 흐름 유지.
- **MASTERY_SCORE 임계값 튜닝**: 70 은 임의 기본값. 너무 높으면 사용자 좌절, 너무 낮으면 마스터리 의미 약화. 본 단계에서는 상수 1개로 두고, 후속에서 application.yml `feynman.mastery.threshold` 로 분리.
