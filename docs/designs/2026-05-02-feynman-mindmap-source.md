# 설계: 2026-05-02-feynman-mindmap-source

**생성:** 2026-05-02 13:04
**워크트리:** /Users/moon/DevLearn_FE_wt/2026-05-02-feynman-mindmap-source
**브랜치:** task/2026-05-02-feynman-mindmap-source

## 목표
파인만 채팅에서 마인드맵 노드가 실질적 grounding 으로 들어가는 경로(`5d24e76` 이후 `feynman.chat.mindmap` 시스템 프롬프트)에서, 그 마인드맵 노드들을 출처(SourceRef)로 함께 노출해 사용자가 어떤 노드를 근거로 AI가 말하는지 볼 수 있게 한다.

배경:
- 현재 `streamOnDemand` 가 sources 로 변환하는 대상은 RAG 청크뿐. `rag_chunks` 가 비어있으면 sources 도 비어 클립이 안 보임.
- 하지만 `buildFeynmanChatMessages` 내부에서 `buildMindmapContext(docId, chapter)` 가 호출되어 마인드맵 노드를 시스템 프롬프트에 주입 중. 이게 사용자 질문/답변의 실제 grounding 인데 UI 에 노출되지 않음.
- 결과: AI 가 마인드맵 기반으로 답하지만 사용자는 "어디서 나온 말이지?" 알 수 없음 — 직전 task의 sourceType 라벨링 효과가 사라짐.

## 변경 범위

### 백엔드 (DevLearn_BE)
- `feynman/service/FeynmanService.java`
  - 새 헬퍼 `mindmapNodesToSourceRefs(docId, chapter)` 추가 — 챕터의 마인드맵 노드를 SourceRef 리스트로 변환:
    - `docName` = "마인드맵 · {chapter}"
    - `page` = `node.depth` (정수, 깊이 표시)
    - `snippet` = `node.label` + (description 있으면 `: {description}`)
    - `similarity` = null
    - `rank` = depth+seq 기반 순서
    - `sourceType` = `"mindmap"`
  - `streamOnDemand` 의 sources 빌드 지점:
    - 기존: `List<SourceRef> sourceRefs = toSourceRefs(rag.chunks());`
    - 변경: 위에 마인드맵 sources 도 합쳐서 emit (마인드맵 sources 가 먼저, RAG sources 가 뒤).

### 프론트 (DevLearn_FE)
- `src/components/chat/SourcesPopover.jsx`
  - `TYPE_META` 에 `mindmap` 항목 추가:
    - label: `"마인드맵"`
    - desc: `"면접 질문이 참조한 마인드맵 노드"`
    - Icon: `BrainCircuit` (lucide-react)
  - 트리거 라벨 / 그룹 정렬 / 폴백 분기에 `mindmap` 케이스 포함.
  - 트리거 아이콘 우선순위: mindmap > goldset > rag (마인드맵 단독 케이스에서는 BrainCircuit 표시).

### 의도적으로 빼는 것
- pre-gen 경로(`streamPreGen`)에는 이미 goldset 청크가 있고 마인드맵 노드 추가는 v2.
- 마인드맵 노드 카드의 클릭 → SourceDetailModal 동작은 기존 props 그대로(label/description 만 보임). 모달 UI 별도 손질은 v2.

## 구현 계획
1. `FeynmanService.java` 에 `mindmapNodesToSourceRefs(docId, chapter)` 헬퍼 추가 (`buildMindmapContext` 와 비슷한 데이터 접근).
2. `streamOnDemand` 에서 RAG sources + 마인드맵 sources 합쳐서 done 이벤트 emit.
3. FE `SourcesPopover.jsx` 의 `TYPE_META` 에 `mindmap` 추가 + 그룹 순회 배열 + 트리거 라벨/아이콘 분기.
4. dev 서버 + BE 재기동 → 브라우저 검증.

## 단위 테스트 계획
- 마인드맵이 있는 챕터(현재 DAP 의 일부) → 파인만 챗 진입 → 첫 응답 메시지의 클립 라벨이 `마인드맵 N` (또는 마인드맵+RAG 혼합) 으로 표시되는지.
- 클립 클릭 → 팝오버 안에 "마인드맵" 섹션이 보이고, 카드에 노드 라벨/설명이 표시되는지.
- 마인드맵 없는 챕터(있다면) → 기존 RAG only 동작 유지(혹은 라벨 없는 폴백).

결과는 `.claude/state/evidence/2026-05-02-feynman-mindmap-source/unit/notes.md`.

## 회귀 테스트 계획
- 자동 마인드맵 탭(같은 mindmap_nodes 데이터 사용) 챕터 트리/그룹핑 영향 없는지.
- 일반 채팅(파인만 외) 모드 sources 표시 — 폴백 분기 그대로 유지되는지.
- 직전 task 기능(sourceType goldset/rag 라벨)이 깨지지 않는지.

결과는 `.claude/state/evidence/2026-05-02-feynman-mindmap-source/regression/notes.md`.
