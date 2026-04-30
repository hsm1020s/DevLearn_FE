# 설계: 2026-04-21-persist-main-mode

**생성:** 2026-04-21 21:02
**워크트리:** /Users/moon/DevLearn_FE_wt/2026-04-21-persist-main-mode
**브랜치:** task/2026-04-21-persist-main-mode

## 목표
새로고침 시 사용자가 선택한 앱 모드(`mainMode`)와 마인드맵 패널 표시 여부(`isMindmapOn`)가 휘발되어 일반 모드 + 마인드맵 OFF 상태로 되돌아가는 사전 버그 수정. `useAppStore`의 `persist.partialize`에 두 필드를 추가하여 localStorage에 저장한다. rehydration 시 추가 사이드이펙트(`switchMode`/`restoreForMode`) 호출은 불필요 — `useChatStore`/`useMindmapStore`가 이미 `lastActiveByMode` 등을 persist하고 있어 rehydrate된 `mainMode`와 자연스럽게 정합.

## 변경 범위

| 파일 | 변경 |
|------|------|
| `src/stores/useAppStore.js` | `partialize`에 `mainMode`, `isMindmapOn` 추가 |

다른 파일/스토어는 수정 없음. `setMainMode` / `toggleMindmap` 액션 시그니처와 동작 모두 그대로.

## 구현 계획

1. `useAppStore`의 `partialize` 함수를 다음으로 수정:
   ```js
   partialize: (state) => ({
     splitLeftPct: state.splitLeftPct,
     mainMode: state.mainMode,
     isMindmapOn: state.isMindmapOn,
   }),
   ```
2. 이미 persist 옵션에 `name: 'app-store'`이 있으므로 키 변경 불필요.
3. 기존 localStorage 사용자는 `app-store`에 `splitLeftPct`만 있을 것 — 누락된 필드는 initial state(`mainMode: 'general'`, `isMindmapOn: false`)로 폴백됨(zustand persist 기본 merge 동작).

## 비복원 대상 재확인 (scope)

의도적으로 제외:
- `activeModal` — 새로고침 시 모달이 떠 있는 건 UX상 부적절
- `isMobileSidebarOpen` — 모바일 드로어, 세션 단위 상태
- `isSidebarCollapsed` / `selectedLLM` — 별개 선호 저장 논의가 필요. 본 task 범위 밖.

## rehydration 정합성 검토

`setMainMode(mode)`는 호출 시 `useChatStore.switchMode(mode)`와 `useMindmapStore.restoreForMode(mode)`를 연쇄 호출한다. 그러나 앱 초기 rehydration 경로에서는:

- `useChatStore`는 `currentConversationId`/`lastActiveByMode`를 이미 persist — 직전 세션 종료 시점 상태 그대로 복원
- `useMindmapStore`는 `maps`/`activeMapId`/`lastActiveByMode`를 persist — 마찬가지로 정합 상태 복원

세션 종료 시점의 `mainMode`와 다른 두 스토어 상태는 같은 "찰나"에 동결되므로 저장값 간 자연스러운 정합성이 보장된다. 따라서 `switchMode`/`restoreForMode`의 사이드이펙트를 rehydration 단계에서 재실행할 필요가 없다.

## 단위 테스트 계획

- 빌드 성공 (`npm run build`)
- 코드 리뷰:
  - [ ] partialize에 `mainMode`, `isMindmapOn` 포함
  - [ ] `setMainMode`/`toggleMindmap` 시그니처 미변경
  - [ ] persist name `app-store` 동일
- 브라우저 수동:
  - [ ] 학습 모드 선택 + 마인드맵 ON → 새로고침 → 학습 모드 + 마인드맵 ON 유지
  - [ ] 일반 모드로 돌아와 새로고침 → 일반 모드 유지
  - [ ] 이전 task의 `splitLeftPct` persist 여전히 동작
  - [ ] localStorage `app-store` 키에 3개 필드 모두 저장됨

## 회귀 테스트 계획

| 기능 | 확인 |
|------|------|
| 모드 전환 (일반 ↔ 학습) | `setMainMode` 호출 시 기존처럼 채팅/마인드맵 상태 함께 전환 |
| 새 대화/메시지 전송 | 모드별 대화 공간 분리 유지 |
| 마인드맵 노드 편집 | 저장·복원 동일 |
| `useChatStore`/`useMindmapStore` persist | 기존 키 충돌 없음 |
