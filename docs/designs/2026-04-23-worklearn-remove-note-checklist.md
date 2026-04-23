# 설계: 2026-04-23-worklearn-remove-note-checklist

**생성:** 2026-04-23 16:48
**워크트리:** /Users/moon/DevLearn_FE_wt/2026-04-23-worklearn-remove-note-checklist
**브랜치:** task/2026-04-23-worklearn-remove-note-checklist

## 목표
업무학습 모드에서 "업무노트(📝)"와 "체크리스트(✅)" 탭/버튼 기능을 모두 제거하고, 업무학습 모드는 **채팅 탭 단독**으로 축소한다. 사용자가 더 이상 필요 없다고 판단한 기능이므로 관련 컴포넌트·스토어·persist 키까지 깨끗하게 정리한다.

자격증(study) 모드의 체크리스트·채팅 공용 컴포넌트(`ChecklistPanel`, `StudyChatTab`)는 **건드리지 않는다** — 자격증 모드에서 계속 사용 중이고, `useWorkLearnStore`에만 강결합된 부분을 걷어내면 된다.

## 변경 범위

### 삭제
- `src/components/worklearn/WorkLearnSubTabs.jsx` — 3-탭 바. 채팅 단독이 되면 더 이상 탭 바 불필요.
- `src/components/worklearn/WorkNotePanel.jsx` — 노트 리스트/필터 UI.
- `src/components/worklearn/WorkNoteEditor.jsx` — 노트 편집 모달.
- `src/components/worklearn/WorkLearnChecklistPanel.jsx` — 체크리스트 편집 UI.
- `src/stores/useWorkLearnStore.js` — 노트·체크리스트 persist 스토어 (다른 모드가 참조하지 않음).

### 수정
- `src/components/worklearn/WorkLearnMode.jsx`
  - `useState('chat')` / 탭 분기 제거.
  - `WorkLearnSubTabs`, `WorkNotePanel`, `WorkLearnChecklistPanel` import 제거.
  - `StudyChatTab` 한 개만 바로 렌더.
  - 파일 상단 `@fileoverview` 주석을 "채팅 단독" 구조로 갱신.
- `src/utils/resetUserStores.js`
  - `useWorkLearnStore` import/`.reset()` 호출 제거.
  - `USER_STORE_KEYS`에서 `'worklearn-store'` 제거 — 기존 사용자의 localStorage에 남아있을 수 있으나, 다음 로그아웃 시점의 `removeItem('worklearn-store')` 호출이 사라져도 브라우저 스토리지에 남는 고아 키 하나일 뿐 기능에 영향 없음. (필요하면 추후 일괄 마이그레이션.)
- `src/stores/useStudyStore.js`
  - `useWorkLearnStore` 참조 주석만 간단히 업데이트(코드 의존 없음).

### 유지
- `src/registry/modes.js`의 `worklearn` 엔트리 / `LEARNING_MODES` — 업무학습 모드 자체는 유지, 채팅만 남음.
- `src/components/study/StudyChatTab.jsx` — 공용 유지. `mode="worklearn"` 호출도 그대로.
- `src/stores/useChatStore.js`의 `lastActiveByMode.worklearn` — 채팅 복원을 위해 여전히 필요.
- `src/hooks/useStreamingChat.js`의 `isLearningMode` 분기 — 그대로.

## 구현 계획
1. `WorkLearnMode.jsx`를 채팅 탭 단독 렌더로 단순화하고 상단 주석 갱신.
2. 삭제 대상 4개 컴포넌트 파일 `git rm`.
3. `useWorkLearnStore.js` `git rm`.
4. `resetUserStores.js`에서 worklearn 참조 제거.
5. `useStudyStore.js`의 주석 업데이트.
6. `npm run build` 또는 dev 기동으로 import 누락 에러 없는지 확인.

## 단위 테스트 계획
- 사이드바 → 업무학습 모드 진입 시 상단 탭 바가 없고 채팅 UI만 나타나는지 확인.
- 업무학습 채팅에서 메시지 전송/스타일 칩(파인만·요약) 정상 동작 확인.
- 모드 전환(업무학습 ↔ 자격증 ↔ 자유채팅) 후 돌아왔을 때 마지막 대화가 복원되는지 확인.
- 콘솔에 import 에러/경고 없는지 확인.

## 회귀 테스트 계획
- 자격증(study) 모드 진입 후 체크리스트 탭/학습 채팅이 그대로 동작하는지 확인 (공용 `ChecklistPanel`, `StudyChatTab` 손상 여부).
- 자유 채팅 모드에서 메시지 송수신 확인.
- 마인드맵 모드 진입 → 마인드맵 뷰 렌더 확인.
- 로그아웃 → 로그인 사이클에서 스토어 초기화가 정상인지 확인(업무학습 persist 키가 사라져도 다른 기능 이상 없음).
