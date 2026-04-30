# 설계: 2026-04-21-resizable-split-view

**생성:** 2026-04-21 20:51
**워크트리:** /Users/moon/DevLearn_FE_wt/2026-04-21-resizable-split-view
**브랜치:** task/2026-04-21-resizable-split-view

## 목표
채팅창(좌)과 마인드맵(우) 사이의 고정 경계선을 **드래그 가능한 리사이저**로 교체하여 사용자가 비율을 자유롭게 조절할 수 있게 한다.

- 비율은 `useAppStore`에 persist되어 새로고침·재접속 후에도 유지
- 범위 클램프: 20% ~ 80% (한쪽이 완전히 사라지는 것을 방지)
- 모바일(< md)은 탭 전환 모드이므로 리사이저 미적용
- ReactFlow 캔버스가 폭 변화에 자동 반응하는지 확인

## 변경 범위

| 파일 | 변경 |
|------|------|
| `src/components/layout/SplitView.jsx` | 리사이저 DOM + 포인터 드래그 로직 추가, 좌/우 `md:w-1/2` → 인라인 `style={{ width: '${pct}%' }}` |
| `src/stores/useAppStore.js` | `splitLeftPct` (기본 50) + `setSplitLeftPct(pct)` 추가, persist partialize에 포함 |

다른 파일 수정 없음. ReactFlow(`MindmapCanvas.jsx`), 채팅 컴포넌트, 스타일은 변경 불필요.

## 구현 계획

1. **스토어 확장** (`useAppStore.js`)
   - state: `splitLeftPct: 50` (숫자, 20~80 범위)
   - action: `setSplitLeftPct(pct)` — 내부에서 20~80 clamp 후 저장
   - persist: 기존 partialize에 `splitLeftPct` 추가

2. **SplitView 리팩터**
   - `useAppStore` 구독으로 `splitLeftPct` / `setSplitLeftPct` 가져옴
   - 컨테이너 `<div>`에 `containerRef` 부여 (좌측 비율 계산 기준)
   - 좌측 패널: `style={{ width: \`${splitLeftPct}%\` }}` (md 이상에서만; 모바일은 `w-full`)
   - 우측 패널: 나머지 (`flex: 1`)
   - 좌/우 사이에 **리사이저 `<div>`** 삽입
     - 크기: `md:w-1 md:cursor-col-resize md:hover:bg-border-dark`
     - 모바일: `hidden md:block`
     - `role="separator"` + `aria-orientation="vertical"` + `aria-label="채팅과 마인드맵 크기 조절"`

3. **드래그 핸들러**
   - `onPointerDown`:
     - `e.preventDefault()` (텍스트 선택/포커스 차단)
     - `e.currentTarget.setPointerCapture(e.pointerId)`
     - `isDragging` ref로 활성화 표시
     - `document.body.style.userSelect = 'none'` (드래그 중 선택 방지)
   - `onPointerMove`:
     - `isDragging` 아니면 early return
     - `rect = containerRef.current.getBoundingClientRect()`
     - `pct = ((e.clientX - rect.left) / rect.width) * 100`
     - `setSplitLeftPct(pct)` (스토어에서 clamp)
   - `onPointerUp` / `onPointerCancel`:
     - `releasePointerCapture`
     - `isDragging = false`
     - `document.body.style.userSelect = ''` 복원

4. **ReactFlow 반응성 확인**
   - ReactFlow는 내부적으로 `ResizeObserver`로 캔버스 크기를 추적하므로 추가 훅 불필요
   - 드래그 후 노드가 잘리거나 스크롤이 어긋나는지만 수동 확인

## 단위 테스트 계획

**정적**
- `npm run build` 성공
- 코드 리뷰 체크리스트:
  - [ ] persist partialize에 `splitLeftPct` 포함
  - [ ] 20~80 clamp 동작 (스토어 레벨)
  - [ ] 이벤트 리스너 / 포인터 캡처 cleanup (메모리 릭 없음)
  - [ ] 모바일에서 리사이저 `hidden md:block`
  - [ ] 기존 `!isRightVisible` 분기(좌측 전체 너비) 유지

**수동 스모크**
- [ ] 마인드맵 켜고 리사이저 드래그 → 양쪽 비율 실시간 반영
- [ ] 20% 미만/80% 초과로 끌어도 경계에서 멈춤
- [ ] 새로고침 → 조정한 비율 유지
- [ ] 드래그 중 텍스트 선택 안 됨
- [ ] 모바일 뷰포트에서 리사이저 숨겨지고 탭 전환 정상
- [ ] ReactFlow 노드가 잘리지 않음, 드래그 후에도 노드 편집/이동 정상

## 회귀 테스트 계획

변경 범위가 `SplitView` + `useAppStore` 한정이므로 영향 가능성이 있는 항목:

| 기능 | 확인 포인트 |
|------|-------------|
| 마인드맵 OFF 상태 | 좌측 전체 너비로 렌더링 (기존 분기 유지) |
| 일반 채팅 입력/스트리밍 | 입력, 전송, SSE 표시 정상 |
| 마인드맵 노드 편집 | 드래그 이동, 컨텍스트 메뉴, 리사이즈 후에도 동일 |
| 모바일 탭 전환 | 채팅 ↔ 마인드맵 탭 전환 정상 |
| 사이드바 접힘/펼침 | 리사이저 비율과 무관하게 동작 |
| `useAppStore` persist 호환 | 기존 localStorage 값에서 `splitLeftPct` 없으면 기본 50 적용 |

회귀 증거: `evidence/regression/notes.md`에 위 항목 기록.
