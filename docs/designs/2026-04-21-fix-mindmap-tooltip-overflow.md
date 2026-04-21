# 설계: 2026-04-21-fix-mindmap-tooltip-overflow

**생성:** 2026-04-21 13:55
**워크트리:** /Users/moon/DevLearn_FE_wt/2026-04-21-fix-mindmap-tooltip-overflow
**브랜치:** task/2026-04-21-fix-mindmap-tooltip-overflow

## 목표
마인드맵 노드 설명 툴팁이 노드가 마인드맵 패널의 왼쪽 가장자리에 있을 때 ReactFlow pane(`overflow:hidden`) 경계에 잘려 인접한 채팅 영역에 덮여 보이는 문제 해결.
편집 모달은 이미 `createPortal` 방식으로 해결됨 — 툴팁도 동일 방식으로 전환한다.

## 원인
- `<NodeToolbar>`는 ReactFlow viewport 내부에 absolute로 배치됨
- 마인드맵 패널(또는 ReactFlow pane)이 `overflow:hidden`이므로 툴팁이 경계를 벗어나면 잘림
- 노드 위치가 맵 좌측에 있을수록 이 현상이 심함

## 해결
툴팁 렌더링을 ReactFlow NodeToolbar → `createPortal(document.body)`로 전환.
- hover 시 노드 DOM의 `getBoundingClientRect()`로 viewport 기준 좌표 획득
- `fixed` 포지션 카드로 body 최상단에 띄움
- 위치: 노드 상단 중앙 (`top = rect.top - 8 - cardHeight`, `left = rect.left + rect.width/2`, `transform: translateX(-50%) translateY(-100%)`)
- 좌표 확정 후 실제 카드가 화면 상단으로 넘치는지 체크 → 넘치면 노드 **아래쪽**으로 flip
- 좌우는 `translateX(-50%)`가 카드 너비의 절반만큼 당겨주므로 화면 왼쪽/오른쪽 가장자리 안전: 추가로 `max-width: min(240px, 90vw)` 제한

## 변경 범위
- `src/components/mindmap/MindmapNode.jsx`
  - `NodeToolbar` 제거 (툴팁 부분만), 편집 모달의 portal 패턴 재사용
  - 노드 root div에 `ref` 추가
  - hover 시 rect 저장, 포털로 fixed 툴팁 렌더링
  - `translateY(-100%)` 기본, `rect.top < cardHeight + padding`이면 `translateY(0)` (flip)
- 다른 파일 무수정

## 구현 계획
1. MindmapNode에 `nodeRootRef` + `tooltipRect` state 추가
2. `handleMouseEnter` 타이머 안에서 rect 캡쳐 + `setTooltipOpen(true)`
3. `<NodeToolbar>` 툴팁 블록 → `createPortal`로 이동 (fixed, z-[90], max-w 240 / 90vw)
4. 화면 상단 flip 로직 (간단한 boundary check)
5. 편집 모달/기존 기능 영향 없음 확인
6. 빌드 + dev + 수동 검증

## 단위 테스트 계획
- 노드가 마인드맵 패널 **왼쪽 가장자리**에 있을 때 hover → 툴팁이 채팅 영역 위에 덮이지 않고 정상 노출 ✓
- 노드가 패널 **상단**에 있을 때 hover → 위쪽 공간 부족 시 **아래쪽으로 flip** 노출
- 노드가 패널 **중앙**에 있을 때 hover → 기존처럼 상단에 노출
- 긴 설명 텍스트 → 240px(또는 90vw) 내에서 줄바꿈, 카드가 뷰포트를 초과하지 않음
- 마우스 이탈 시 즉시 숨김
- 편집 모달(연필 클릭) 열기/닫기 정상
- ReactFlow 확대/축소/팬은 hover 시작 시점 좌표에 고정되므로 이동 중엔 숨겨지는 것이 정상 동작

## 회귀 테스트 계획
- 라벨 편집/드래그/삭제(X·선택·우클릭)/접기·펼치기/색상 변경 정상
- 모드 전환/맵 전환 후에도 정상
- 채팅 등 인접 기능 영향 없음
