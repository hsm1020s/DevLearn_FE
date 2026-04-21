# 설계: 2026-04-21-fix-chat-mode-isolation

**생성:** 2026-04-21 13:06
**워크트리:** /Users/moon/DevLearn_FE_wt/2026-04-21-fix-chat-mode-isolation
**브랜치:** task/2026-04-21-fix-chat-mode-isolation

## 목표
일반/학습 모드의 채팅 공간을 분리한다. 현재는 `conversations`가 공유되어 모드를 전환해도 같은 대화/메시지가 노출된다. 모드별 독립성을 보장하되, 각 모드로 돌아갔을 때 "방금 보던 대화"가 자동 복원되도록 한다(마인드맵 스토어의 `lastActiveByMode` 패턴과 일관).

## 변경 범위
- `src/stores/useChatStore.js`
  - 신규 상태: `lastActiveByMode: { general: null, study: null }`
  - `setCurrentConversation(id)`: 해당 대화의 mode에 id를 기록
  - `deleteConversations(ids)`: 삭제되는 id가 `lastActiveByMode`에 남아있으면 null로 정리
  - `reset()`: `lastActiveByMode` 초기화
  - 신규 액션: `switchMode(newMode)` — 현재 대화 id를 기존 모드 슬롯에 저장, 새 모드의 마지막 대화 id를 `currentConversationId`로 복원(없거나 유효하지 않으면 null)
  - persist `partialize`에 `lastActiveByMode` 포함, `version: 2 → 3`, `migrate`에서 기본값 주입
- `src/stores/useAppStore.js`
  - `setMainMode(mode)` 호출 시 `useChatStore.getState().switchMode(mode)` 호출(기존 마인드맵 restore 로직 그대로 유지)
- `src/components/layout/Sidebar.jsx`
  - 최근 채팅 목록: `conversations.filter((c) => c.mode === mainMode)`
  - 즐겨찾기 목록: `conversations.filter((c) => c.mode === mainMode && c.isFavorite).slice(0, 3)`
  - 전체선택/삭제 개수는 필터된 목록 기준

## 구현 계획
1. `useChatStore`에 `lastActiveByMode` + `switchMode(newMode)` + `setCurrentConversation` 업데이트 + `deleteConversations` cleanup + `reset()` 포함 + migration
2. `useAppStore.setMainMode`에서 `switchMode` 위임 호출
3. `Sidebar.jsx`의 conversations/favorites를 mainMode로 필터
4. 빌드 + dev 서버 기동 + 수동 스모크
5. evidence notes 기록 → unit-done 전진

## 단위 테스트 계획
- 일반 모드에서 대화 A 생성 → 학습 모드로 전환 → 사이드바에 A가 안 보이고 EmptyChatView 표시
- 학습 모드에서 대화 B 생성 → 일반 모드로 전환 → A 자동 복원 (마지막 보던 대화)
- 학습 모드로 다시 전환 → B 복원
- B 삭제 후 학습 모드 진입 시 EmptyChatView (lastActiveByMode.study가 깨끗하게 정리됨)
- 빌드 성공 및 dev HTTP 200

## 회귀 테스트 계획
- 마인드맵 ON/OFF + 모드별 마인드맵 복원이 기존대로 동작
- 일반 모드 채팅 전송 1회 (streaming) + 즐겨찾기 토글 + rename + 삭제 플로우
- 로그아웃 → 재로그인 시 `fetchConversations` 후 목록이 모드별로 여전히 분리되어 노출되는지

