# 설계: 2026-05-02-mindmap-select-all

**생성:** 2026-05-02 17:02
**워크트리:** /Users/moon/DevLearn_FE_wt/2026-05-02-mindmap-select-all
**브랜치:** task/2026-05-02-mindmap-select-all

## 목표
"내 마인드맵" 일괄 삭제 선택 모드에서 **전체 선택 / 전체 해제** 토글 버튼을 추가해 클릭 한 번으로 현재 모드의 모든 마인드맵을 일괄 체크/해제할 수 있게 한다.

## 변경 범위

### FE only — `components/mindmap/MindmapPanel.jsx`
- 선택 모드 헤더 좌측에 **전체선택 / 전체해제** 토글 버튼 추가
- 라벨/아이콘은 현재 상태(전부 체크 vs 부분/0)에 따라 자동 전환
- 빈 목록일 때는 버튼 자체 숨김

### BE
변경 없음 (기존 `delete-batch` API 그대로 사용).

## UX

```
[선택 모드 헤더 — 변경 후]
┌──────────────────────────────────────────────────────┐
│ ☑ 전체선택   클릭하여 선택            ✕ 닫기         │
├──────────────────────────────────────────────────────┤
│ ☑ map A                                              │
│ ☑ map B                                              │
│ ☑ map C                                              │
└──────────────────────────────────────────────────────┘
```

- 라벨/아이콘:
  - 모두 체크: `CheckSquare` + `전체해제`
  - 부분 또는 0개: `Square` + `전체선택`
- 클릭 = 토글 (모두 체크 ↔ 모두 해제)
- 모드 전환 시 선택 모드 자체가 닫히므로 별도 처리 불필요

## 구현 계획

`MindmapPanel.jsx` 변경:

1. 파생 상태 (계산 비용 사소):
   ```jsx
   const allSelected = modeMapList.length > 0
     && modeMapList.every((m) => selectedIds.has(m.id));
   ```

2. 토글 핸들러:
   ```jsx
   const toggleSelectAll = useCallback(() => {
     if (allSelected) {
       setSelectedIds(new Set());
     } else {
       setSelectedIds(new Set(modeMapList.map((m) => m.id)));
     }
   }, [allSelected, modeMapList]);
   ```

3. 헤더 JSX 수정 — 현재의 안내 텍스트를 "클릭하여 선택" 으로 짧게 줄이고 그 좌측에 전체선택 버튼 삽입:
   ```jsx
   <div className="flex items-center justify-between px-3 py-1.5 border-b border-border-light bg-bg-primary">
     <div className="flex items-center gap-2 min-w-0">
       {modeMapList.length > 0 && (
         <button onClick={toggleSelectAll} ...>
           {allSelected ? <CheckSquare size={14}/> : <Square size={14}/>}
           {allSelected ? '전체해제' : '전체선택'}
         </button>
       )}
       <span className="text-xs text-text-tertiary truncate">클릭하여 선택</span>
     </div>
     <button onClick={exitSelectionMode}>...닫기</button>
   </div>
   ```

## 단위 테스트 계획
1. 선택 모드 진입 → 헤더에 "전체선택" 버튼 노출, Square 아이콘
2. "전체선택" 클릭 → 모든 행 체크 표시, 라벨이 "전체해제" + CheckSquare 로 변경, 액션바 카운트 = N
3. "전체해제" 클릭 → 모든 행 해제, 라벨이 "전체선택" + Square 로 변경, 액션바 0개 + [삭제] disabled
4. 일부만 수동 체크 → 라벨 여전히 "전체선택" (부분 상태)
5. 빈 목록(modeMapList.length === 0) → 전체선택 버튼 자체 숨김
6. 전체선택 → [삭제] → 토스트 카운트 = 모드 전체 mindmap 수
7. 모드 탭 전환 후 다시 선택 모드 진입 시 깨끗한 초기 상태

증거: `.claude/state/evidence/2026-05-02-mindmap-select-all/unit/notes.md`

## 회귀 테스트 계획
1. 단건 삭제 (선택 모드 OFF) — 기존 호버 휴지통 동작 유지
2. 일괄 삭제 — 전체선택 안 거치고 수동 체크 부분 삭제도 정상
3. 마인드맵 저장/생성 — 무영향
4. dev-health: FE/BE 모두 살아있음

증거: `.claude/state/evidence/2026-05-02-mindmap-select-all/regression/notes.md`
