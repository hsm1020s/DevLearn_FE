# 설계: 2026-05-15-feynman-questions-by-node

**생성:** 2026-05-15 14:13
**워크트리:** /Users/moon/DevLearn_FE_wt/2026-05-15-feynman-questions-by-node
**브랜치:** task/2026-05-15-feynman-questions-by-node

## 목표
파인만 챕터별 사전 질문(`chapter_questions`) 의 **출제 단위를 "청크에서 뽑은 concept" → "마인드맵 노드"** 로 전환한다. 챕터의 마인드맵에 존재하는 모든 비-루트 노드(label + description) 가 적어도 한 개의 질문으로 커버되도록 합성기를 재구성하고, 각 질문이 어떤 노드를 검증하는지 `node_id` 로 추적할 수 있게 한다. 본 태스크는 **합성 + 데이터 모델 단계** 만 다루며, 마스터리 기반 출제 순서 / 진행도 UI 는 후속 태스크에 위임한다.

### 본 태스크가 해결하는 사용자 의도
- "챕터의 모든 마인드맵과 설명에 대한 질문이 나와서 그 챕터를 다 익히는 과정처럼 만들고 싶다" — 우선 **커버리지(모든 노드가 질문화되는 것)** 와 **추적 가능성(질문 ↔ 노드)** 을 확보한다. 이게 없으면 "다 익혔다" 라는 상태 자체를 정의할 수 없다.

### 본 태스크가 다루지 않는 것 (의도적 스코프 축소)
- **마스터리 임계점 / 트리 BFS 출제 순서 / 챕터 완료 이벤트** → 후속 `feynman-chapter-mastery` 태스크.
- **FE 진행바, 마인드맵 노드 하이라이트, 완료 카드 UI** → 후속 `feynman-mastery-ui` 태스크.
- **기존 운영 데이터의 자동 재합성**: 본 변경 이전에 합성된 `chapter_questions` 는 `node_id = NULL` 인 상태로 보존된다. 강제 재생성은 별도 admin 액션 (스코프 밖). 신규 업로드부터 노드 기반 합성이 적용된다.

## 변경 범위

### BE (`/Users/moon/IdeaProjects/DevLearn_BE`)

**1. DB 스키마 — `chapter_questions` 컬럼 추가**
- 파일: `src/main/resources/schema.sql:116-128`
- 신규 컬럼
  ```sql
  node_id        UUID         NULL,
  question_kind  VARCHAR(20)  DEFAULT 'definition',
  ```
- 인덱스: `CREATE INDEX IF NOT EXISTS idx_cq_doc_chapter_node ON chapter_questions(doc_id, chapter, node_id);`
- 마이그레이션 SQL (개발 DB 직접 적용):
  ```sql
  ALTER TABLE chapter_questions
    ADD COLUMN IF NOT EXISTS node_id       UUID         NULL,
    ADD COLUMN IF NOT EXISTS question_kind VARCHAR(20)  DEFAULT 'definition';
  CREATE INDEX IF NOT EXISTS idx_cq_doc_chapter_node ON chapter_questions(doc_id, chapter, node_id);
  ```
- 기존 row 는 `node_id = NULL`, `question_kind = 'definition'` 으로 두고 호환 유지. `pickNextQuestion` 은 본 태스크에서 손대지 않으므로 동작에 영향 없음.
- COMMENT 두 줄 추가:
  ```sql
  COMMENT ON COLUMN chapter_questions.node_id IS '마인드맵 노드 ID → mindmap_nodes.id (논리 FK, NULL=폴백/구버전)';
  COMMENT ON COLUMN chapter_questions.question_kind IS '질문 각도 (definition | application | comparison) — 노드당 다각도 출제용';
  ```

**2. 엔티티 / 매퍼**
- `ChapterQuestionEntity` (`feynman/mapper/ChapterQuestionEntity.java`)
  - 필드 추가: `private String nodeId; private String questionKind;`
- `mapper/feynman/ChapterQuestionMapper.xml`
  - `QuestionResultMap` 에 `node_id`, `question_kind` 매핑 라인 추가.
  - `insertMany` SQL 에 두 컬럼 추가 (foreach 안 `#{r.nodeId}::uuid, #{r.questionKind}`).
  - 기존 `findOneUnansweredByUser` / `findOneLowestScoredByUser` / `findById` 는 그대로 (resultMap 만 갱신하면 자동 반영).

**3. `MindmapMapper` 보조 조회 1건**
- 본 태스크는 챕터 → 해당 챕터의 마인드맵 노드 리스트 조회가 필요하다.
- 이미 `FeynmanService.mindmapNodesToSourceRefs` 가 `mindmapMapper.findByDocId(docId)` + 자바측 필터로 동일 패턴 사용 중([FeynmanService.java:974-979](../IdeaProjects/DevLearn_BE/src/main/java/com/moon/devlearn/feynman/service/FeynmanService.java#L974-L979)). 합성기에서도 동일 패턴 재사용 — 신규 SQL 추가 없음.
- 노드 조회는 기존 `MindmapNodeMapper.findByMindmapId(mindmapId)` 사용.

**4. `QuestionSynthesisService` 리팩토링 (핵심)**
- 파일: `feynman/service/QuestionSynthesisService.java`
- 신규 의존성 주입: `MindmapMapper mindmapMapper`, `MindmapNodeMapper mindmapNodeMapper`, `EmbeddingClient embeddingClient` (이미 RAG 검색에 쓰임).
- `doSynthesize` 흐름 교체

  ```
  doSynthesize(docId, chapter):
    chunks = feynmanMapper.findAllChunksByDocAndChapter(...)
    nodes  = resolveChapterNodes(docId, chapter)   // ★ 신규

    if (nodes.size() >= MIN_NODES_FOR_NODE_PATH):  // 기본 3
        rows = synthesizeByNode(docId, chapter, chunks, nodes)
    else:
        rows = synthesizeByConcept(docId, chapter, chunks)   // ← 기존 Pass1/Pass2 보존
        // 폴백 row 는 node_id = null, question_kind = 'definition'

    if (rows.isEmpty()) return 0
    chapterQuestionMapper.insertMany(rows)
    return rows.size()
  ```

- `resolveChapterNodes(docId, chapter)`:
  - `mindmapMapper.findByDocId(docId)` → `chapter` 매칭 mindmap 1건 선택
  - `mindmapNodeMapper.findByMindmapId(mindmap.id)` → `depth >= 1` 이고 `description` 또는 `label` 이 비어있지 않은 노드만 반환. `seq` 오름차순.

- `synthesizeByNode(docId, chapter, chunks, nodes)`:
  ```
  rows = []
  seq = 1
  for node in nodes:
    query  = node.label + "\n" + (node.description ?: "")
    queryEmb = embeddingClient.embed(query)
    linkedChunks = topKByCosine(chunks, queryEmb, K=4)
    card = pass2GenerateQuestionForNode(chapter, node, linkedChunks)  // ★ 프롬프트 신규
    if (card == null) continue
    rows.add(ChapterQuestionEntity{
       docId, chapter, seq++, concept=node.label, question=card.question,
       idealAnswer=card.idealAnswer, linkedChunkIds=ids(linkedChunks),
       difficulty=card.difficulty, status='active',
       nodeId=node.id, questionKind='definition'
    })
  return rows
  ```
  - **임베딩 비용 주의**: 노드당 임베딩 1회. 챕터 N노드 = N회. 챕터 청크는 이미 임베딩이 DB에 있으므로 cosine 매칭은 자바측에서 수행 (또는 기존 RAG 헬퍼 재사용 — `buildRagContext` 와 동일 인프라가 있다면 그쪽 우선).
  - **간소 버전**: 임베딩 호출이 부담이면 **1단계에서는 chunk 매칭을 생략하고 청크 전체를 컨텍스트로 LLM 에 넘긴 뒤 LLM 이 자체적으로 인용 chunk_seqs 를 반환** 하게 한다 (현재 Pass1 패턴 재사용). 이 경우 `linked_chunk_ids` 는 LLM 응답 기반. ↓ 더 단순.
  - **채택안 (1차 구현)**: LLM 인용 방식. RAG 임베딩 호출 0회 추가, 토큰만 증가. 큰 챕터(>30 청크)는 청크 컨텍스트를 18,000자 cap (`MAX_CONTEXT_CHARS`) 으로 자른다(기존과 동일).

- `pass2GenerateQuestionForNode(chapter, node, chunks)`:
  - 신규 프롬프트 키 `feynman.synth.node-question` (시드)
  - 변수: `chapter, nodeLabel, nodeDescription, chunksContext`
  - LLM 출력 JSON 강제:
    ```json
    {
      "question": "...",
      "ideal_answer": "...",
      "difficulty": "low|mid|high",
      "linked_chunk_seqs": [int, ...]
    }
    ```
  - 시스템 프롬프트 핵심: "마인드맵 노드의 핵심 개념(label+description)을 사용자가 자기 말로 설명할 수 있는지 검증하는 질문 1개를 만들어라. 원문 청크에서 근거를 찾아 ideal_answer 를 작성하라. 마인드맵 자체나 노드 구조를 질문에 노출하지 마라(예: '이 노드는 뭐죠?' 금지)."
  - JSON 파싱 실패 1회 재시도 후 skip (기존 Pass2 와 동일 패턴).

- **기존 `pass1ExtractConcepts` / `pass2GenerateQuestion` 은 제거하지 않고** `synthesizeByConcept` 로 호출 경로만 유지 (폴백). 마인드맵이 미생성이거나 노드 빈약 챕터에서 살아있어야 함.

**5. 신규 시드 프롬프트** — `src/main/resources/db/seed-prompts.sql`
- 새 row: `feynman.synth.node-question` (시스템/유저 프롬프트 분리, JSON 출력 강제)
- 변수 placeholder: `{{chapter}} {{nodeLabel}} {{nodeDescription}} {{chunksContext}}`
- ON CONFLICT DO UPDATE 패턴으로 멱등 삽입.

**6. (선택) 파이프라인 트리거 순서**
- 현재 파이프라인은 마인드맵 합성과 질문 합성을 병렬/순차로 호출 중. 노드 기반으로 동작하려면 **마인드맵이 먼저 commit 된 뒤** 질문 합성이 시작돼야 한다.
- 확인 지점: `FeynmanService.runPipelineAsync` 에서 `MindmapSynthesisService` 와 `QuestionSynthesisService` 호출 순서.
  - 이미 순차적이면 그대로.
  - 병렬이라면 `synthesizeAsync(docId, chapter)` 진입부에 "마인드맵 row 존재할 때까지 짧은 polling/대기" 또는 마인드맵 완료를 알리는 콜백으로 트리거 변경. **본 태스크에서는 호출 순서가 이미 순차임을 확인만 하고, 아니면 별도 후속 태스크로 분리** (Risk 절 참고).

### FE
변경 없음. `chapter_questions` 가 가진 `concept` 컬럼이 그대로 `nodeLabel` 로 채워지고 기존 SSE/렌더 경로는 영향 없음.

## 구현 계획

### Step A — DB
1. `schema.sql` 에 컬럼 2개 + 인덱스 1개 + COMMENT 2개 추가.
2. 개발 DB 에 위 ALTER 적용 (psql).

### Step B — 엔티티/매퍼
3. `ChapterQuestionEntity` 에 `nodeId`, `questionKind` 필드 추가.
4. `ChapterQuestionMapper.xml` 의 `QuestionResultMap` 매핑 보강 + `insertMany` SQL 두 컬럼 추가.

### Step C — 합성기 (핵심)
5. `seed-prompts.sql` 에 `feynman.synth.node-question` 시드 추가.
6. `QuestionSynthesisService` 에 `MindmapMapper`, `MindmapNodeMapper` 주입.
7. `doSynthesize` 를 노드 경로 / 폴백 경로로 분기.
8. `synthesizeByNode` + `pass2GenerateQuestionForNode` 구현. 청크 컨텍스트는 `MAX_CONTEXT_CHARS` cap.
9. 파이프라인 호출 순서 확인 (`runPipelineAsync` 에서 mindmap → questions 순서인지). 순서 보장되지 않으면 본 태스크 내에서 간단한 wait 로 보강 (timeout 30s, polling 1s).

### Step D — 컴파일/실행 검증
10. `./gradlew compileJava` 통과.
11. BE 재시작 → 작은 신규 PDF 1건 업로드 → 파이프라인 완료.
12. DB 확인: `SELECT node_id, question_kind, concept FROM chapter_questions WHERE doc_id = ?` 로 `node_id` 가 채워진 row 가 다수, 노드 커버율(node 수 대비 row 수) 확인.

## 단위 테스트 계획

증거: `.claude/state/evidence/2026-05-15-feynman-questions-by-node/unit/notes.md`

**시나리오 A — 스키마 적용 확인**
- `psql -c "\d chapter_questions"` 로 `node_id`, `question_kind` 컬럼 존재 + 인덱스 `idx_cq_doc_chapter_node` 존재.

**시나리오 B — 노드 기반 합성 정상 동작**
- 작은 PDF (3~5 챕터, 챕터당 마인드맵 노드 ≥ 3) 업로드.
- 파이프라인 완료 후 `chapter_questions` 의 `node_id NOT NULL` 비율이 ≥ 90%.
- 챕터별 노드 수와 질문 수 비교: 노드 N개 중 질문 row M개. 커버리지 `M/N ≥ 0.8` 목표.

**시나리오 C — 폴백 경로 보존**
- 마인드맵이 없거나 노드 < 3 인 챕터 (수동으로 mindmap_nodes 일부 삭제) → 폴백 경로로 `concept` 기반 질문 생성 + `node_id = NULL`. 합성기 자체가 0건으로 끝나지 않는지 확인.

**시나리오 D — 프롬프트 렌더링**
- `promptService.render("feynman.synth.node-question", vars)` 호출 시 `{{...}}` 잔류 없음.

**시나리오 E — JSON 파싱 견고성**
- LLM 이 펜스(```json) 로 감싼 응답을 줘도 파싱 성공 (기존 `stripCodeFence` 로직 재사용).
- 파싱 실패 1회 재시도 후 해당 노드 skip — 전체 합성은 계속 진행.

## 회귀 테스트 계획

증거: `.claude/state/evidence/2026-05-15-feynman-questions-by-node/regression/notes.md`

**회귀 대상 1**: streamPreGen — `pickNextQuestion` 은 `node_id` 무관하게 동작해야 함 (기존 `seq/score` 만 사용). 신규 row 에서도 답변 평가 → 다음 질문 서빙 정상.
**회귀 대상 2**: streamOnDemand — 본 변경 무관, 정상 동작.
**회귀 대상 3**: 마인드맵 자동 생성 — 노드 합성을 위해 마인드맵에 의존이 추가되지만, 합성기 → 마인드맵 방향(역방향) 의존이 아니므로 마인드맵 생성 자체는 영향 없음. 확인.
**회귀 대상 4**: 채팅(`/api/chat/stream`) RAG — 본 변경 무관, 정상 동작.

## 위험 / 함정

- **마인드맵 ↔ 질문 합성 순서 의존**: 마인드맵이 늦게 commit 되면 노드 경로 진입 못 하고 폴백으로 빠진다. `runPipelineAsync` 순서를 코드 레벨에서 확인 — 순차면 OK, 아니면 합성기 진입부에서 짧은 wait 로 보강. 보강이 복잡하면 본 태스크에서 분리.
- **노드 수 폭주 챕터**: 일부 챕터는 노드가 30+ 일 수 있음. 노드당 LLM 호출 1회 = 챕터 합성 비용 3배 증가 가능. 1차에서는 그대로 두고, 비용 보고 후 후속에서 `depth <= 2` 로 제한하거나 형제 노드를 묶어 한 번에 출제하는 옵션 검토.
- **node.description 빈약**: 자동 생성된 마인드맵 노드의 description 이 한두 줄짜리일 때 질문 품질이 떨어질 수 있음. linked_chunks 컨텍스트가 보강 역할. 시드 프롬프트에 "원문 청크가 description 보다 신뢰도 높음" 명시.
- **기존 데이터와의 불일치**: 본 변경 이전에 합성된 chapter_questions 는 `node_id = NULL`. 후속 태스크 마스터리 계산 시 NULL 처리(노드와 매칭 안 되는 질문은 마스터리 집계에서 제외 or 별도 버킷)를 명세해야 함. 본 태스크에서는 단지 컬럼만 보존.
- **마인드맵 노드 → chapter 매칭 누락**: `mindmaps.chapter` 값이 정확히 일치해야 함. `chapter` 정규화 로직이 다른 곳에서 손대고 있다면 누락 발생 가능 → 미스 시 폴백으로 자동 전환.
