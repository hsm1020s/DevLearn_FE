# 설계: 2026-05-02-feynman-source-attribution

**생성:** 2026-05-02 12:48
**워크트리:** /Users/moon/DevLearn_FE_wt/2026-05-02-feynman-source-attribution
**브랜치:** task/2026-05-02-feynman-source-attribution

## 목표
파인만 학습의 매 AI 메시지(질문 / 채점 / 다음 질문)에 어떤 근거로 응답했는지 — `정답세트(사전 모범답안+청크)` vs `벡터검색(실시간 의미유사도)` — 을 사용자가 한눈에 알 수 있도록 출처유형을 명시한다.

배경:
- 백엔드는 이미 SSE done 이벤트에 `sources: SourceRef[]` 를 실어 보내고 있고, 프론트의 `SourcesPopover` 가 메시지마다 📎 아이콘으로 노출 중. 그러나 그 출처가 어떤 경로(사전 정답세트 vs 실시간 벡터검색)인지 라벨이 없어 사용자가 구분 불가.
- 사용자가 답변할 때마다 AI가 무엇을 근거로 채점/질문하는지 명확해야 학습 신뢰도가 올라감.

데이터 차이 요약:
| 경로 | 근거 출처 | similarity | 비고 |
|------|----------|-----------|------|
| pre-gen (`streamPreGen` + `AnswerGraderService.grade`) | `chapter_questions.linked_chunk_ids` (사전 정답세트) | null (개념 매칭) | 모범답안과 함께 채점 근거 |
| on-demand (`streamOnDemand`, `verify`) | pgvector 코사인 유사도 검색 결과 | 0~1 실수 | 실시간 RAG |

현재 FE는 `similarity` 유무로 색상만 다르게 칠할 뿐, 출처 종류 자체는 라벨이 없음.

## 변경 범위

### 백엔드 (DevLearn_BE)
- `feynman/dto/SourceRef.java`
  - `sourceType` (String) 필드 추가. 값: `"goldset"`(사전 정답세트) | `"rag"`(벡터검색).
- `feynman/service/FeynmanService.java`
  - `linkedChunksToSourceRefs(...)` : 각 SourceRef에 `sourceType="goldset"` 세팅.
  - `streamOnDemand` 의 RAG 청크 → SourceRef 변환 지점: `sourceType="rag"` 세팅.
  - 기존 done 이벤트 페이로드 모양은 유지(필드 추가만).
- `verify` 응답의 `VerifyResponse.SourceChunk` 는 별도 DTO로 일회성 응답. 이번 task에서는 손대지 않음(스코프 분리).

### 프론트 (DevLearn_FE)
- `src/components/chat/SourcesPopover.jsx`
  - 트리거 버튼 라벨:
    - 단일 타입 → `정답세트 N` 또는 `벡터검색 N`
    - 혼합 → `정답세트 N · 벡터검색 M`
  - 팝오버 내부: sourceType 별로 섹션 분리. 섹션 헤더에 한 줄 설명 첨부.
  - 카드 한 건의 표시(페이지·스니펫·유사도)는 기존과 동일. 유사도 배지는 `sourceType==='rag'` 일 때만.

다른 호출처 영향 없음: `addMessage(... sources: result.sources ...)` 흐름 그대로 — 필드 한 개만 더 들어옴.

### 의도적으로 빼는 것 (v1 스코프 외)
- "이 메시지 안의 채점 근거" vs "다음 질문 근거" 분리 노출 — `streamPreGen` 이 한 done 이벤트에 채점+다음질문을 합쳐 보내고 sources는 다음 질문 기준만 채워짐. 분리하려면 SSE 이벤트 분할 또는 sources 그룹화 도입 필요. v2.

## 구현 계획
1. `SourceRef.java` 에 `sourceType` 필드 추가.
2. `linkedChunksToSourceRefs` 에 `.sourceType("goldset")` 추가.
3. `streamOnDemand` 의 SourceRef 빌더에 `.sourceType("rag")` 추가.
4. FE `SourcesPopover.jsx` :
   - props 그대로 (`sources`).
   - 내부에서 `goldset`/`rag` 두 그룹으로 분류.
   - 트리거 버튼 라벨/혼합 표기 갱신.
   - 팝오버 안에 섹션 헤더 + 그룹별 카드 리스트.
5. dev 서버 + BE 재기동 → 브라우저 검증.

## 단위 테스트 계획
- pre-gen 챕터 진입 → 첫 질문 메시지 클립 라벨이 `정답세트 N` 으로 표시.
- 사용자가 답변 → 채점+다음질문 메시지가 와도 클립 라벨이 `정답세트 N` 유지.
- on-demand 챕터(chapter_questions 비어있는 챕터) → 클립 라벨 `벡터검색 N`, 카드에 유사도 % 배지 노출.
- 클립 클릭 → 팝오버 안에 섹션 헤더("정답세트" / "벡터검색")와 설명 한 줄이 보이는지.
- 카드 클릭 → 기존 SourceDetailModal 정상 오픈.

결과는 `.claude/state/evidence/2026-05-02-feynman-source-attribution/unit/notes.md`.

## 회귀 테스트 계획
- 일반 채팅(파인만 외) 모드의 RAG 답변 — BE에서 sourceType을 안 채우는 경로가 있으면 FE 폴백 동작 확인. 폴백: sourceType 없으면 라벨 생략하고 기존처럼 "근거 N건"으로 표시.
- 마인드맵 자동 생성/캔버스 동작에는 영향 없음.
- 자격증 RAG 모드 채팅(있다면)에서 source 표시 정상.

결과는 `.claude/state/evidence/2026-05-02-feynman-source-attribution/regression/notes.md`.
