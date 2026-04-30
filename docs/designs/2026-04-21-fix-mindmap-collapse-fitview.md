# 설계: 2026-04-21-fix-mindmap-collapse-fitview

**생성:** 2026-04-21 12:10
**워크트리:** /Users/moon/DevLearn_FE_wt/2026-04-21-fix-mindmap-collapse-fitview
**브랜치:** task/2026-04-21-fix-mindmap-collapse-fitview

## 목표
루트 노드를 접었다가 펼칠 때 `fitView`가 제대로 동작하지 않아 일부 자식 노드가 화면 밖에 남아있는 버그 수정. 펼침 직후에도 "전체보기" 버튼을 누른 것처럼 모든 노드가 화면에 들어오도록 만든다.

## 원인 분석
`MindmapCanvas.jsx:116-126` 의 fitView 훅에 race condition:

1. 루트 접음 → `flowNodes.length=1`, `lastFittedCount=1`
2. 루트 펼침 → `flowNodes.length=5`
3. 이 시점에 `useNodesInitialized()` 가 직전(노드 1개 기준) stale true 를 반환하면 가드를 통과
4. `lastFittedCount.current = 5` 가 동기적으로 갱신됨
5. RAF 안에서 `fitView` 실행 — 새로 등장한 4개 자식 노드는 아직 DOM 측정 전이라 bbox가 틀어짐
6. 이후 측정 완료돼도 `lastFittedCount === flowNodes.length` 라 재-fit 안 일어남

## 변경 범위
- `src/components/mindmap/MindmapCanvas.jsx` — fitView 효과 로직 재구성

## 구현 계획
단일 effect 를 두 개로 분리:

1. **count 변화 감지 effect**: `flowNodes.length` 가 `lastCountRef` 와 다르면 `pendingFit.current = true`, `lastCountRef` 갱신
2. **실행 effect**: `nodesInitialized === true && pendingFit.current === true` 일 때만 `fitView` 실행 후 플래그 해제

이렇게 하면 "측정 완료 전에 fit이 실행되고 끝나버리는" 문제가 사라진다. 측정 중에 count가 다시 바뀌면 플래그를 재설정하므로 연속 토글에도 안전.

## 단위 테스트 계획
- [ ] 루트 노드 접기 → 자식 모두 사라지고 루트만 표시 (스크린샷 1)
- [ ] 루트 노드 펼치기 → 모든 노드가 화면 안에 보이고 중앙 정렬 (스크린샷 2)
- [ ] 중간 노드 접기/펼치기도 동일하게 동작

## 회귀 테스트 계획
- [ ] 채팅 모드(자격증/면접 등) 메시지 송수신 정상 (스크린샷)
- [ ] 문서 모드 파일 업로드 & 요약 정상
