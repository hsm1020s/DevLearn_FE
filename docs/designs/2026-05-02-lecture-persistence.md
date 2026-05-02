# 설계: 2026-05-02-lecture-persistence

**생성:** 2026-05-02 13:53
**워크트리:** /Users/moon/DevLearn_FE_wt/2026-05-02-lecture-persistence
**브랜치:** task/2026-05-02-lecture-persistence

## 목표
Phase 1 강의 대본 생성의 단계별/배치별 실행 이력을 DB에 영속화한다. 에러 발생 시 사후 추적(어느 챕터가, 어느 모델로, 언제, 왜 실패했는지)이 가능해야 하고, 서버가 갑자기 죽어도 inflight 상태가 흔적으로 남아야 한다.

## 변경 범위

### 백엔드 (DevLearn_BE)
1. **신규 테이블 2개** (`schema.sql` 추가)
   - `lecture_script_runs` — 챕터별 1행 (재생성 시 새 행 INSERT)
     - `id, user_id, doc_id, chapter, batch_id (NULL 허용), model, status (running|completed|failed), input_tokens, output_tokens, cost_usd, duration_ms, content_chars, script_path, error_code, error_msg, started_at, finished_at, created_at`
     - 인덱스: `(doc_id, chapter, started_at DESC)`, `(user_id, created_at DESC)`, `(batch_id)`
   - `lecture_batch_runs` — 책/과목/단일 단위 일괄 1행
     - `id, user_id, doc_id, scope (book|parent|single), parent_chapter (NULL 허용), target_count, succeeded, failed, skipped, status (running|completed|aborted), started_at, finished_at, created_at`
     - 인덱스: `(user_id, started_at DESC)`, `(doc_id, started_at DESC)`

2. **신규 mapper / DTO** (`com.moon.devlearn.lecture.mapper`)
   - `LectureScriptRunEntity` + `LectureScriptRunMapper` (insertRunning / updateCompleted / updateFailed / findRecentByDoc)
   - `LectureBatchRunEntity` + `LectureBatchRunMapper` (insertRunning / updateCounters / updateFinished)
   - `mapper/lecture/LectureScriptRunMapper.xml`, `LectureBatchRunMapper.xml`

3. **`LectureScriptService` 변경**
   - `streamGenerate(...)` 시작 시 `lecture_script_runs` INSERT (status=running, started_at=now)
   - OpenAI 응답 후 토큰/비용 계산 → UPDATE (status=completed, finished_at, content_chars, tokens, cost_usd, duration_ms, script_path)
   - 예외 시 UPDATE (status=failed, error_code, error_msg, finished_at)
   - 추가 인자 `String batchId` (nullable) 받아서 행에 연결
   - 마인드맵 합성처럼 `llm_call_logs` INSERT 도 함께 (`source="lecture-script"`, `phase="synth"`)
   - 비용 계산은 마인드맵의 `calculateCost` 와 같은 단가 (gpt-5.4-mini: $0.75/1M in, $4.50/1M out)

4. **컨트롤러 추가** (`LectureController`)
   - `POST /lectures/{docId}/batches` — body `{scope, parent?, targetCount}` → `{batchId}` 반환
   - `POST /lectures/batches/{batchId}/finish` — body `{status, succeeded, failed, skipped}` → UPDATE
   - `POST /lectures/{docId}/{chapter}/script/stream` — 기존, body 에 `batchId` 옵션 추가
   - `GET  /lectures/{docId}/runs?limit=50` — 최근 chapter run 이력 (디버깅 / 향후 어드민 화면)

### 프론트 (DevLearn_FE)
- `services/lectureApi.js`
  - 새 함수: `startLectureBatch(docId, scope, parent, targetCount)` → `{batchId}`
  - `finishLectureBatch(batchId, payload)`
  - 기존 `streamLectureScript` 에 `batchId` 옵션 파라미터 추가 → POST body 에 포함
- `AutoMindmapTab.jsx`
  - `runLectureBatch(chaptersToRun)` 시작 시 `startLectureBatch` 호출 → batchId 를 abort + chapterBatchStatus 와 함께 보관
  - 챕터별 streamLectureScript 에 batchId 전달
  - 종료 시 (정상/중단 모두) `finishLectureBatch(batchId, ...)` 호출
- 단일 생성(드로워에서 직접 생성) 도 batchId=null 로 흐름 유지하되, BE 가 자체적으로 run 행은 INSERT/UPDATE 함

### 의도적으로 빼는 것 (스코프 외)
- 서버 재시작 후 inflight 행 자동 cleanup — 추후
- 배치 재시도 시 batch 행 reuse — v1 은 새 batch 행 INSERT (현재 흐름)
- 영상/오디오 단계의 영속화 — 그쪽 Phase 가 들어올 때 동일 패턴으로 확장
- 어드민 UI for 이력 조회 — `/runs` 라우트만 미리 만들어두되 화면은 후속

## 구현 계획
1. schema.sql 에 두 테이블 + 인덱스 추가. 별도 마이그레이션 SQL 도 작성해 즉시 실행.
2. Entity / Mapper / XML 생성 — feynman / mindmap 의 패턴 그대로.
3. LectureScriptService 변경 — INSERT(running) → OpenAI 호출 → UPDATE(completed/failed). llm_call_logs INSERT 추가.
4. LectureController 신규 라우트 추가.
5. lectureApi 새 함수 추가 + AutoMindmapTab batch 흐름에 batchId 통합.
6. 검증.

## 단위 테스트 계획
- 단일 챕터 생성 → `SELECT * FROM lecture_script_runs ORDER BY started_at DESC LIMIT 1` 에 status=completed, tokens > 0, cost_usd > 0, duration_ms > 0, script_path 채워짐.
- `SELECT * FROM llm_call_logs WHERE source='lecture-script' ORDER BY created_at DESC LIMIT 1` 동일 챕터 1행.
- 책 단위 일괄 → batch 행 1개 + runs N개, batch.succeeded + batch.failed = batch.target_count - skipped.
- 강제 실패(예: docId 권한 없음) → run.status='failed' + error_msg 보존, batch 진행 카운터에 failed 반영.
- 서버 강제 종료 시뮬: 생성 도중 BE kill → DB 에 status='running' 행이 남아있는지 확인(stale 흔적).

결과는 `.claude/state/evidence/2026-05-02-lecture-persistence/unit/notes.md`.

## 회귀 테스트 계획
- 기존 강의 단일/일괄 UI 흐름 그대로 동작 (DB 추가만, FE UX 변화 없음 — batchId 추가는 내부 통신만).
- 마인드맵 자동 생성, 파인만 챗 무관.
- 기존 llm_call_logs 의 `mindmap-synth` source 로그는 영향 없음 (source 컬럼만 다름).

결과는 `.claude/state/evidence/2026-05-02-lecture-persistence/regression/notes.md`.
