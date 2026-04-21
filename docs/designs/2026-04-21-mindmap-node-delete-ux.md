# 설계: 2026-04-21-mindmap-node-delete-ux

**생성:** 2026-04-21 13:28
**워크트리:** /Users/moon/DevLearn_FE_wt/2026-04-21-mindmap-node-delete-ux
**브랜치:** task/2026-04-21-mindmap-node-delete-ux

## 목표
마인드맵 개별 노드 삭제가 현재 "우클릭 컨텍스트 메뉴" 안에만 있어 발견성이 낮다. 잘 보이는 두 위치에 삭제 진입점을 추가한다.
- **A. 노드 hover 시 우상단 X(Trash2) 아이콘**: 마우스 올렸을 때만 보이는 작은 삭제 버튼
- **B. 패널 상단 "선택 삭제" 버튼**: 선택 노드가 있을 때만 활성화, 기존 "전체 삭제" 옆 배치
- 기존 우클릭 메뉴는 유지 (파괴 금지)

## 변경 범위
- `src/components/mindmap/MindmapNode.jsx` — hover 시 우상단 삭제 버튼 렌더링 + `deleteNode(id)` 호출
- `src/components/mindmap/MindmapPanel.jsx` — "선택 삭제" 버튼 + 확인 팝오버 state 추가
- 스토어는 수정 없음 (`deleteNode`는 이미 있음)

## 구현 계획
1. `MindmapNode.jsx`
   - 컨테이너에 `group` + `relative` 추가
   - 우상단에 `absolute -top-2 -right-2` 삭제 버튼 (Trash2 아이콘, 작은 원형)
   - `opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition` — 평소엔 숨김
   - `onClick` → `deleteNode(id)`, `onMouseDown`/`onDoubleClick` stopPropagation (드래그·편집 충돌 방지)
   - `aria-label="노드 삭제"`, `title="노드 삭제"`
2. `MindmapPanel.jsx`
   - 기존 "전체 삭제" 버튼 옆에 "선택 삭제" 버튼 추가
   - `disabled = !selectedNode`
   - 클릭 시 확인 팝오버(`showDeleteSelectedConfirm` state) → 확정 시 `deleteNode(selectedNode.id)` + `showSuccess`
3. 빌드 + dev 재기동 + 수동 검증

## 단위 테스트 계획
- hover 시 노드 우상단 삭제 버튼 표시, hover 빠지면 숨김
- hover 버튼 클릭 → 해당 노드(+ 스토어 기존 로직상 자식들) 삭제
- 선택 삭제 버튼: 선택 없을 때 비활성 / 선택 후 활성 → 확인 팝오버 → 삭제 성공 토스트
- 기존 우클릭 메뉴 "노드 삭제" 여전히 정상
- 루트 삭제도 가능 (기존 `deleteNode` 동작 유지)

## 회귀 테스트 계획
- 노드 편집(더블클릭)/드래그/색상 변경/접기-펼치기 hover 오버레이로 방해받지 않음
- 모드 전환·맵 전환 후에도 새 기능 정상 동작
- 채팅 등 인접 기능 영향 없음
