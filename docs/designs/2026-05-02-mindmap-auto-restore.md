# 설계: 2026-05-02-mindmap-auto-restore

**생성:** 2026-05-02 17:12
**워크트리:** /Users/moon/DevLearn_FE_wt/2026-05-02-mindmap-auto-restore
**브랜치:** task/2026-05-02-mindmap-auto-restore

## 목표
"내 마인드맵" 에서 자동 생성 마인드맵을 soft 삭제하더라도 **자동 생성 탭에서는 계속 보이게** 하고, 거기서 **클릭 시 자동 복구되어 다시 "내 마인드맵" 에서 관리** 할 수 있게 한다.

## 사용자 모델
- **내 마인드맵 (manual 탭)** — 작업 영역. soft delete 가능 (현재 동작 유지). 자동/수동 모두.
- **자동 생성 (auto 탭)** — 문서별 챕터 마인드맵의 "라이브러리". soft 삭제 여부와 무관하게 *이미 생성된 모든 챕터 마인드맵* 노출.
- **자동 생성 탭에서 챕터 클릭** → 해당 마인드맵이 soft 삭제 상태였다면 자동 복구(`deleted_at = NULL`) 후 캔버스 로드 + "내 마인드맵" 탭으로 전환.

## 변경 범위

### BE (DevLearn_BE)
| 파일 | 변경 |
|------|------|
| `MindmapMapper.java/.xml` | 신규: `findByDocIdIncludingDeleted`, `findByIdIncludingDeleted`, `restoreById` |
| `MindmapMapper.xml` `countByUserAndDocAndChapter` | **수정: deleted_at 필터 제거** (UNIQUE 제약 회피용 멱등성 체크는 soft 삭제 포함해서 봐야 함) |
| `MindmapSynthesisService.java` | `getChapterStatuses`, `getByDocId` 가 `findByDocIdIncludingDeleted` 사용 |
| `MindmapService.java` | 신규 메서드 `restoreMindmap(userId, id)` (소유자 확인 후 restoreById 호출) |
| `MindmapController.java` | 신규 엔드포인트 `POST /api/mindmap/{id}/restore` |

### FE (DevLearn_FE)
| 파일 | 변경 |
|------|------|
| `services/mindmapApi.js` | `restoreMindmap(id)` 추가 |
| `services/mock/mindmapMock.js` | mock 구현 (필요 시) |
| `components/mindmap/AutoMindmapTab.jsx` | `handleOpen` 에서 `getMindmap` 호출 전 `restoreMindmap(id)` 호출 |

## 핵심 결정사항

### 1. AutoMindmapTab 의 챕터 상태는 "library 뷰" 가 된다
- 현재: `getChapterStatuses` 가 `findByDocId` 호출 → soft 삭제된 건 제외 → "not_generated" 로 표시 → 사용자가 다시 생성 트리거 가능 → UNIQUE 제약 위반 / LLM 토큰 낭비
- 변경 후: `findByDocIdIncludingDeleted` 사용 → soft 삭제된 챕터 마인드맵도 "completed" 로 표시 → 사용자는 [보기] 만 클릭하면 복구

### 2. 복구는 명시적 별도 엔드포인트
- `POST /api/mindmap/{id}/restore` — 소유자 확인 + `UPDATE mindmaps SET deleted_at = NULL WHERE id = ? AND deleted_at IS NOT NULL`
- **멱등 안전**: 이미 살아있으면 영향 0건이지만 200 반환 (FE 가 항상 호출해도 무해)
- AutoMindmapTab 의 `handleOpen` 이 항상 restore 를 먼저 호출 → 살아있는 것도 무해, 죽은 것은 살아남

### 3. 멱등성 체크 (`countByUserAndDocAndChapter`) 필터 원복
- 직전 soft-delete 태스크에서 추가한 `AND deleted_at IS NULL` 을 **제거**한다
- 이유: 챕터당 unique 인덱스(`uq_mindmap_doc_chapter`) 는 soft 삭제된 행도 포함 → 멱등성 체크가 살아있는 것만 보면 INSERT 시 UNIQUE 위반
- 새 모델에서는 어차피 사용자가 자동 생성 탭에서 [보기] 누르면 복구되므로, 재합성 트리거 자체가 거의 발생하지 않음. 그래도 BE 수준의 정합성은 보장.

### 4. 자동 생성 마인드맵의 "복구된 활성 맵" UX
- AutoMindmapTab.handleOpen 은 이미 `useMindmapStore.setState` 로 직접 store 에 추가하고 `onOpenMap?.()` 로 manual 탭 전환
- restore 호출만 추가하면 됨 — 다음번 `fetchMapList` 에서도 살아있게 보임

## 구현 계획

### BE

**1. Mapper interface — 신규 3개**
```java
/** soft 삭제 포함 — AutoMindmapTab "library" 뷰 용 */
List<MindmapEntity> findByDocIdIncludingDeleted(@Param("docId") String docId);

/** soft 삭제 포함 — restore 시 소유자 확인용 */
MindmapEntity findByIdIncludingDeleted(@Param("id") String id);

/** soft 삭제 해제 — UPDATE deleted_at = NULL. 멱등 (살아있으면 0행 영향). */
int restoreById(@Param("id") String id);
```

**2. Mapper XML 신규 + 수정**
```xml
<select id="findByDocIdIncludingDeleted" resultMap="MindmapResultMap">
    SELECT id, user_id, title, mode, doc_id, chapter, parent_chapter,
           llm_model, input_tokens, output_tokens, cost_usd, duration_ms, input_chars,
           pass1_analysis, created_at, updated_at
    FROM mindmaps
    WHERE doc_id = #{docId}::uuid
    ORDER BY chapter
</select>

<select id="findByIdIncludingDeleted" resultMap="MindmapResultMap">
    SELECT ...
    FROM mindmaps
    WHERE id = #{id}::uuid
</select>

<update id="restoreById">
    UPDATE mindmaps
    SET deleted_at = NULL
    WHERE id = #{id}::uuid
      AND deleted_at IS NOT NULL
</update>

<!-- 수정 — 멱등성 체크는 soft 삭제 포함해야 UNIQUE 위반 방지 -->
<select id="countByUserAndDocAndChapter" resultType="int">
    SELECT COUNT(*)
    FROM mindmaps
    WHERE user_id = #{userId}::uuid
      AND doc_id = #{docId}::uuid
      AND chapter = #{chapter}
    <!-- deleted_at 필터 의도적으로 없음 — UNIQUE 인덱스가 soft 삭제 행도 포함 -->
</select>
```

**3. MindmapSynthesisService 수정**
- `getChapterStatuses` 의 `mindmapMapper.findByDocId(docId)` → `mindmapMapper.findByDocIdIncludingDeleted(docId)`
- `getByDocId` 의 `mindmapMapper.findByDocId(docId)` → `mindmapMapper.findByDocIdIncludingDeleted(docId)`
- 다른 callers (`deleteByDocId` 의 로깅용 line 168/374) 는 그대로 유지 (alive 만 보고싶음)

**4. MindmapService 신규 메서드**
```java
@Transactional
public void restoreMindmap(String userId, String id) {
    if (id == null || id.isBlank() || !isValidUuid(id)) {
        throw new BusinessException(ErrorCode.INVALID_INPUT, "마인드맵 ID 가 올바르지 않습니다");
    }
    MindmapEntity mindmap = mindmapMapper.findByIdIncludingDeleted(id);
    if (mindmap == null) {
        throw new BusinessException(ErrorCode.NOT_FOUND, "마인드맵을 찾을 수 없습니다");
    }
    verifyOwner(mindmap, userId);
    mindmapMapper.restoreById(id);  // 멱등 — 살아있으면 0행 영향
}
```

**5. MindmapController 신규 엔드포인트**
```java
@PostMapping("/{id}/restore")
public ApiResponse<Void> restore(@PathVariable String id) {
    String userId = getCurrentUserId();
    mindmapService.restoreMindmap(userId, id);
    return ApiResponse.success(null);
}
```

### FE

**1. mindmapApi.js — restoreMindmap**
```js
export async function restoreMindmap(id) {
  if (API_CONFIG.useMock) return;  // mock no-op (mock 은 hard delete 라 복구 개념 없음)
  await api.post(`/mindmap/${id}/restore`);
}
```

**2. AutoMindmapTab.handleOpen — restore 먼저**
```js
const handleOpen = async (ch) => {
  if (!ch.mindmapId) return;
  try {
    await restoreMindmap(ch.mindmapId);  // 살아있으면 무해, 죽었으면 복구
    const detail = await getMindmap(ch.mindmapId);
    // ... 기존 store setState + onOpenMap
  } catch (err) {
    showError(err, '마인드맵을 불러올 수 없습니다');
  }
};
```

## 단위 테스트 계획

### BE
1. **soft 삭제된 자동 마인드맵이 chapter status 에서 "completed" 로 노출**: 자동 마인드맵 생성 → soft 삭제 → `GET /feynman/mindmap/chapters/{docId}` 응답에 status="completed" + mindmapId 채워짐 ✅
2. **restore 동작**: soft 삭제된 마인드맵 → `POST /mindmap/{id}/restore` 200 → DB deleted_at NULL → list 에 다시 노출
3. **restore 멱등**: 살아있는 마인드맵에 restore 호출 → 200, DB 무변화
4. **restore 소유자 가드**: 타인 mindmap restore 시도 → 403 FORBIDDEN
5. **restore 존재 X**: 잘못된 UUID → 400, 없는 ID → 404
6. **멱등성 체크 원복**: 같은 doc+chapter 조합 (소유자 동일) 에 soft 삭제된 mindmap 존재 시 `countByUserAndDocAndChapter` = 1 (UNIQUE 위반 방지)

### FE
1. AutoMindmapTab "보기" 클릭 → 백엔드에 restore + getMindmap 순차 호출 → 마인드맵이 캔버스 로드 + manual 탭 전환
2. soft 삭제된 자동 마인드맵도 "완료" 로 표시되고, "보기" 누르면 복구되어 "내 마인드맵" 목록에 다시 나타남

증거: `.claude/state/evidence/2026-05-02-mindmap-auto-restore/unit/notes.md`

## 회귀 테스트 계획
1. **수동 단건/일괄 삭제** — 변경 없는 동작 유지
2. **마인드맵 저장 / 노드 추가** — 무영향
3. **챕터 자동 생성** — 멱등성 체크 원복 후에도 정상 (이전엔 soft 삭제 후 재합성 시 UNIQUE 위반 위험; 수정으로 해결)
4. **dev-health** — FE/BE 살아있음

증거: `.claude/state/evidence/2026-05-02-mindmap-auto-restore/regression/notes.md`
