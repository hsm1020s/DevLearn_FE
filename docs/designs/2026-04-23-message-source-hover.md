# 설계: 2026-04-23-message-source-hover

**생성:** 2026-04-23 16:02
**워크트리:** /Users/moon/DevLearn_FE_wt/2026-04-23-message-source-hover
**브랜치:** task/2026-04-23-message-source-hover

## 목표
이전 태스크(rag-source-panel)에서 만든 **우측 고정 출처 패널을 제거**하고, 각 AI 메시지 버블에 **출처 버튼**을 달아 클릭하면 팝오버로 그 메시지의 근거가 뜨게 한다. 팝오버 안의 각 카드를 클릭하면 전체 원문을 보는 모달이 뜬다.

### 합의된 UX 결정
1. 우측 패널 → **A. 호버 버튼으로 대체** (패널/2-pane 레이아웃 제거)
2. 트리거 → **b. 클릭 토글** (외부 클릭 시 닫힘, 텍스트 복사 가능)
3. 카드 클릭 → 원문 전체 모달

### 기존 자산 재활용
BE 쪽(SSE done 에 sources 포함, message_sources 스냅샷 저장)과 프론트의 sources 수신 경로는 그대로 둔다. 변경은 FE 컴포넌트/레이아웃/스토어에 국한.

## 변경 범위

### 신설
- `src/components/chat/SourcesPopover.jsx` — 버튼 + 팝오버.
  - props: `sources: SourceRef[]`
  - 내부 state: `isOpen`, `modalSource`; 외부 클릭 시 닫기 (useEffect + ref)
  - 버튼: Paperclip 아이콘 + 개수 배지(예: "3")
  - 팝오버: 버블 하단 anchor, 최대 높이 320px overflow-y-auto
  - 카드 클릭 시 `SourceDetailModal` 을 자체 state 로 연다
- `src/components/chat/SourceDetailModal.jsx` — 카드 클릭 시 원문 전체 모달
  - props: `source: SourceRef | null`, `onClose()`
  - source 가 null 이면 렌더 안 함, 있으면 backdrop + 카드 + ESC/외부클릭으로 닫기

### 수정
- `src/components/chat/ChatMessage.jsx`
  - assistant 메시지이고 `message.sources?.length > 0` 이면 버블 하단 액션 영역(복사 버튼 옆)에 `<SourcesPopover sources={...} />` 렌더
  - 이전 태스크에서 도입한 `hideInlineSources` / `isSelected` / `onSelect` props 삭제 + 클릭 선택 로직 제거
  - 기존 `SourceCard` 인라인 렌더 블록 삭제 (팝오버가 담당)
- `src/components/study/StudyChatTab.jsx`
  - RAG 세션 판별(`isRagSession`) 기반 2-pane 레이아웃 제거, 기존 단일 칼럼으로 복귀
  - `FeynmanSourcePanel` import/렌더 제거
  - `selectedMessageId/selectMessage` 구독 제거
- `src/stores/useChatStore.js`
  - `selectedMessageId` state + `selectMessage` action 제거, `setCurrentConversation`/`reset` 에서 참조 제거

### 삭제
- `src/components/feynman/FeynmanSourcePanel.jsx` — 더 이상 사용처 없음
- `src/components/chat/SourceCard.jsx` — 사용처 없어지면 삭제 (확인 후)

### 미변경
- BE 전체 (SourceRef / StreamEvent / FeynmanService / message_sources 스키마)
- `feynmanApi.js`, `useStreamingChat.js` (sources 수신 경로)
- 일반 채팅 경로 (애초에 sources 없으니 버튼도 안 뜸)

## 구현 계획

### Step 1 — SourceDetailModal
1. backdrop + 중앙 카드, 헤더(문서명 · 페이지), 본문(스니펫/chunk 전체), 유사도 배지, 닫기 버튼
2. ESC 키 / backdrop 클릭 / 닫기 버튼 → `onClose()`
3. z-index 는 팝오버(z-40) 위(z-50)

### Step 2 — SourcesPopover
1. 루트 `div` 에 `ref` + 외부 클릭 감지 useEffect
2. 트리거 버튼: `Paperclip` 아이콘 + `sources.length` 뱃지
3. 열리면 버튼 바로 아래 `absolute` 팝오버, 카드 목록 (문서명 / p.N / 유사도 / 스니펫 clamp)
4. 카드 클릭 → 자체 state `modalSource` 로 `SourceDetailModal` 노출
5. 접근성: `aria-expanded`, `aria-haspopup`, 버튼 초점 관리

### Step 3 — ChatMessage 통합
1. 복사 버튼 행에 `{!isUser && message.sources?.length > 0 && <SourcesPopover sources={...} />}` 삽입
2. 이전 태스크의 클릭 선택/링/hideInlineSources 경로 제거
3. SourceCard 인라인 렌더 블록 제거

### Step 4 — StudyChatTab 축소
1. 2-pane wrapper(`flex-row`) / inner wrapper 삭제 → 기존 `flex-col`
2. `FeynmanSourcePanel` import·렌더 삭제
3. 이전 태스크에서 추가한 useStudyStore feynmanDocId/feynmanChapter/useChatStore selectedMessageId 구독 제거
4. ChatMessage prop 패스다운 원복

### Step 5 — 스토어/컴포넌트 정리
1. `useChatStore.selectedMessageId/selectMessage` 완전 제거
2. FeynmanSourcePanel.jsx 삭제 + grep 으로 참조 없는지 확인
3. SourceCard.jsx 참조 검색 — 사용처 없으면 삭제

## 단위 테스트 계획
- 각 assistant 메시지 버블 하단에 출처 버튼이 `sources.length > 0` 일 때만 렌더되는지
- 버튼 클릭 → 팝오버 열림 / 다시 클릭 → 닫힘 / 외부 클릭 → 닫힘
- 팝오버 카드 클릭 → 모달 열림, ESC / backdrop / X 버튼 → 닫힘
- 일반 채팅 모드에서 sources 없는 메시지에 버튼 자체가 없는지
- useChatStore 에 `selectedMessageId` 잔존 참조 없는지 (grep)
- 새로고침 후에도 로컬캐시에서 복원된 메시지의 버튼이 정상인지

결과는 `.claude/state/evidence/2026-04-23-message-source-hover/unit/notes.md`.

## 회귀 테스트 계획
- 일반 채팅 (sources 없음): 레이아웃 변화 없이 동작
- 자격증 퀴즈 생성/풀이: 영향 없음 (별도 경로)
- 마인드맵: 영향 없음
- 파인만 학습(RAG): 버블 옆 📎 버튼으로 출처 접근 가능, 이전의 우측 패널이 안 보여야 함

결과는 `.claude/state/evidence/2026-04-23-message-source-hover/regression/notes.md`.
