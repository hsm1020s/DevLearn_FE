# 설계: 2026-05-02-learning-split-resizable

**생성:** 2026-05-02 18:17
**워크트리:** /Users/moon/DevLearn_FE_wt/2026-05-02-learning-split-resizable
**브랜치:** task/2026-05-02-learning-split-resizable

## 목표
공부/업무학습 모드의 좌우 분할 화면(좌=일반, 우=파인만)을 사용자가 가운데 핸들을 드래그해 비율 조절할 수 있게 한다. 마인드맵-채팅 분할(`SplitView`)과 동일한 패턴(pointer capture, 20~80% 클램프, persist) 적용. 비율은 마인드맵 분할과 **독립** 으로 보관해 두 분할 모드가 서로 영향받지 않도록 한다.

## 변경 범위

### 수정 파일
- `src/stores/useAppStore.js`
  - 새 필드 `learningSplitLeftPct: 50` 추가 (좌측=일반 패널 비율 %)
  - 새 액션 `setLearningSplitLeftPct(pct)` — 20~80 클램프
  - persist `partialize`에 `learningSplitLeftPct` 추가
- `src/components/study/SplitLearningWorkspace.jsx`
  - 단순 `flex-1` / `flex-1` 분할 → 좌측은 `style={{ width: '${pct}%' }}`, 우측은 `flex-1`
  - 가운데에 리사이저 div(`role="separator"`, `cursor-col-resize`, pointer capture) 삽입
  - `containerRef`로 컨테이너 폭 측정 후 마우스 X로 % 계산

### 영향 받지 않음
- `src/components/layout/SplitView.jsx` (마인드맵-채팅) — 변경 없음. 별도 store 키 사용으로 독립.
- `useChatStore`, `useStreamingChat`, GeneralChatPane / FeynmanChatPane — 변경 없음.
- 일반 모드 / 마인드맵 / 강의 모드 — 영향 없음.

## 구현 계획

1. `useAppStore`에 `learningSplitLeftPct` 추가 + persist
2. `SplitLearningWorkspace`에 리사이저 도입
   - `containerRef`, `isDraggingRef` ref 추가
   - 좌측 패널을 `style={{ width }}`로 폭 고정, 우측은 `flex-1`로 잔여 공간 차지
   - 가운데 1px 핸들에 `onPointerDown/Move/Up/Cancel` 부착
   - 드래그 중 `document.body.style.userSelect = 'none'`로 텍스트 선택 방지

## 단위 테스트 계획
- 핸들 좌우 드래그 시 좌/우 패널 폭이 실시간 변동
- 한쪽이 사라지지 않게 20~80% 클램프 확인 (드래그 끝까지 끌어도 최소 20%)
- 새로고침 후 비율 보존 (persist)
- 마인드맵 패널 비율(`splitLeftPct`)과 독립 — 마인드맵을 끄거나 비율을 바꿔도 학습 워크스페이스 비율은 유지

## 회귀 테스트 계획
- 일반 모드 마인드맵 ON/OFF + 리사이즈 정상
- 공부 모드 퀴즈/기록 탭 정상
- 강의 모드 영상 재생 정상
