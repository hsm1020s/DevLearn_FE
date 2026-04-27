# 설계: 2026-04-27-pipeline-step-tracking (1차)

**생성:** 2026-04-27 17:38
**워크트리:** /Users/moon/DevLearn_FE_wt/2026-04-27-2026-04-27-pipeline-step-tracking
**브랜치:** task/2026-04-27-2026-04-27-pipeline-step-tracking
**전체 로드맵:** 1차(트래킹) → 2차(산출물 DB 적재 + 미리보기) → 3차(manual 모드 + 승인 게이트). 본 작업은 **1차만** 다룬다.

## 목표
파이프라인 실행을 **DB로 트래킹**하여 단계별 시작/종료/실패/재시도 이력을 영속화한다.
지금처럼 자동 모드로 끝까지 흐르되, 모든 단계의 실행 메타가 DB에 남아 사후 검증과 재실행이 가능해진다.

- 이번 차수에서 **건드리지 않는 것**:
  - 단계별 산출물(pages/toc/chapters)의 DB 저장 → 2차
  - 사용자 승인 게이트 → 3차
  - FE 변경 → 2차/3차 (1차는 DB + BE만)
- 이번 차수에서 **얻는 것**:
  - 어떤 문서가 어느 단계에서 얼마 걸렸고/실패했는지 SQL로 확인 가능
  - 단계 단위 재실행 API (`POST /pipeline/runs/{runId}/step/{step}/rerun`)
  - 모든 시도가 attempt별로 보존 → "지난 번 LLM이 더 잘 뽑았다" 비교의 토대

## 변경 범위

### 신규 파일 (BE)

| 파일 | 역할 |
|------|------|
| `src/main/resources/db/migration/Vxx__pipeline_runs.sql` | DDL 마이그레이션 |
| `src/main/java/com/moon/devlearn/pipeline/entity/PipelineRunEntity.java` | runs 행 엔티티 |
| `src/main/java/com/moon/devlearn/pipeline/entity/PipelineStepResultEntity.java` | step_results 행 엔티티 |
| `src/main/java/com/moon/devlearn/pipeline/mapper/PipelineRunMapper.java` + `.xml` | runs CRUD |
| `src/main/java/com/moon/devlearn/pipeline/mapper/PipelineStepResultMapper.java` + `.xml` | step_results CRUD |
| `src/main/java/com/moon/devlearn/pipeline/service/PipelineTracker.java` | 단계 시작/종료/실패 기록 헬퍼 (서비스 코드에서 호출) |
| `src/main/java/com/moon/devlearn/pipeline/controller/PipelineRunController.java` | 조회/재실행 엔드포인트 |
| `src/main/java/com/moon/devlearn/pipeline/dto/PipelineRunResponse.java` | runs + 최신 step 요약 |
| `src/main/java/com/moon/devlearn/pipeline/dto/PipelineStepResultResponse.java` | step별 응답 |

### 수정 파일 (BE)

| 파일 | 변경 |
|------|------|
| `feynman/service/FeynmanService.java` | `runPipelineAsync()` 시작 시 `PipelineRun` 생성 + `PipelineTracker` 주입 |
| `scripts/feynman_pipeline/run_pipeline.py` | 단계 진입/종료 시 별도 테이블 INSERT (psycopg). `runId` 인자 추가 |
| `mindmap/service/MindmapSynthesisService.java` | mindmap 단계도 트래커 호출 (이미 존재하는 자동 디스패치 시점에) |

### DB 스키마

```sql
-- 파이프라인 실행 1건 (= rag_docs 1건의 1번 처리 시도 묶음)
CREATE TABLE pipeline_runs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_id        UUID NOT NULL,                                  -- rag_docs.id (논리 FK)
  user_id       UUID NOT NULL,
  mode          VARCHAR(20) NOT NULL DEFAULT 'auto',            -- 'auto'|'manual' (1차는 'auto'만)
  current_step  VARCHAR(20) NOT NULL DEFAULT 'extract',         -- 'extract'|'toc'|'group'|'embed'|'mindmap'|'done'
  status        VARCHAR(20) NOT NULL DEFAULT 'pending',         -- 'pending'|'running'|'failed'|'completed'
  started_at    TIMESTAMP,
  finished_at   TIMESTAMP,
  error_message TEXT,
  created_at    TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pipeline_runs_doc_id   ON pipeline_runs(doc_id, created_at DESC);
CREATE INDEX idx_pipeline_runs_user_id  ON pipeline_runs(user_id, created_at DESC);

-- 단계별 시도 — 같은 (run_id, step) 조합이라도 attempt가 다르면 별 행
CREATE TABLE pipeline_step_results (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id          UUID NOT NULL REFERENCES pipeline_runs(id) ON DELETE CASCADE,
  step            VARCHAR(20) NOT NULL,
  status          VARCHAR(20) NOT NULL,                         -- 'running'|'done'|'failed'
  attempt         INT NOT NULL DEFAULT 1,
  output_summary  JSONB,                                        -- 페이지 수/챕터 수/청크 수/모델명 등
  llm_model       VARCHAR(50),
  duration_ms     BIGINT,
  error_message   TEXT,
  started_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  finished_at     TIMESTAMP,
  UNIQUE(run_id, step, attempt)
);

CREATE INDEX idx_pipeline_step_results_run_id ON pipeline_step_results(run_id, started_at);
```

> **물리 FK 1개만 사용:** `pipeline_step_results.run_id` → `pipeline_runs(id)`. `doc_id`/`user_id`는 프로젝트 정책상 논리 FK로만 둔다 (참조: 0af4e81 commit).

### 트래커 인터페이스 (Java)

```java
public interface PipelineTracker {
    /** run 시작. doc 1건당 새 run을 만든다. 같은 doc 재실행 시에도 새 run. */
    UUID startRun(UUID docId, UUID userId);

    /** 단계 시작. 같은 (run, step)으로 두 번째 호출되면 attempt+1. */
    UUID startStep(UUID runId, String step);

    /** 단계 성공. output_summary는 단계별 메타(예: pages, chapters, chunks 등). */
    void finishStep(UUID stepResultId, Map<String,Object> outputSummary, String llmModel);

    /** 단계 실패. */
    void failStep(UUID stepResultId, String errorMessage);

    /** run 종료. */
    void completeRun(UUID runId);
    void failRun(UUID runId, String errorMessage);
}
```

### Python 스크립트 변경 (최소)

`run_pipeline.py`에 `--run-id` 인자를 추가하고, 각 단계 진입/종료 시 직접 `pipeline_step_results`에 INSERT/UPDATE.
이미 `psycopg` 의존이 있으니 새 라이브러리 없음.

```python
def step_start(run_id, step):
    # INSERT ... RETURNING id, attempt
    ...

def step_done(step_result_id, summary, model=None):
    # UPDATE ... SET status='done', finished_at=NOW(), output_summary=%s, llm_model=%s
    ...

def step_fail(step_result_id, err):
    ...
```

> **자바 트래커와 파이썬 사이 분리 이유:** 파이썬이 LLM TOC 추출/임베딩을 직접 돌리므로, 단계의 실제 시작/종료 시점을 가장 정확히 아는 쪽이 거기. 자바는 run 라이프사이클(시작/완료/실패)과 mindmap 단계만 책임진다.

### 신규 API (조회 + 재실행만, 1차)

```
GET  /api/feynman/pipeline/runs?docId={docId}        # 한 문서의 run 이력
GET  /api/feynman/pipeline/runs/{runId}              # run + 단계별 최신 attempt 요약
GET  /api/feynman/pipeline/runs/{runId}/steps        # 모든 attempt 포함 시계열
POST /api/feynman/pipeline/runs/{runId}/rerun        # 동일 docId로 새 run 시작 (Step 1부터 다시)
```

> 1차는 `step/{step}/rerun`(부분 재실행)을 **포함하지 않는다.** 부분 재실행은 산출물 DB 적재(2차)가 끝나야 안전. 1차에서는 "전체 재실행"만 노출.

## 구현 계획

### Step A — DDL + 엔티티/매퍼 (BE)
1. `Vxx__pipeline_runs.sql` 작성 + 로컬 DB에 적용 (psql)
2. `PipelineRunEntity` / `PipelineStepResultEntity` + 매퍼 XML
3. 빌드 통과 확인 (MyBatis 매퍼 binding)

### Step B — 트래커 서비스
1. `PipelineTrackerImpl` 구현 — 트랜잭션 짧게 끊어서 단계 시작/종료마다 즉시 commit
2. attempt 카운트 결정 로직: `MAX(attempt)+1` 조회 후 INSERT (UNIQUE 제약 위반 시 1회 재시도)

### Step C — Java 호출부 통합
1. `FeynmanService.runPipelineAsync()` 시작 시 `tracker.startRun(...)` → 반환된 runId를 ProcessBuilder 인자로 파이썬에 전달
2. ProcessBuilder가 끝나면 `tracker.completeRun` / `failRun`
3. `MindmapSynthesisService`의 자동 디스패치 진입/완료 시 mindmap 단계 시작/종료 호출

### Step D — Python 호출부 통합
1. `run_pipeline.py`에 `--run-id` 인자, 각 단계 진입/종료 시 INSERT
2. embedder가 chunks 수를, group_chapters가 chapter 수를, toc_extractor가 모델명을 summary에 담음

### Step E — 컨트롤러 + DTO
1. 조회 4개 + rerun 1개 엔드포인트
2. 사용자 격리 (run.user_id == 현재 사용자) 체크 — `feynman` 패키지 패턴 따라감

### Step F — 검증
1. 새 PDF 업로드 → run 1개 생성 + 단계별 행 자동 적재 확인
2. 의도적으로 임베딩 단계 실패 유도(예: Ollama 끄기) → `failStep`/`failRun` 동작 확인
3. `POST /rerun` → 새 run + 모든 단계 새로 적재 확인

## 단위 테스트 계획

(결과는 `.claude/state/evidence/<task-id>/unit/notes.md` 에 기록)

1. **DDL 적용**: `psql -d devlearn -f V*.sql` 성공, `\d pipeline_runs`로 컬럼/인덱스 확인
2. **빌드**: `./gradlew build` 통과 (MyBatis binding/JPA 없음)
3. **단위 흐름**:
   - "전문가 가이드" PDF (이미 status=uploaded로 리셋됨) 다시 파이프라인 트리거
   - `pipeline_runs` 1행 생성 → `current_step` 변화 추적
   - `pipeline_step_results` 5단계(extract, toc, group, embed, mindmap) 각 1행 + status=done
   - `output_summary`에 pages=849, chunks=1999, chapters=N, mindmap=N 들어가는지
4. **실패 시나리오**: Ollama 종료 후 새 문서 업로드 → embed 단계 `failed` + `error_message` 기록 + run.status='failed'
5. **재실행**: `POST /rerun` → 새 runId, 동일 docId의 두 번째 run 생성

## 회귀 테스트 계획

(결과는 `.claude/state/evidence/<task-id>/regression/notes.md` 에 기록)

1. **채팅(SSE 스트리밍)** — 기존 대화 1건 응답 정상 (트래커 추가가 LLM 호출 경로에 영향 없음 확인)
2. **마인드맵 수동 생성** — `POST /api/feynman/mindmap/generate/{docId}` 정상 (자동 디스패치만 트래커 추가했으므로 수동 경로 영향 없음 검증)
3. **인증** — 토큰 갱신 + 보호된 엔드포인트 접근 정상

## 위험과 완화

| 위험 | 완화 |
|---|---|
| 단계 시작/종료 INSERT가 트랜잭션과 얽혀 데드락 | 트래커 메서드는 `Propagation.REQUIRES_NEW`로 짧게 끊음 |
| 파이썬 측 INSERT 실패 시 자바가 모를 수 있음 | step 미기록 = "running" 상태로 남음 → 조회 시 "stale running" 표시 (1차에선 경고만, 2차에 타임아웃 정리) |
| run 동시 실행 제어 부재 | 1차에서는 사용자가 동시에 여러 번 트리거하면 run이 여러 개 생성됨 (도메인상 허용). 동시 실행 제한은 향후 결정 |
