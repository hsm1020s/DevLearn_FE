# 설계: 2026-05-02-mindmap-batch-delete

**생성:** 2026-05-02 16:50
**워크트리:** /Users/moon/DevLearn_FE_wt/2026-05-02-mindmap-batch-delete
**브랜치:** task/2026-05-02-mindmap-batch-delete

## 목표
"내 마인드맵" 목록에서 체크박스로 여러 마인드맵을 선택해 한 번에 soft 삭제하고, 완료 후 "N개 마인드맵이 삭제되었습니다" 토스트로 결과를 알린다.

## 변경 범위

### BE (DevLearn_BE)
| 파일 | 변경 |
|------|------|
| `mindmap/mapper/MindmapMapper.java` | `softDeleteByIds(userId, ids)` 메서드 추가, 반환 `int` |
| `mapper/mindmap/MindmapMapper.xml` | `softDeleteByIds` UPDATE 추가 (foreach IN, user_id 가드) |
| `mindmap/service/MindmapService.java` | `deleteMindmaps(userId, ids)` 추가 (UUID 검증) |
| `mindmap/dto/DeleteBatchRequest.java` | 신규 DTO `{ List<String> ids }` |
| `mindmap/dto/DeleteBatchResponse.java` | 신규 DTO `{ int deletedCount }` |
| `mindmap/controller/MindmapController.java` | `POST /api/mindmap/delete-batch` 엔드포인트 |

### FE (DevLearn_FE)
| 파일 | 변경 |
|------|------|
| `services/mindmapApi.js` | `deleteMindmapsBatch(ids)` 추가 |
| `services/mock/mindmapMock.js` | mock 구현 추가 |
| `stores/useMindmapStore.js` | `deleteManyMaps(ids)` 액션 추가 (optimistic + 카운트 반환) |
| `components/mindmap/MindmapPanel.jsx` | 선택 모드 토글 + 체크박스 + 액션바 + 팝오버 + 토스트 |

## UX 사양

### 진입점
드롭다운(`showList`) 헤더 우측에 **선택** 버튼 추가 (CheckSquare 아이콘 + 텍스트). 클릭 시 `selectionMode=true`.

### 선택 모드 활성 시
- 헤더 버튼이 "선택 해제" + X 아이콘으로 토글
- 각 마인드맵 행:
  - 좌측에 체크박스 (`<input type="checkbox" className="accent-primary">`)
  - 행 전체 클릭 = 선택/해제 토글 (라벨 영역도 포함; 평소의 `handleSelect` 비활성)
  - 호버 휴지통 아이콘 숨김 (단건 삭제는 선택 모드 종료 후만 가능)
- 드롭다운 최하단에 sticky 액션바:
  - 좌측: `{selectedIds.size}개 선택됨` (회색 텍스트)
  - 우측: `[취소]` (선택 비우고 모드 종료) + `[삭제]` (팝오버 띄움; 0개일 때 disabled)

### 삭제 확인 팝오버
- 액션바 위에 인라인 팝오버 (기존 단건 삭제 확인 패턴 차용)
- 메시지: `{N}개 마인드맵을 삭제할까요?`
- 보조: `삭제된 마인드맵은 보관되지만, 목록에서는 사라집니다`
- 버튼: `[삭제]` (danger 컬러) / `[취소]`

### 결과 토스트
- 성공: `addToast(`${deletedCount}개 마인드맵이 삭제되었습니다`, 'success')`
- 응답 카운트가 0 이면 `'삭제할 마인드맵이 없었습니다'` (이미 누군가 지웠을 때)
- 실패: 기존 `showError(err, '마인드맵 삭제에 실패했습니다')`

### 후처리
- 성공 시: 선택 모드 종료, `selectedIds` 비우고, 활성 맵이 삭제 대상에 포함됐으면 `activeMapId=null` 리셋
- `fetchMapList()` 호출해 서버 상태와 동기화 (낙관적 업데이트 보정)

## 구현 계획

### BE

**1. Mapper XML (`MindmapMapper.xml`)**
```xml
<update id="softDeleteByIds">
    UPDATE mindmaps
    SET deleted_at = now()
    WHERE user_id = #{userId}::uuid
      AND deleted_at IS NULL
      AND id IN
      <foreach collection="ids" item="id" open="(" separator="," close=")">
          #{id}::uuid
      </foreach>
</update>
```
- `user_id` 가드로 타인 ID 위조 차단
- `deleted_at IS NULL` 로 멱등 안전
- 반환값 = 실제 갱신된 행 수

**2. Mapper interface**
```java
int softDeleteByIds(@Param("userId") String userId, @Param("ids") List<String> ids);
```

**3. Service**
```java
@Transactional
public int deleteMindmaps(String userId, List<String> ids) {
    if (ids == null || ids.isEmpty()) return 0;
    List<String> validIds = ids.stream()
        .filter(id -> id != null && isValidUuid(id))
        .distinct()
        .toList();
    if (validIds.isEmpty()) return 0;
    return mindmapMapper.softDeleteByIds(userId, validIds);
}
```

**4. DTO**
- `DeleteBatchRequest { @NotEmpty List<String> ids; }`
- `DeleteBatchResponse { int deletedCount; }`

**5. Controller**
```java
@PostMapping("/delete-batch")
public ApiResponse<DeleteBatchResponse> deleteBatch(
        @AuthenticationPrincipal CustomUserDetails user,
        @Valid @RequestBody DeleteBatchRequest req) {
    int count = mindmapService.deleteMindmaps(user.getId(), req.getIds());
    return ApiResponse.success(DeleteBatchResponse.builder().deletedCount(count).build());
}
```

### FE

**1. `services/mindmapApi.js`**
```js
export async function deleteMindmapsBatch(ids) {
  if (API_CONFIG.useMock) return mock.deleteMindmapsBatch(ids);
  const { data } = await api.post('/mindmap/delete-batch', { ids });
  return data; // { deletedCount }
}
```

**2. `stores/useMindmapStore.js`**
```js
deleteManyMaps: async (ids) => {
  set((state) => {
    const maps = { ...state.maps };
    let activeMapId = state.activeMapId;
    ids.forEach((id) => { delete maps[id]; });
    if (activeMapId && ids.includes(activeMapId)) activeMapId = null;
    return { maps, activeMapId };
  });
  try {
    const { deletedCount } = await deleteMindmapsBatch(ids);
    return deletedCount;
  } catch (err) {
    get().fetchMapList();
    throw err;
  }
},
```

**3. `components/mindmap/MindmapPanel.jsx`**
- 신규 import: `Square, CheckSquare` (lucide-react), `useToastStore`
- 신규 state: `selectionMode`, `selectedIds (Set)`, `showBatchConfirm`
- 신규 핸들러: `enterSelectionMode`, `exitSelectionMode`, `toggleSelected`, `confirmBatchDelete`
- 드롭다운 분기 렌더 (선택 모드 vs 평시)
- `useEffect(() => { exitSelectionMode(); }, [mainMode])` — 모드 전환 시 자동 종료

## 단위 테스트 계획

### BE
1. **본인 소유 N건 일괄 soft 삭제**: 3개 생성 → batch 호출 → response.deletedCount=3, 모두 deleted_at 셋, list 응답 비어있음
2. **타인 ID 끼워넣기 차단**: 본인 1개 + 타인 1개 → response.deletedCount=1, 타인 데이터 무영향
3. **이미 삭제된 ID 포함 — 멱등**: 같은 ID 재요청 → deletedCount=0
4. **빈 배열**: deletedCount=0 (NPE 없이)
5. **잘못된 UUID 형식 포함**: 유효 UUID만 카운트, 나머지는 조용히 무시

### FE
1. 드롭다운 열기 → "선택" 클릭 → 체크박스 노출, 단건 휴지통 숨김
2. 2개 체크 → 액션바 "2개 선택됨", [삭제] 활성
3. [삭제] → 팝오버 → 확인 → 토스트, 목록 갱신, 모드 종료
4. 0개 선택 시 [삭제] disabled
5. 모드 탭 전환 시 선택 모드 자동 종료
6. 활성 맵 포함 삭제 → 캔버스 빈 상태로 전환

증거: `.claude/state/evidence/2026-05-02-mindmap-batch-delete/unit/notes.md`

## 회귀 테스트 계획
1. **단건 마인드맵 삭제** — 호버 휴지통 → 인라인 확인 → 삭제 (선택 모드 OFF 시) 정상
2. **마인드맵 저장/생성** — 새 마인드맵 + 노드 추가 후 저장
3. **채팅 1턴** — 다른 모듈 영향 없는지

증거: `.claude/state/evidence/2026-05-02-mindmap-batch-delete/regression/notes.md`
