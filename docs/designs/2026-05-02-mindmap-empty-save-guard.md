# 설계: 2026-05-02-mindmap-empty-save-guard

**생성:** 2026-05-02 17:27
**워크트리:** /Users/moon/DevLearn_FE_wt/2026-05-02-mindmap-empty-save-guard
**브랜치:** task/2026-05-02-mindmap-empty-save-guard

## 목표
마인드맵 저장 시 노드 0개로 덮어쓰기를 막는 안전장치를 추가한다. 사용자가 명시적으로 "전체 노드 삭제(clearAll)" 를 선택한 경우에만 빈 nodes 가 허용되도록 BE 가드 + FE clearAll 플래그를 추가한다.

## 배경
직전 사건: t@t.com 의 "제1장 데이터베이스 설계" 마인드맵 노드 67개가 어느 시점에 사라짐. BE 의 `MindmapService.saveMindmap` 전체-교체 패턴(노드 HARD DELETE → 새 nodes INSERT) 이 빈 nodes 로 호출됐을 때 노드 영구 소실되는 구조. 자동 저장 debounce / race / placeholder 등 어떤 경로로든 빈 nodes 가 BE 로 전송되면 데이터 손실 → 가드 필요.

## 변경 범위

### BE
| 파일 | 변경 |
|------|------|
| `MindmapSaveRequest.java` | optional `Boolean intentionallyEmpty` 필드 추가 |
| `MindmapService.java` | `saveMindmap` 업데이트 분기에 가드: 빈 nodes + intentionallyEmpty != true + 기존 노드 N>0 → 400 거절 |

### FE
| 파일 | 변경 |
|------|------|
| `stores/useMindmapStore.js` | `clearAll` 이 active map 에 `intentionallyEmpty: true` 마킹. `_performSave` 가 payload 에 플래그 포함, save 후 클리어. |
| `services/mindmapApi.js` | 변경 없음 (params 그대로 통과) |

## 핵심 결정사항

### 1. 명시적 "비우기" 만 허용
사용자가 의도적으로 노드를 모두 비우는 정상 경로는 `clearAll` (UI "전체 노드 삭제" 버튼) 한 가지. 그 외 모든 save 호출이 빈 nodes 면 **거절**.

### 2. 양쪽 협력 (defense in depth)
- **BE 가드 (권위적)**: 어떤 클라이언트도 빈 nodes 로 기존 마인드맵을 못 비움 (플래그 없으면). 미래 모바일/외부 client 도 보호.
- **FE 변경 (정상 경로 우회)**: clearAll 만 플래그 셋해서 BE 가드 통과. 다른 경로는 자연스럽게 BE 에서 거절.

### 3. 신규 생성 무영향
신규 마인드맵 생성 (request.id == null) 은 nodes 가 비어있을 수 있음 (사용자 노드 추가 전). 가드는 **업데이트 케이스에만** 적용.

### 4. 거절 동작은 토스트로 알림
`showError` 가 BusinessException 메시지를 토스트로 띄우므로 사용자가 즉시 인지 + 데이터 손실 0.

## 구현 계획

### BE

**1. `MindmapSaveRequest.java`** — 필드 추가
```java
/** 사용자가 의도적으로 모든 노드를 비우는 경우 true (clearAll). false/null 이면 빈 nodes 거절. */
private Boolean intentionallyEmpty;
```

**2. `MindmapService.saveMindmap`** — 업데이트 분기 시작에 가드
```java
// 안전장치 — 기존 노드가 N>0 인데 빈 nodes 로 덮어쓰려는 경우 거절.
// clearAll 이 명시적으로 intentionallyEmpty=true 를 보낼 때만 통과.
boolean isEmpty = request.getNodes() == null || request.getNodes().isEmpty();
if (isEmpty && !Boolean.TRUE.equals(request.getIntentionallyEmpty())) {
    int existingNodeCount = mindmapMapper.countNodesByMindmapId(mindmapId);
    if (existingNodeCount > 0) {
        throw new BusinessException(ErrorCode.INVALID_INPUT,
            "기존 노드 " + existingNodeCount + "개를 빈 상태로 저장하려는 시도가 거절되었습니다. " +
            "전체 비우기는 '전체 노드 삭제' 기능을 사용하세요.");
    }
}
```
가드는 `mindmapNodeMapper.deleteByMindmapId(mindmapId)` 호출 직전에 위치.

### FE

**1. `useMindmapStore.clearAll`** — 플래그 마킹
```js
clearAll: () => {
  const { activeMapId } = get();
  if (!activeMapId) return;
  set((state) => {
    const map = state.maps[activeMapId];
    if (!map) return state;
    return {
      maps: {
        ...state.maps,
        [activeMapId]: { ...map, nodes: [], intentionallyEmpty: true, updatedAt: Date.now() },
      },
      selectedNodeId: null,
      lastSavedAt: null,
    };
  });
  get().scheduleSave(activeMapId);
},
```

**2. `_performSave` payload + 성공 후 플래그 클리어**
```js
const payload = {
  id: map.isLocal ? undefined : mapId,
  title: map.title,
  mode: map.mode,
  nodes: map.nodes.map(({ collapsed: _c, ...rest }) => rest),
  intentionallyEmpty: map.intentionallyEmpty === true ? true : undefined,
};
const res = await saveMindmap(payload);
// ... (기존 set state)
// 성공 후 플래그 클리어 (다음 일반 save 가 다시 의도하지 않게 통과되지 않도록)
set((state) => {
  const finalKey = serverId && serverId !== mapId ? serverId : mapId;
  if (state.maps[finalKey]?.intentionallyEmpty) {
    return {
      maps: {
        ...state.maps,
        [finalKey]: { ...state.maps[finalKey], intentionallyEmpty: false },
      },
    };
  }
  return {};
});
```

## 단위 테스트 계획

### BE
1. **빈 nodes 업데이트 거절** (intentionallyEmpty 없음): 노드 N개 mindmap → save with `nodes:[]` → HTTP 400 + 메시지에 "거절"
2. **intentionallyEmpty=true 인 경우 빈 nodes 허용**: 노드 N개 mindmap → save with `nodes:[], intentionallyEmpty:true` → 200, DB 노드 0개
3. **신규 생성 + 빈 nodes 는 허용**: id 없이 save with `nodes:[]` → 200 (기존 동작 유지)
4. **정상 업데이트 무영향**: nodes 1개 이상 → 200, 정상 교체

### FE
- vite build 통과
- (브라우저 수동) clearAll 클릭 시 정상 빈 저장 / 의도치 않은 자동 저장은 BE 거절 + 토스트

증거: `.claude/state/evidence/2026-05-02-mindmap-empty-save-guard/unit/notes.md`

## 회귀 테스트 계획
1. 마인드맵 신규 생성 + 노드 추가 + 저장 — 정상
2. 노드 1개 → 0개로 줄이는 일반 save (clearAll 거치지 않고) — 거절됨 (의도된 동작)
3. clearAll → 정상 빈 저장 (플래그 통과)
4. 단건/일괄 삭제 — 무영향
5. dev-health

증거: `.claude/state/evidence/2026-05-02-mindmap-empty-save-guard/regression/notes.md`
