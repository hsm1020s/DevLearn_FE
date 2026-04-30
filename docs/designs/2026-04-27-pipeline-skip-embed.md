# 설계: 2026-04-27-pipeline-skip-embed

**생성:** 2026-04-27 18:24
**워크트리:** /Users/moon/DevLearn_FE_wt/2026-04-27-pipeline-skip-embed
**브랜치:** task/2026-04-27-pipeline-skip-embed
**선행:** 1차 pipeline-step-tracking (트래커 테이블 + run/step 트래킹)

## 목표
파이프라인에 두 가지 옵션을 추가한다:
**(1) RAG 분리** — 임베딩(Step 3) 빼고 extract/toc/group/mindmap 까지만 돌리고, 나중에 별도 트리거로 embed 만 실행.
**(2) TOC 추출 정확도 개선** — Ollama gpt-oss:20b → OpenAI gpt-5.4-mini 로 교체 (목차 누락/오추출 줄임).

두 변경 모두 파이프라인 옵션 영역이라 같은 차수로 묶는다.

## 변경 범위

### 수정 (BE)

| 파일 | 변경 |
|------|------|
| `schema.sql` | `rag_docs.rag_indexed BOOLEAN DEFAULT false` 컬럼 추가 + 기존 completed 문서 백필 |
| `feynman/mapper/FeynmanMapper.{java,xml}` | `setRagIndexed(docId, indexed)` 추가 |
| `scripts/feynman_pipeline/run_pipeline.py` | `--skip-embed` / `--only-embed` 인자 추가, 단계 가드 |
| `scripts/feynman_pipeline/embedder.py` | 마지막 UPDATE 에 `rag_indexed=true` 추가 |
| `scripts/feynman_pipeline/toc_extractor.py` | TOC LLM 호출을 Ollama → **OpenAI gpt-5.4-mini** 로 교체 (`requests` 로 OpenAI Chat Completions API 호출) |
| `feynman/service/FeynmanService.java` | `runPipelineAsync(..., RunOptions)` 시그니처 추가, 파이썬에 인자 전달, `dispatchQuestionSynthesis` 가드 |
| `feynman/controller/FeynmanController.java` | 트리거 엔드포인트에 `?skipEmbed=true` 쿼리 파라미터, 별도 `POST /api/feynman/pipeline/{docId}/embed` 엔드포인트 |
| `feynman/dto/DocResponse.java` | `ragIndexed` 필드 추가 |

### 수정 (FE)

| 파일 | 변경 |
|------|------|
| `src/services/feynmanApi.js` | `runPipeline(docId, {skipEmbed})` + 신규 `runEmbedOnly(docId)` |
| `src/components/feynman/FeynmanPipelineTab.jsx` | "임베딩 없이 실행" 토글/버튼 + rag_indexed=false 카드에 "임베딩 실행" 액션 노출 |

## 구현 계획

### Step A — DDL + 백필
```sql
ALTER TABLE rag_docs ADD COLUMN IF NOT EXISTS rag_indexed BOOLEAN NOT NULL DEFAULT false;
UPDATE rag_docs SET rag_indexed = true
 WHERE status = 'completed' AND chunks > 0;
```

### Step B — TOC 추출을 OpenAI 로 교체
`toc_extractor.py` 의 `_call_ollama` 를 `_call_openai` 로 교체:

```python
import os
import requests

OPENAI_BASE = os.environ.get("OPENAI_BASE_URL", "https://api.openai.com/v1")
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")
TOC_MODEL = os.environ.get("TOC_MODEL", "gpt-5.4-mini")

def _call_openai(system: str, user: str) -> str:
    if not OPENAI_API_KEY:
        raise RuntimeError("OPENAI_API_KEY 환경변수가 없습니다")
    job_id = emit_started("pipeline-toc", TOC_MODEL, "extract-toc",
                          target="", input_chars=len(user or ""))
    try:
        resp = requests.post(
            f"{OPENAI_BASE}/chat/completions",
            headers={
                "Authorization": f"Bearer {OPENAI_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": TOC_MODEL,
                "messages": [
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ],
                "temperature": 0.1,
                # JSON 모드로 받기 — 모델이 JSON 만 출력하도록 강제
                "response_format": {"type": "json_object"},
            },
            timeout=LLM_TIMEOUT_SEC,
        )
        resp.raise_for_status()
        data = resp.json()
        content = data["choices"][0]["message"]["content"]
        emit_finished(job_id, output_chars=len(content or ""))
        return content
    except Exception as e:
        emit_failed(job_id, str(e))
        raise
```

**프롬프트 변경**: OpenAI `response_format=json_object` 모드는 출력이 객체여야 하므로, 사용자 프롬프트에 "Return JSON object with key 'chapters' (array)" 명시. `_parse_and_validate` 가 이미 dict 안의 array를 흡수하므로 호환.

### Step C — Python `--skip-embed` / `--only-embed`
```python
parser.add_argument("--skip-embed", action="store_true",
                    help="임베딩 단계 건너뛰기 — extract/toc/group 까지만")
parser.add_argument("--only-embed", action="store_true",
                    help="embed 단계만 실행 — 디스크 산출물(chapters/) 이 이미 있어야 함")
```

분기:
- `--only-embed`: extract/toc/group 스킵 → 바로 embed_and_store + (자바 측) 후속 처리
- `--skip-embed`: Step 3 건너뜀, 마지막에 status='completed' / progress=100 / **rag_indexed=false** 로 set
- 기본: 풀 파이프라인, embedder.py 가 rag_indexed=true 로 set

### Step D — Java 옵션
```java
@Async
public void runPipelineAsync(String userId, String docId, String pdfPath,
                             String fileName, boolean skipEmbed) { ... }

// 기존 시그니처 위임
public void runPipelineAsync(String userId, String docId, String pdfPath, String fileName) {
    runPipelineAsync(userId, docId, pdfPath, fileName, false);
}

@Async
public void runEmbedOnlyAsync(String userId, String docId, String pdfPath, String fileName) {
    // run 1건 시작 → 파이썬 --only-embed → 후속(질문 합성) 디스패치
}
```

`dispatchMindmapSynthesis` 는 그대로 (마인드맵은 임베딩 무관).
`dispatchQuestionSynthesis` 는 `if (!skipEmbed)` 로 가드 — 청크 없으면 무의미.

### Step E — Controller
```java
@PostMapping("/pipeline/{docId}")
public ApiResponse<...> startPipeline(
        @PathVariable String docId,
        @RequestParam(value="skipEmbed", defaultValue="false") boolean skipEmbed) {
    ...
    feynmanService.runPipelineAsync(userId, docId, pdfPath, fileName, skipEmbed);
}

@PostMapping("/pipeline/{docId}/embed")
public ApiResponse<...> embedOnly(@PathVariable String docId) {
    ...
    feynmanService.runEmbedOnlyAsync(userId, docId, pdfPath, fileName);
}
```

### Step F — DTO + FE
- `DocResponse.ragIndexed` 추가 → fetchAllDocs/fetchDocsPage 응답에 자동 포함
- `feynmanApi.runPipeline(docId, {skipEmbed})` / `runEmbedOnly(docId)`
- `FeynmanPipelineTab` 업로드 후 카드 액션:
  - 미실행: [파이프라인 실행] [임베딩 없이 실행]
  - completed && !ragIndexed: [임베딩 실행] 버튼 추가 + "임베딩 미적재" 뱃지
  - completed && ragIndexed: 기존 그대로

## 단위 테스트 계획

(`.claude/state/evidence/2026-04-27-pipeline-skip-embed/unit/notes.md`)

1. **DDL + 백필**: `\d rag_docs` 컬럼 확인, 기존 completed 문서들 rag_indexed=true 보정 확인
2. **OpenAI TOC 추출 단독 실행**:
   - `python3 toc_extractor.py --doc-id <기존 docId>` (디스크에 pages/ 있는 문서 — SQL전문가가이드)
   - toc.json 생성 + chapters 누락 없는지 비교 (이전 Ollama 결과와 차이)
   - 비용 확인 (mini 모델 입력 ~30페이지)
3. **`--skip-embed`**: 정리된 SQL전문가가이드 PDF 로 실행 → status='completed', rag_indexed=false, rag_chunks 0개
4. **`--only-embed`**: 위 결과로 실행 → rag_chunks 적재 + rag_indexed=true
5. **트래커 (1차 차수와 결합)**: 두 실행이 별 run 으로 기록되는지 + step 행 확인
6. **마인드맵 자동 디스패치**: skip-embed 후에도 마인드맵 자동 생성됨 확인
7. **API**: `POST /pipeline/{docId}?skipEmbed=true` + `POST /pipeline/{docId}/embed` 정상 응답
8. **빌드**: `./gradlew compileJava` 통과

## 회귀 테스트 계획

(`.claude/state/evidence/2026-04-27-pipeline-skip-embed/regression/notes.md`)

1. **풀 파이프라인 디폴트** (`?skipEmbed=false`): 동작 동일, rag_indexed=true 로 자동 set
2. **rerun 엔드포인트** (1차): 옵션 없이 호출 시 디폴트 풀 실행
3. **인증/채팅/마인드맵 수동 생성**: 영향 없음
4. **이미 indexed 문서로 embed-only 호출**: 멱등 (DELETE+INSERT) — 기존 동작
5. **OpenAI 키 미설정 환경**: TOC 단계 실패 — fallback(자동분할) 정상 동작 확인 (toc 단계 status='done' + summary={detected:false, fallback:auto_split})

## 위험과 완화

| 위험 | 완화 |
|---|---|
| 기존 PDF 들의 rag_indexed 가 모두 false 표시 | DDL Step A 에 백필 UPDATE 포함 |
| `gpt-5.4-mini` 가 잘못된 모델 ID 일 가능성 | 환경변수 `TOC_MODEL` 로 오버라이드 가능. 1차 실행에서 OpenAI 응답 코드/메시지 확인 후 정확한 ID 로 조정 |
| OpenAI 호출 비용 증가 | mini 모델 + 30페이지 입력 → 호출당 매우 저렴 (~수 센트). TOC 추출은 문서당 1회 + 5회 재시도 상한 그대로 유지 |
| OpenAI 키 미설정 환경에서 폴백 | `_call_openai` 가 RuntimeError 발생 → 5회 백오프 후 toc.json 미생성 → group_chapters 가 자동분할 폴백 (기존 동작 유지) |
| skipEmbed=true 인 채로 채팅 시 RAG 컨텍스트 비어있음 | feynman streamChat 의 buildRagContext 가 빈 청크 처리 가능 — 답변 품질만 저하. 본 차수 가드 안 함, FE 카드 뱃지로 인지 |
| OpenAI JSON 모드로 array 받을 수 없음 | `response_format=json_object` 사용 + 프롬프트에 `{"chapters": [...]}` 형식 지시. `_parse_and_validate` 가 이미 dict 안의 array 흡수하므로 변경 불필요 |
