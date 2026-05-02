# 설계: 2026-05-02-split-learning-workspace

**생성:** 2026-05-02 17:39
**워크트리:** /Users/moon/DevLearn_FE_wt/2026-05-02-split-learning-workspace
**브랜치:** task/2026-05-02-split-learning-workspace

## 목표
공부 모드와 업무학습 모드의 채팅 탭을 **좌우 분할(Split)** 디폴트로 바꾼다.
- **좌측:** 일반 채팅 (스타일 = `general` 고정)
- **우측:** 파인만 채팅 — 진입 시 자동 트리거하지 않고, 챕터 선택 후 **[▶ 파인만 시작]** 버튼을 눌러야 첫 질문이 시작된다.
- **파인만 종료 시:** 우측 패널은 "시작 전" 상태(챕터 선택 + 시작 버튼)로 되돌아간다.

좌·우 두 채팅은 **서로 다른 대화(conversation)** 를 사용한다 — 같은 화면에서 동시에 메시지를 주고받을 수 있어야 한다.

## 변경 범위

### 신규 파일
- `src/components/study/SplitLearningWorkspace.jsx` — 좌우 분할 컨테이너 (학습 스타일 칩 자리에 표시 라벨, 가운데 리사이즈 핸들 placeholder)
- `src/components/study/GeneralChatPane.jsx` — 좌측 일반 채팅 패널
- `src/components/study/FeynmanChatPane.jsx` — 우측 파인만 채팅 패널 (시작 전/진행 중 두 상태)

### 수정 파일
- `src/stores/useChatStore.js`
  - `splitConversationIds: { study: {left, right}, worklearn: {left, right} }` 슬롯 추가 (persist)
  - `setSplitConversationId(mode, paneKey, id)` 액션
  - `addMessageTo(convId, message)` — 현재 대화가 아닌 특정 대화에 메시지 push
  - persist version bump (4 → 5) + migrate에서 빈 슬롯 주입
- `src/hooks/useStreamingChat.js`
  - 두 번째 인자로 옵션 객체 `{ paneKey, autoStartFeynman, manualStartFeynmanRef }` 수용
  - `paneKey`가 있으면 `splitConversationIds[mode][paneKey]`를 currentConversationId 대신 사용
  - `addMessage` 호출을 `paneKey`일 때 `addMessageTo(splitConvId, ...)`로 분기
  - `createConversation` 후 `setSplitConversationId`로 슬롯 갱신
  - `autoStartFeynman === false`면 파인만 자동 첫 질문 useEffect를 건너뜀
  - 외부에서 명시적 트리거를 위해 `startFeynmanSession()` 함수를 반환 (우측 [▶ 시작] 버튼이 호출)
- `src/components/study/StudyWorkspace.jsx` — `chat` 탭일 때 기존 `<StudyChatTab/>` 대신 `<SplitLearningWorkspace mode="study" />` 렌더
- `src/components/worklearn/WorkLearnMode.jsx` — `<SplitLearningWorkspace mode="worklearn" />` 렌더

### 영향 받지 않음 (의도적 보존)
- 기존 `StudyChatTab.jsx` — 단일 모드 폴백/모바일 폴백을 위해 보존(미사용 처리는 후속). 지금은 import만 남겨둔다.
- 일반 모드(`general`) — 변경 없음.
- 단일 모드의 파인만 칩(`StudyStyleChips`) — 변경 없음. split 컨테이너에서는 칩 컴포넌트를 사용하지 않고 자체 라벨을 표시.

## 구현 계획

### Step 1. Store 확장
1. `useChatStore`에 `splitConversationIds` 슬롯 + 액션 추가
2. `addMessageTo(convId, message)` 추가 — 기존 `addMessage`는 그대로
3. persist v5 migrate 추가

### Step 2. 훅 옵션 추가
4. `useStreamingChat(mode, options?)` 시그니처 확장
5. paneKey 분기: messages 소스 / addMessage 분기 / createConversation 후 슬롯 갱신
6. `autoStartFeynman` 옵션으로 자동 트리거 useEffect 우회
7. 반환값에 `startFeynmanSession()` (외부 명시적 트리거) 추가

### Step 3. 컴포넌트 작성
8. `GeneralChatPane` — 좌측, paneKey='left', 항상 일반 채팅 (style='general' 고정)
9. `FeynmanChatPane` — 우측, paneKey='right', autoStartFeynman=false
   - 시작 전: `FeynmanChapterPicker` 인라인(헤더에서 토글) + [▶ 파인만 시작] 버튼
   - 시작 후: 채팅 + 헤더에 챕터 + [✕ 종료] 버튼
   - 종료 클릭 → `clearFeynmanSession()` + 우측 split conv id 해제 → 시작 전 화면 복귀
10. `SplitLearningWorkspace` — 좌(50%) | 가운데 핸들 | 우(50%)

### Step 4. 진입점 교체
11. `StudyWorkspace` 채팅 탭 → `<SplitLearningWorkspace mode="study" />`
12. `WorkLearnMode` → `<SplitLearningWorkspace mode="worklearn" />`

## 단위 테스트 계획
- 좌측 일반 채팅: 메시지 전송 → 좌측에만 추가, 우측 영향 없음
- 우측 시작 전: 챕터 선택 안 한 상태에서 [▶ 시작] 버튼 비활성, 입력창 비활성/숨김
- 우측 챕터 선택 후 [▶ 시작] 클릭: 새 대화 생성 + AI 첫 질문 자동 도착, 좌측은 그대로
- 우측 [✕ 종료] 클릭: 우측만 시작 전 화면으로 복귀, 좌측 일반 채팅 메시지 유지
- 좌·우 동시 스트리밍 가능 여부 확인 (한 쪽 스트리밍이 다른 쪽 입력을 막지 않아야 함 — `isStreaming`은 store 단일 값이므로 split 환경에선 paneKey 단위로 분리 필요. 단위 테스트에서 검증한 뒤 필요 시 추가 변경)
- 모드 전환(공부 ↔ 업무학습) 시 각 모드의 좌·우 슬롯이 독립 보존되는지

## 회귀 테스트 계획
- 일반 모드 채팅이 정상 동작 (split 영향 없음)
- 마인드맵 모드: 자동 마인드맵 생성/조회 동작
- 강의 모드(Phase 4): 영상 재생 / 슬라이드 동기화 동작
- 인증: 로그아웃 시 split 슬롯도 reset되는지
