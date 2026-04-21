# 마인드맵 기능 명세서

> **최종 업데이트**: 2026-04-21
> **범위**: DevLearn_FE 마인드맵 전체 — 지금까지 구현된 상태 스냅샷
> 관련 문서: [FEATURES.md](FEATURES.md) · [PROJECT_MAP.md](PROJECT_MAP.md) · [WORK_LOG.md](WORK_LOG.md)

---

## 1. 개요

DevLearn의 마인드맵은 **채팅 모드(general / cert / rag)와 독립된 우측 사이드 패널**로 동작하는 학습 시각화 도구다. 모드별로 독립된 맵 세트를 가지며, ReactFlow 기반의 캔버스 위에서 노드 추가 · 편집 · 색상 · 접기/펼치기 · PDF 출력 · 서버 자동 저장을 지원한다.

---

## 2. 기능 매트릭스 (구현 완료 범위)

### 2.1 노드 조작
| 기능 | 설명 | 진입 경로 |
|------|------|-----------|
| 노드 추가 | 선택 노드 아래에 자식 생성, 루트 미선택 시 루트로 추가 | 패널 하단 입력창 Enter / `+` |
| 인라인 편집 | 라벨 수정 (최대 200자) | 노드 더블클릭 |
| 색상 변경 | 6색 (기본/파랑/초록/빨강/노랑/보라) | 우클릭 → 팔레트 |
| 노드 삭제 | 자식까지 재귀 삭제 | 우클릭 → Trash |
| 드래그 이동 | 자유 위치 배치 (position 저장됨) | 캔버스 드래그 |
| 접기/펼치기 | 부모 노드의 ▸/▾ 토글, 후손 숨김 | 노드의 자식 수 버튼 |

### 2.2 맵 관리
| 기능 | 설명 |
|------|------|
| 맵 생성 | `+` 버튼 클릭 시 빈 맵 생성 (`isLocal=true`) |
| 맵 이름 변경 | 헤더의 Edit 아이콘 → 인라인 편집 |
| 맵 삭제 | 목록에서 휴지통 → 확인 팝오버 |
| 목록 전환 | 드롭다운에서 현재 모드의 맵 선택 → 캔버스 로드 |
| 전체 노드 삭제 | "전체 노드 삭제" 버튼 (맵 자체는 유지) |
| 모드별 독립 | 채팅 모드 전환 시 해당 모드의 마지막 맵 자동 복원 |

### 2.3 캔버스 & 시각화
| 기능 | 설명 |
|------|------|
| 자동 레이아웃 | dagre 기반 좌→우 계층 배치 (노드 간격 50px, 레벨 간격 180px) |
| 자동 fitView | 노드 개수 변동 / 접기·펼치기 시 `maxZoom: 1.5`로 자동 정렬 |
| 줌 컨트롤 | ZoomIn / ZoomOut / 전체보기 |
| PDF 내보내기 | html-to-image + jsPDF → 캔버스 캡처 다운로드 |

### 2.4 서버 동기화
| 기능 | 설명 |
|------|------|
| 목록 pull | 패널 마운트 시 `GET /mindmap/list` (로그인 시에만) |
| 상세 로드 | placeholder(nodes=[]) 진입 시 `GET /mindmap/{id}` |
| 디바운스 저장 | 변이 후 1.5초 → `POST /mindmap/save` |
| 즉시 저장 | `saveActiveNow()` API 노출 (현재 미사용) |
| 신규 id 발급 | `isLocal=true` 맵은 첫 저장 시 서버 id로 **키 교체** |
| 실패 재시도 | 단일 재시도(3s), 실패 시 `error` 상태 (클릭으로 수동 재시도) |
| 저장 상태 표시 | "아직 저장 안 됨" / "저장 중" / "방금 저장됨" / "N초 전 저장됨" / "HH:MM 저장됨" / "저장 실패" |
| 비로그인 보호 | `accessToken` 없으면 서버 호출 자동 스킵 (로컬 편집만 가능) |

### 2.5 영속성
- Zustand `persist` — localStorage key `mindmap-store`
- 저장 대상: `maps`, `lastActiveByMode`
- **마이그레이션 v0 → v1**: 구버전 `nodes[]` 배열 → `migrated-<ts>` id를 가진 `maps{}` 항목으로 변환, `lastActiveByMode.general`에 등록

---

## 3. 아키텍처

### 3.1 스토어 (`src/stores/useMindmapStore.js`)

#### 핵심 상태
| 키 | 타입 | 의미 |
|----|------|------|
| `maps` | `{ [id]: MapRecord }` | 모든 맵 (모든 모드 통합 저장) |
| `activeMapId` | `string \| null` | 캔버스에 표시 중인 맵 |
| `lastActiveByMode` | `{ [mode]: mapId }` | 모드별 마지막 맵 (복원용) |
| `selectedNodeId` | `string \| null` | 현재 선택 노드 |
| `syncStatus` | `{ [mapId]: 'idle'\|'saving'\|'saved'\|'error' }` | 맵별 동기화 상태 |
| `lastServerSyncAt` | `{ [mapId]: timestamp }` | 맵별 서버 저장 시각 |
| `lastSavedAt` | `timestamp` | 로컬 편집 마지막 시각 |
| `isListLoading` | `boolean` | 목록 pull 중 플래그 |

#### MapRecord 스키마
```js
{
  id: string,           // 로컬 임시 id 또는 서버 id
  title: string,
  mode: 'general'|'cert'|'rag',
  nodes: Node[],
  isLocal?: boolean,    // true면 미저장(신규) 맵
  createdAt: number,
  updatedAt: number,
}
```

#### Node 스키마
```js
{
  id: string,
  label: string,        // 최대 200자
  parentId: string|null,
  position: { x, y },   // dagre가 덮어쓰되 드래그 후에는 보존
  color: null|'blue'|'green'|'red'|'yellow'|'purple',
  collapsed?: boolean,  // FE 전용 UI 상태, 서버 전송 시 strip
}
```

#### 모듈 스코프 (인스턴스 상태)
- `saveTimers: Map<mapId, TimeoutHandle>` — 디바운스 타이머
- `dirtySet: Set<mapId>` — 저장 중 누적된 편집 플래그
- 상수: `SAVE_DEBOUNCE_MS=1500`, `SAVE_RETRY_MS=3000`

#### 주요 액션
| 액션 | 역할 |
|------|------|
| `createMap(mode, title)` | 신규 맵 생성 + scheduleSave |
| `deleteMap(mapId)` | 타이머 취소 + 서버 삭제(fire-and-forget) + 로컬 제거 |
| `renameMap(mapId, title)` | 제목 변경 + scheduleSave |
| `loadMap(mapId)` | 캔버스에 맵 로드 + `lastActiveByMode` 갱신 |
| `restoreForMode(mode)` | 모드 전환 시 자동 호출되는 복원 |
| `addNode / deleteNode / updateNode / clearAll` | 노드 CRUD, 전부 `scheduleSave` 체이닝 |
| `toggleCollapsed(id)` | UI 전용, **저장 안 함** |
| `fetchMapList()` | 서버 목록 동기화 (로컬 nodes는 보존) |
| `loadMapFromServer(id)` | 특정 맵 상세 pull |
| `scheduleSave(mapId)` | 1.5s 디바운스 예약 |
| `_performSave(mapId, isRetry)` | 실제 저장 실행, 신규 id 키 교체 처리 |
| `reset()` | 로그아웃 시 타이머 정리 + 상태 초기화 |

### 3.2 UI 컴포넌트 계층
```
MainContent
└─ SplitView (isRightVisible=isMindmapOn)
   └─ MindmapPanel
      ├─ 헤더: 맵 제목 + Edit + SyncIndicator
      ├─ 목록 드롭다운 (모드 필터링)
      ├─ MindmapCanvas (ReactFlow)
      │  ├─ MindmapNode (커스텀 노드)
      │  ├─ MindmapControls (줌/전체/PDF)
      │  └─ NodeContextMenu (우클릭)
      └─ 입력창 + 전체 삭제 버튼
```

| 파일 | 주요 역할 |
|------|----------|
| [src/components/mindmap/MindmapPanel.jsx](../src/components/mindmap/MindmapPanel.jsx) | 목록·헤더·입력창·동기화 인디케이터 |
| [src/components/mindmap/MindmapCanvas.jsx](../src/components/mindmap/MindmapCanvas.jsx) | ReactFlow 래퍼, hiddenSet/visibleNodes, 자동 fitView |
| [src/components/mindmap/MindmapNode.jsx](../src/components/mindmap/MindmapNode.jsx) | 노드 컴포넌트, 더블클릭 편집, 색상, 접기 버튼 |
| [src/components/mindmap/MindmapControls.jsx](../src/components/mindmap/MindmapControls.jsx) | 하단 컨트롤 (줌·전체·PDF) |
| [src/components/mindmap/NodeContextMenu.jsx](../src/components/mindmap/NodeContextMenu.jsx) | 우클릭 메뉴 (삭제·색상) |
| [src/utils/layoutGraph.js](../src/utils/layoutGraph.js) | dagre 레이아웃 유틸 |
| [src/utils/exportPdf.js](../src/utils/exportPdf.js) | PDF 캡처/다운로드 |

### 3.3 API
| 메서드 | 엔드포인트 | 요청 | 응답 |
|--------|------------|------|------|
| POST | `/mindmap/save` | `{ id?, title, mode, nodes }` | `{ id, title, mode, nodeCount, savedAt }` |
| GET | `/mindmap/list` | — | `[{ id, title, mode, updatedAt, nodeCount }]` |
| GET | `/mindmap/{id}` | — | `{ id, title, mode, nodes }` |
| DELETE | `/mindmap/{id}` | — | `{ id }` |

- 어댑터: [src/services/mindmapApi.js](../src/services/mindmapApi.js)
- Mock: [src/services/mock/mindmapMock.js](../src/services/mock/mindmapMock.js) — 세션 유지용 `Map` 기반

---

## 4. 핵심 사용자 흐름

### 4.1 신규 맵 생성 → 자동 저장
1. 사용자 `+` 버튼 → `createMap(mode, '새 마인드맵')`
2. 로컬에 `isLocal:true`로 등록, `scheduleSave(id)` 1.5s 예약
3. 1.5s 경과 → `_performSave()`
   - `accessToken` 없으면 스킵 (로그인 후 자연스럽게 재시도됨)
   - 있으면 `POST /mindmap/save` (id 미포함) → 서버가 id 발급
   - 로컬 `maps` 키 교체 + `activeMapId` + `lastActiveByMode` 동시 갱신
   - `isLocal:false`, `syncStatus:'saved'`
4. 인디케이터: "아직 저장 안 됨" → "저장 중" → "방금 저장됨"

### 4.2 노드 추가
1. 입력창 Enter → `addNode(selectedNodeId, label)`
2. 부모가 접혀있으면 자동 펼침 (`collapsed:false`)
3. `scheduleSave` 체이닝
4. 캔버스: `nodesInitialized` + 노드 개수 변경 감지 → fitView

### 4.3 접기/펼치기
1. 노드의 `▸ N` 클릭 → `toggleCollapsed(nodeId)`
2. 캔버스 재계산: `hiddenSet` (접힌 노드의 모든 후손) → `visibleNodes`만 렌더
3. **서버에는 저장되지 않음** (UI 전용 상태)

### 4.4 모드 전환
1. `useAppStore.setMainMode(mode)` 호출
2. 즉시 `useMindmapStore.restoreForMode(mode)` 실행
3. `lastActiveByMode[mode]` 기반으로 맵 복원, 없으면 `activeMapId:null`

### 4.5 로그아웃
1. `useAuthStore.logout()` → `resetUserStores()`
2. `useMindmapStore.reset()`: 모든 `saveTimers` 취소 → `dirtySet` 비움 → 상태 초기화
3. localStorage `mindmap-store` 삭제

---

## 5. 구현 타임라인 (주요 커밋)

| 커밋 | 내용 |
|------|------|
| `8afea2eb` | R5 — Zustand persist 적용 (마인드맵 localStorage) |
| `9f2b7690` | dagre 자동 레이아웃 + 한국어 IME 이중 입력 수정 |
| `85a6a0b8` | PDF 다운로드 기능 |
| `7d74dfbe` | 툴바 개선 — 아이콘+라벨, 커스텀 툴팁 |
| `912d9032` | 모드별 독립 관리 — `nodes[]` → `maps{}` + `lastActiveByMode` |
| `dedc58b6` | 서버 동기화 — fetchMapList / loadMapFromServer / scheduleSave / SyncIndicator |
| `2e9f2c8e` | 비로그인 상태 서버 호출 차단 |
| `027ad34e` | 노드 추가 중 401 시 페이지 리로드 버그 수정 |
| `9a2bfcfe` | 노드 접기/펼치기 + fitView 개선 |

자세한 내용: [WORK_LOG.md](WORK_LOG.md) 2026-04-16 ~ 2026-04-20 섹션.

---

## 6. 알려진 제약 · 주의사항

| 항목 | 상태 |
|------|------|
| `collapsed` 필드 | FE 전용, 저장 시 strip — BE에서 계층 저장 지원 시 스토어에서 제거 예정 |
| 비로그인 모드 | 로컬 편집은 가능하나 서버 미반영, 로그인 후 수동 편집 트리거 시 자연 업로드 |
| Undo/Redo | 미지원 |
| 공동 편집 (CRDT) | 미지원 |
| 노드 복사/붙여넣기 | 미지원 |
| 노드 글꼴/크기 커스터마이징 | 미지원 |
| 신규 맵 id 키 교체 | 디바운스 중 `dirty` 누적 → 교체 후 재예약으로 처리 (`_performSave` 말미) |

---

## 7. 디버깅 · 점검 체크리스트 (현재 "잘 안 된다" 진단용)

1. **패널이 열리지 않음** — `useAppStore.isMindmapOn` 값 확인, 사이드바 토글 상태
2. **목록이 비어있음** — 로그인 여부 (`accessToken`) / `fetchMapList` 네트워크 응답 확인
3. **저장이 안 됨** — SyncIndicator 상태 확인:
   - "저장 실패" → 클릭으로 재시도, 네트워크 탭에서 `/mindmap/save` 응답 확인
   - 계속 "아직 저장 안 됨" → 로그인 여부 점검 (비로그인 시 정상적으로 스킵됨)
4. **노드가 렌더되지 않음** — `loadMapFromServer`가 placeholder 덮어썼는지 콘솔 확인
5. **모드 전환 후 다른 맵이 보임** — `lastActiveByMode[mode]` 의도한 값인지 확인
6. **접기 후 레이아웃 깨짐** — `hiddenSet` 재계산 여부 (MindmapCanvas 34-59줄)
7. **드래그 후 위치 리셋** — dagre가 매번 덮어쓰므로 정상. 드래그 위치를 영구 고정하려면 별도 flag 필요
8. **IME 중 엔터가 노드 추가함** — `e.nativeEvent.isComposing` 체크 누락 의심

---

## 8. 앞으로의 과제 (우선순위 TBD)

- [ ] `collapsed` 서버 저장 지원 (BE 협업)
- [ ] Undo/Redo
- [ ] 노드 드래그 위치 영구 고정 모드 토글
- [ ] 공유/내보내기 포맷 확장 (PNG, JSON)
- [ ] 공동 편집 (실시간 동기화)
- [ ] 템플릿 (학습 주제별 프리셋 맵)
