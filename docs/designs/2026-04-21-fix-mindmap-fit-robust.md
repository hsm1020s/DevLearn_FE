# 설계: 2026-04-21-fix-mindmap-fit-robust

**생성:** 2026-04-21 12:28
**워크트리:** /Users/moon/DevLearn_FE_wt/2026-04-21-fix-mindmap-fit-robust
**브랜치:** task/2026-04-21-fix-mindmap-fit-robust

## 목표
마인드맵에서 다음 두 증상 모두 해결:
1. 루트 아래로 하위 노드를 추가할 때마다 새 자식이 뷰포트 하단에 잘리는 문제
2. 루트 노드를 접었다 펼치면 왼쪽 상단으로 시야가 치우쳐 전체가 안 보이는 문제

## 원인 재분석
직전 수정(`pendingFit` ref + 두 effect 분리)이 **React StrictMode 의 이중 effect 호출**과 조합되면서 fit 이 실제로는 실행되지 않는 경로를 만들었다:

1. count 변화 → effect 첫 실행: `pendingFit = false` 로 바꾸고 RAF 예약
2. StrictMode 가 cleanup 을 호출 → RAF 취소
3. Effect 재실행: `pendingFit` 이 이미 false 이므로 가드 통과 실패 → fit 스케줄 안 됨
4. 결과: count 가 바뀌어도 fit 이 한 번도 실행되지 않거나, 이전 bbox 로 실행되어 새 노드가 잘림

## 변경 범위
- `src/components/mindmap/MindmapCanvas.jsx` 의 fitView effect 재설계

## 구현 계획
플래그/ref/`useNodesInitialized` 조합을 걷어내고, **단일 setTimeout 기반 디바운스**로 단순화한다:

```jsx
const lastCountRef = useRef(flowNodes.length);
useEffect(() => {
  if (flowNodes.length === lastCountRef.current) return;
  const target = flowNodes.length;
  const id = setTimeout(() => {
    fitView({ padding: 0.3, duration: 400, maxZoom: 1.2 });
    lastCountRef.current = target;
  }, 180);
  return () => clearTimeout(id);
}, [flowNodes.length, fitView]);
```

핵심 포인트:
- `lastCountRef` 업데이트를 setTimeout **콜백 안**에서만 수행 → StrictMode 의 첫 실행 cleanup 이 타이머를 취소해도, 재실행에서 ref 는 여전히 옛 값이라 조건이 다시 맞아 재스케줄된다.
- 180ms 디바운스로 측정/렌더 안정화 시간을 확보. 연속 추가 시에는 마지막 이벤트 이후에만 한 번 fit.
- `padding: 0.3` 으로 여유를 더 주고 `maxZoom: 1.2` 로 낮춰 단일/소수 노드에 대한 극단 확대를 억제.

## 단위 테스트 계획
- 루트에 자식 4~5개 연속 추가 → 매번 새 자식이 뷰포트 안에 여유 있게 보이는지
- 루트 접기 → 루트 중앙 정렬, 과확대 없음
- 루트 다시 펼치기 → 모든 자식이 뷰포트 안, 왼쪽 위로 치우치지 않음

## 회귀 테스트 계획
- 채팅 모드 입력/전송
- 자격증 모드 진입/빈 상태 렌더
