# 설계: 2026-04-21-mindmap-node-description

**생성:** 2026-04-21 13:43
**워크트리:** /Users/moon/DevLearn_FE_wt/2026-04-21-mindmap-node-description
**브랜치:** task/2026-04-21-mindmap-node-description

## 목표
마인드맵 각 노드에 **설명(description) 필드**를 추가하고, 노드 hover 시 설명 툴팁을 표시한다.
- 사용자 시나리오: 루트가 주제, 자식 노드가 목차일 때 각 목차 노드의 요약 설명을 호버로 확인
- 편집은 각 노드 호버 오버레이의 **연필 아이콘**으로 진입
- 툴팁 렌더링은 ReactFlow 내장 `<NodeToolbar>` 사용 (hover trigger로 `isVisible` 제어)
- FE-only 우선 (스토어 persist + migration). BE 스키마/API 반영은 추후 별도 태스크

## 변경 범위
- `src/stores/useMindmapStore.js`
  - 노드 생성(`addNode`) 시 `description: ''` 기본값
  - `_performSave`(서버 save) 시 `description` strip (BE 미지원 → payload에서 제거)
  - persist `version: 3 → 4` 승격 + migration (기존 노드에 `description: ''` 주입)
  - `updateNode`는 기존 그대로 (partial 패치 지원)
- `src/components/mindmap/MindmapNode.jsx`
  - hover 상태 추적 (`useState` + `onMouseEnter/Leave`)
  - hover 오버레이 좌상단(또는 X 아이콘 옆)에 **연필 `Pencil`** 버튼 추가 → 클릭 시 인라인 편집 팝오버 열기
  - `<NodeToolbar position="top" isVisible={…} offset={8}>` 로 툴팁 렌더링
    - `isVisible = hover && !editing && !editingDescription && !!data.description`
    - 500ms 호버 지연(setTimeout)으로 깜빡임 방지
  - 편집 팝오버: 노드 내부(또는 `NodeToolbar position="bottom"`)에 `textarea` + "저장/취소" 버튼
    - `maxLength=500`, IME `isComposing` 체크 후 Enter=저장, Escape=취소
    - 편집 중엔 툴팁 숨김
- 기존 삭제 X 버튼과 위치 충돌 피하도록 연필 아이콘은 X **왼쪽**에 배치

## 구현 계획
1. 스토어: `addNode`에 `description: ''` 추가, `_performSave` strip, persist version bump + migration
2. `MindmapNode`
   - hover state + 500ms 지연 열기 / 즉시 닫기
   - 연필 아이콘 버튼 (편집 진입)
   - `<NodeToolbar position="top" isVisible>` → 설명 카드 (멀티라인 wrap, max-width 240px)
   - 편집 팝오버 (`<NodeToolbar position="bottom">` 또는 노드 아래 absolute)
     - textarea, 저장/취소, IME 처리
3. 빌드 + dev 재기동 + 수동 검증

## 단위 테스트 계획
- **편집 진입**: 노드 hover → 연필 아이콘 노출 → 클릭 → 편집 팝오버 열림
- **설명 저장**: textarea에 텍스트 입력 → 저장 → 스토어 `description` 업데이트 확인
- **툴팁 표시**: description이 있는 노드 hover 500ms 후 툴팁 노출, 마우스 벗어나면 즉시 사라짐
- **빈 설명 처리**: description이 빈 문자열인 노드는 hover해도 툴팁 미표시
- **편집 중 툴팁 숨김**: 편집 팝오버가 열린 동안 툴팁 중복 노출 없음
- **기존 기능 회귀**: 라벨 더블클릭 편집 / 드래그 / 삭제 X / 접기·펼치기 / 우클릭 메뉴 정상
- **persist migration**: 기존 저장된 맵(description 없는 노드)을 새 버전에서 로드 → `description: ''` 주입 확인 (localStorage 수동 확인 또는 가볍게 unit 시나리오로 검증)

## 회귀 테스트 계획
- 노드 추가/편집/드래그/색상/접기·펼치기/삭제(우클릭·X·선택 삭제) 정상
- 모드 전환(일반↔학습) + 맵 전환 후에도 툴팁/편집 정상 동작
- 채팅 등 인접 기능 영향 없음
- 서버 저장(BE strip) 후 다시 로드 시 맵 상태 유지 (description은 FE 로컬에만 남음)
