# 설계: 2026-04-21-mindmap-single-root

**생성:** 2026-04-21 13:15
**워크트리:** /Users/moon/DevLearn_FE_wt/2026-04-21-mindmap-single-root
**브랜치:** task/2026-04-21-mindmap-single-root

## 목표
마인드맵 한 개 안에는 **루트 노드가 단 하나**만 존재하도록 제약한다.
- 현재 동작: 선택된 노드 없이 "+" 를 누르면 그때마다 새 루트(parentId=null)가 추가되어 맵 안에 루트가 복수 생성될 수 있음
- 변경 후: 이미 루트가 있으면 추가로 루트를 만들 수 없고, 하위 노드는 부모 선택 후에만 추가 가능

## 변경 범위
- `src/stores/useMindmapStore.js` — `addNode` 액션에 루트 중복 방지 가드
- `src/components/mindmap/MindmapPanel.jsx`
  - "+" 버튼 `disabled` 조건에 "이미 루트가 있고 선택 노드 없음" 포함
  - placeholder 를 상태별로 안내 ("루트 노드 이름" / "하위 노드 이름" / "루트가 이미 있습니다 — 부모를 선택하세요")
- 다른 호출자 없음 확인: 스토어 `addNode`는 `MindmapPanel`에서만 사용

## 구현 계획
1. 스토어 가드: `addNode(parentId, label)` 초입에서 `parentId == null`이고 현재 맵 `nodes`에 `parentId == null`인 노드가 이미 있으면 `null` 반환 (짧은 코멘트로 이유 명시)
2. UI 계산된 상태: `hasRoot = activeMap?.nodes.some(n => n.parentId == null)`
3. UI 가드:
   - 버튼 disabled: `!nodeInput.trim() || (!selectedNodeId && hasRoot)`
   - placeholder: `selectedNode ? '하위 노드 이름' : (hasRoot ? '루트가 이미 있습니다 — 부모를 선택하세요' : '루트 노드 이름')`
4. 빌드·dev 재기동, 수동 시나리오 확인

## 단위 테스트 계획
- 빈 맵 → 루트 생성 1개 OK
- 루트 있는 상태에서 선택 없이 "+" → 버튼 비활성화, placeholder 변경 확인
- 루트 선택 후 하위 노드 추가 → 정상
- 루트 삭제 후 다시 루트 추가 가능 확인 (clearAll 후 포함)
- 새 맵 생성 시 각 맵은 자신만의 루트 1개씩 허용

## 회귀 테스트 계획
- 기존 다중 루트 맵(persist된 legacy 데이터)이 있어도 기존 데이터는 훼손하지 않음 (addNode 가드만이므로 기존 노드 불변)
- 채팅 / 모드 전환 등 인접 기능 1개 실사용 확인
