# 설계: 2026-05-02-feynman-cited-nodes

**생성:** 2026-05-02 13:12
**워크트리:** /Users/moon/DevLearn_FE_wt/2026-05-02-feynman-cited-nodes
**브랜치:** task/2026-05-02-feynman-cited-nodes

## 목표
파인만 챗 마인드맵 sources 가 챕터의 전체 노드(예: 89개)를 무차별 노출하던 문제를 해결한다. AI가 응답 말미에 `<refs>[번호, ...]</refs>` 로 실제 사용한 노드 번호를 자가 인용하게 하고, 서버에서 이를 파싱해 그 노드만 출처로 노출한다. 인용이 없거나 파싱 실패면 기존(전체 노드) 폴백.

## 변경 범위

### 백엔드 (DevLearn_BE)
- `feynman/service/FeynmanService.java`
  - `buildMindmapContext(docId, chapter)` 시그니처 변경:
    - 기존: `String` 반환.
    - 변경: 새 record `MindmapCtx(String text, java.util.Map<Integer, String> indexToNodeId)` 반환. 텍스트 각 라인에 `[N]` 인덱스 prefix 부여.
  - `buildFeynmanChatSystemPrompt`: mindmapContext가 비어있지 않으면, 렌더된 템플릿 뒤에 `## 인용 규칙` 섹션을 코드로 append:
    ```
    ## 인용 규칙
    답변의 가장 마지막 줄에 반드시 다음 형식으로, 이번 답변에서 실제로 사용한
    마인드맵 노드의 번호만 명시하세요. 사용하지 않은 노드는 절대 포함하지 마세요.
    형식: <refs>[번호, 번호, ...]</refs>
    예: <refs>[3, 7]</refs>
    하나도 사용하지 않았으면: <refs>[]</refs>
    ```
  - `streamOnDemand` onFinal 콜백:
    - 기존 finalText → `parseRefs(finalText)` 로 `Set<Integer>` 추출.
    - `finalText`에서 `<refs>...</refs>` 매치를 strip.
    - sources 빌드 시 cited indices 가 있으면 mindmap sources를 해당 인덱스로 필터, 없으면(파싱 실패/태그 없음) 폴백으로 전체 노출 유지.
    - `saveAssistantMessage` 와 SSE done 양쪽에 strip된 cleanText 사용.
  - 새 헬퍼:
    - `parseRefs(String text)` — `Pattern.compile("<refs>\\s*\\[([^\\]]*)\\]\\s*</refs>")` 매치 후 콤마 분리, 정수 파싱. 실패 항목은 무시.
    - `stripRefs(String text)` — 위 패턴을 빈 문자열로 치환 후 trailing 공백 정리.
- `feynman/dto/SourceRef.java` 변경 없음.
- DB 시스템 프롬프트(`feynman.chat.mindmap`) 텍스트는 손대지 않음 — 코드에서 append하는 방식.

### 프론트 (DevLearn_FE)
- 변경 없음. 기존 SourcesPopover 가 받는 mindmap sources 개수가 줄어들 뿐 동작 동일.

### 의도적으로 빼는 것 (v1 스코프 외)
- 스트리밍 중 사용자에게 잠깐 노출되는 `<refs>...` 태그 가림(추가 토큰 버퍼링 필요) — 일단 finalText 만 정리. flicker 수용.
- `streamPreGen` 의 cited 처리 — 그쪽은 현재 마인드맵 sources를 emit하지 않으므로 무관.

## 구현 계획
1. FeynmanService 에 `MindmapCtx` record + `buildMindmapContext` 시그니처 변경.
2. `buildFeynmanChatMessages` 호출부 시그니처 맞춤.
3. `buildFeynmanChatSystemPrompt` 에 인용 규칙 섹션 append.
4. `parseRefs` / `stripRefs` 추가.
5. `streamOnDemand` onFinal 에서:
   - parse → strip → filter mindmap sources → addAll RAG sources → emit.
   - saveAssistantMessage 는 cleanText 로.
6. BE 재기동 → 마인드맵 챕터로 진입해 첫 응답에 클립 카드 수가 89 → 소수(예: 2~5)로 줄었는지 확인.
7. `<refs>` 미출력 케이스(LLM 무시) 시뮬레이션: 모델이 안 따를 가능성이 있으므로 폴백 동작 동시에 확인.

## 단위 테스트 계획
- 마인드맵 챕터 진입 → AI 첫 응답 → 클립 라벨이 `마인드맵 N` 의 N 이 한 자리 수 정도로 좁혀졌는지.
- 클립 클릭 → 인용된 노드 카드만 보이는지(전체 노드 X).
- finalText 표시(저장된 메시지)에 `<refs>...</refs>` 가 보이지 않는지.
- 폴백: 만약 LLM이 `<refs>` 출력 안 한 응답이 잡히면 기존처럼 전체 노드가 보이는지.

결과는 `.claude/state/evidence/2026-05-02-feynman-cited-nodes/unit/notes.md`.

## 회귀 테스트 계획
- 마인드맵이 없는 챕터(있다면) → 기존 RAG only 흐름 깨짐 없는지.
- 자동 마인드맵 탭 영향 없음(코드 미접촉).
- 일반 채팅 모드 sources 흐름 영향 없음.

결과는 `.claude/state/evidence/2026-05-02-feynman-cited-nodes/regression/notes.md`.
