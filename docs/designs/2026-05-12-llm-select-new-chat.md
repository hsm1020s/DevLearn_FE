# 설계: 2026-05-12-llm-select-new-chat

**생성:** 2026-05-12 14:52
**워크트리:** /Users/moon/DevLearn_FE_wt/2026-05-12-llm-select-new-chat
**브랜치:** task/2026-05-12-llm-select-new-chat

## 목표
사이드바 LLM 드롭다운에서 사용자가 모델을 **새로 선택**하는 순간, 그 모델로 **새 채팅 한 건이 자동으로 열리도록** 만든다. 매번 "새 채팅" 버튼을 따로 누르는 단계를 제거해 UX를 줄인다.

요건:
1. 드롭다운에서 LLM을 바꾸면 `createConversation(mainMode, picked)` 가 실행되고 그 대화가 활성 대화가 된다(또는 EmptyChatView → 첫 메시지로 시작하는 기존 "새 채팅" 흐름과 동일).
2. **대화 전환 등으로 인한 프로그래밍적 동기화**(useEffect/handleSelectConversation 에서 `selectLLM(conv.llm)` 호출)는 새 채팅을 만들지 **않는다** — 안 그러면 다른 대화를 클릭할 때마다 빈 대화가 끝없이 생긴다.
3. 같은 LLM을 다시 고르는 경우(value 동일) no-op.
4. 클라우드 전용 환경에서 로컬 모델을 골랐을 때 발생하는 폴백(`setLLM` 가 `{ ok:false, fallback }` 반환) 시: 안내 Toast는 그대로, 새 채팅은 **폴백된 실제 모델**로 생성.

## 변경 범위
- `src/components/layout/Sidebar.jsx` 만 수정 (단일 파일)
  - 기존 `selectLLM(llm)` 콜백은 그대로 두고(동기화 경로 전용), 드롭다운 `onChange` 전용으로 새 핸들러 `handleLLMDropdownChange` 추가
  - LLM 드롭다운의 `onChange` prop을 `selectLLM` → `handleLLMDropdownChange` 로 교체

스토어/유틸/다른 컴포넌트 변경 없음. 영향 범위가 작아 회귀 표면이 좁다.

### 모드별 분기 (중요)
공부/업무학습 모드는 좌우 분할이고, 좌측 일반 채팅은 `currentConversationId` 가 아니라 `splitConversationIds[mode].left` 슬롯을 활성 대화로 사용한다. 따라서 LLM 드롭다운으로 새 채팅을 띄우려면 모드별로 다른 store 액션을 호출해야 한다:
- **일반 모드:** `createConversation(mainMode, llm)` — `currentConversationId` 갱신 → `ChatContainer` 가 빈 화면 표시
- **공부/업무학습 모드:** `createSplitConversation(mainMode, llm, 'left')` — split 좌 슬롯 갱신 → `GeneralChatPane` 이 빈 화면 표시. 우측 파인만 슬롯은 건드리지 않아 진행 중인 파인만 세션을 보존한다.

## 구현 계획
1. `Sidebar.jsx` 내부에 `handleLLMDropdownChange(picked)` 를 정의:
   - `picked === selectedLLM` 이면 return (no-op)
   - `setLLM(picked)` 호출 → 결과 객체 분기:
     - `ok === false && reason === 'local-llm-disabled'` 이면 기존 안내 Toast 노출, store 의 `selectedLLM` 은 이미 폴백 모델로 갱신되어 있으니 `useAppStore.getState().selectedLLM` 으로 최종 모델 읽어옴
     - 그 외에는 `picked` 가 그대로 최종 모델
   - `createConversation(mainMode, finalLLM)` 호출 — 새 대화 생성 + 활성화
   - `clearMessages()` 호출 — 기존 "새 채팅" 패턴과 동일하게 currentConversationId 를 null 로 떨어뜨려 EmptyChatView 표시(첫 메시지 입력 시 `useStreamingChat.ensureConversation` 가 lazy 생성). 이 부분은 기존 `handleNewConversation` 와 똑같이 맞춘다.
   - 모바일 사이드바가 열려 있으면 닫음
2. LLM Dropdown 의 `onChange={selectLLM}` 을 `onChange={handleLLMDropdownChange}` 로 변경. 그 외 `selectLLM` 호출 위치(useEffect 의 동기화, handleSelectConversation 의 동기화)는 손대지 않는다.
3. `@fileoverview` 주석에 LLM 선택 시 새 채팅 자동 생성 동작 한 줄 추가 — 다른 사람이 동작을 쉽게 추적할 수 있도록.

## 단위 테스트 계획
실 브라우저에서 다음 시나리오 확인:
1. 빈 상태(EmptyChatView)에서 GPT 선택 → 새 채팅 생성됨(사이드바 목록 상단), 모델 라벨이 "GPT-5.4 mini" 로 보임, 입력창은 비어 있음.
2. 활성 대화가 있는 상태에서 다른 LLM 선택 → 사이드바에 새 채팅이 추가되고, 직전 대화로 화면이 되돌아가지 않으며 EmptyChatView 노출.
3. 같은 LLM 재선택 → 아무 변화 없음(새 채팅 미생성).
4. 사이드바에서 기존 대화를 클릭 → 그 대화의 LLM 으로 드롭다운이 동기화되지만 새 채팅이 추가되지 않음(동기화 경로가 손상되지 않았음).
5. 새 채팅 입력란에 메시지를 보내면 정상 스트리밍, 그 대화의 모델이 방금 선택한 LLM 으로 기록.

## 회귀 테스트 계획
- 마인드맵 토글 ON/OFF 정상 동작 확인.
- 문서 업로드 모달 열기/닫기.
- 모드(메인 모드) 변경 시 conversations 필터 정상.
- 로그아웃/로그인 흐름.
