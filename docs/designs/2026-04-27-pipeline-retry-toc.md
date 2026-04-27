# 설계: 2026-04-27-pipeline-retry-toc

**생성:** 2026-04-27 19:32
**워크트리:** /Users/moon/DevLearn_FE_wt/2026-04-27-pipeline-retry-toc
**브랜치:** task/2026-04-27-pipeline-retry-toc
**선행:** 1차 트래킹 + 1.5차 RAG 분리 + hotfix(toc-fix)

## 목표
파이프라인이 끝난 문서에 대해 **TOC + chapters 그룹핑만 다시 실행**하는 트리거를 추가한다.
TOC 가 자동분할 fallback 으로 끝났거나, OpenAI 모델 결과가 만족스럽지 않을 때 사용자가
명시적으로 다시 시도할 수 있어야 한다.

## 변경 범위

### 수정 (BE)

| 파일 | 변경 |
|------|------|
| `scripts/feynman_pipeline/run_pipeline.py` | `--only-toc` 인자 추가 — toc + group 만 실행 (extract 산출물 재사용) |
| `feynman/service/FeynmanService.java` | `runRetryTocAsync(userId, docId, pdfPath, fileName)` 신규 — `--only-toc` 로 파이썬 호출 |
| `feynman/controller/FeynmanController.java` | `POST /api/feynman/pipeline/{docId}/retry-toc` 엔드포인트 신규 |

### 수정 (FE)

| 파일 | 변경 |
|------|------|
| `src/services/feynmanApi.js` | `retryToc(docId)` 신규 |
| `src/components/feynman/FeynmanPipelineTab.jsx` | completed 카드에 `[TOC 재추출]` 버튼 (보조 스타일). rag_indexed=true 인 카드에서는 클릭 시 토스트 경고 표시 후 진행 |

### 변경 없음 (의도적)

- `pipeline_runs` / `pipeline_step_results` — 1차 스키마 그대로. retry-toc 도 새 run 으로 생성, toc + group 두 단계만 행이 추가됨.
- 마인드맵 자동 디스패치 — `dispatchMindmapSynthesis` 그대로 (toc.json 있으면 디스패치, 없으면 스킵). 멱등 인덱스 `uq_mindmap_doc_chapter` 가 챕터명 단위로 중복 방지.
- DB 스키마 — 추가 컬럼 없음 (이번 차수 단순화).

## 구현 계획

### Step A — Python `--only-toc`

```python
parser.add_argument("--only-toc", action="store_true",
                    help="toc + group 만 재실행 (extract 산출물 재사용, embed 안 함)")
```

분기 (`--only-embed` 옆에 동일 패턴):
```python
if only_toc:
    return _run_only_toc(doc_id, run_id, step_start, step_done, step_fail)
```

`_run_only_toc(doc_id, run_id, ...)`:
1. 디스크 `pages/` 디렉토리에서 페이지 수 카운트 (extractor 결과 재사용)
2. `step_start("toc")` → `extract_toc_with_backoff` → `step_done` 또는 fail
3. 기존 `chapters/*.md` 다 삭제 (낡은 챕터 제거)
4. `step_start("group")` → `group_and_save` → `step_done`
5. update_status(doc_id, "completed", 100) — embed 안 했으니 rag_indexed 는 그대로 둠

### Step B — Java 서비스/컨트롤러

```java
@Async
public void runRetryTocAsync(String userId, String docId, String pdfPath, String fileName) {
    String runId = pipelineTracker.startRun(docId, userId);
    try {
        List<String> command = buildPipelineCommand(docId, userId, runId, pdfPath, fileName,
                /*skipEmbed=*/false, /*onlyEmbed=*/false);
        command.add("--only-toc");
        int exitCode = runPython(docId, command);
        if (exitCode != 0) { pipelineTracker.failRun(...); return; }
        // toc.json 생겼으면 마인드맵 자동 디스패치 (기존 멱등성으로 중복 안 됨)
        dispatchMindmapSynthesis(userId, docId, runId);
        pipelineTracker.completeRun(runId);
    } catch (Exception e) { ... }
}
```

> `buildPipelineCommand` 가 `--skip-embed`/`--only-embed` 플래그를 boolean 으로 받는데
> `--only-toc` 도 같은 방식으로 추가하려면 시그니처 1개 더 늘리는 것보다,
> 호출자가 `command.add("--only-toc")` 하는 게 단순. 위처럼 처리.

```java
@PostMapping("/pipeline/{docId}/retry-toc")
public ApiResponse<Map<String, String>> retryToc(@PathVariable String docId) {
    String userId = getCurrentUserId();
    String[] prepared = feynmanService.validateAndPreparePipeline(userId, docId);
    feynmanService.runRetryTocAsync(userId, docId, prepared[0], prepared[1]);
    return ApiResponse.success(Map.of("docId", docId, "message", "TOC 재추출이 시작되었습니다"));
}
```

### Step C — FE

```js
export async function retryToc(docId) {
  const { data } = await api.post(`/feynman/pipeline/${docId}/retry-toc`);
  return data.data;
}
```

`FeynmanPipelineTab` 카드 우측 액션 영역:
- `doc.status === 'completed'` 일 때 `[TOC 재추출]` 보조 버튼 (회색, 작음)
- `doc.ragIndexed === true` 면 onClick 직전에 `confirm`(또는 토스트 안내):
  "이미 임베딩된 문서입니다. TOC 가 바뀌면 청크 챕터명과 어긋납니다. [임베딩 실행] 으로 재인덱싱 권장. 계속할까요?"
- 진행 중에는 `runningIds` 에 docId 추가 (기존 패턴 재사용)

## 단위 테스트 계획

(`.claude/state/evidence/2026-04-27-pipeline-retry-toc/unit/notes.md`)

1. **빌드**: `./gradlew compileJava` 통과
2. **Python `--help`**: `--only-toc` 노출, `--skip-embed`/`--only-embed` 와 상호 배타
3. **API**: BE 재기동 후 `POST /pipeline/{docId}/retry-toc` → 401 (인증) 또는 200
4. **흐름**:
   - 시스코 네트워킹 (현재 자동분할 41 챕터) 카드에서 [TOC 재추출] 클릭
   - `pipeline_runs` 새 run + `pipeline_step_results` 에 toc + group 2행
   - hotfix 가 적용됐으면 `output_summary={"detected": true}` + toc.json 생성
   - chapters/*.md 갱신 (낡은 자동분할 41개 → 새 의미 단위)
   - 마인드맵 자동 디스패치 → 새 챕터명에 대해 mindmap 추가
5. **상호 배타**: `--only-toc --only-embed` 동시 사용 시 exit 2

## 회귀 테스트 계획

(`.claude/state/evidence/2026-04-27-pipeline-retry-toc/regression/notes.md`)

1. 풀 파이프라인 (디폴트) — 동작 동일
2. `?skipEmbed=true` — 동작 동일
3. embed-only — 동작 동일
4. 1차 트래커 조회 API — 영향 없음
5. 채팅/인증 — 영향 없음

## 위험과 완화

| 위험 | 완화 |
|---|---|
| chapters/*.md 삭제 후 toc 실패하면 chapters 비어있는 상태로 남음 | toc 실패 시 chapters 삭제 안 함 (toc 성공 후 group 직전에 삭제). 트랜잭션 아니라 부분 실패는 가능하지만 chapters/*.md 는 다음 retry-toc 으로 복구 가능 |
| ragIndexed=true 문서가 retry-toc 후 청크 챕터명과 불일치 | FE 가 사전 confirm 으로 사용자 명시 동의 받음. 후속 [임베딩 실행] 가이드 |
| 마인드맵 멱등 인덱스 때문에 새 챕터명으로 추가만 되고 옛 자동분할 챕터 마인드맵 잔존 | 본 차수 범위 외. 사용자가 마인드맵 페이지에서 수동 정리 가능. 향후 차수에서 "TOC 변경 시 자동분할 마인드맵 정리" 검토 |
| BE 또 재기동 부담 | 한 번만 — 이번 hotfix 검증 결과와 함께 |
