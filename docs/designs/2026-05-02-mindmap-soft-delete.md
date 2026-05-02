# 설계: 2026-05-02-mindmap-soft-delete

**생성:** 2026-05-02 16:31
**워크트리:** /Users/moon/DevLearn_FE_wt/2026-05-02-mindmap-soft-delete
**브랜치:** task/2026-05-02-mindmap-soft-delete

## 목표
"내 마인드맵" 목록에서 사용자가 **삭제** 버튼을 눌렀을 때, 실제 DB row를 지우지 않고 **숨김 처리(soft delete)** 한다.

- 사용자 시야에서는 즉시 사라짐
- DB에는 마인드맵 + 노드 데이터가 그대로 보존됨 → 추후 복원 가능
- "유령 데이터 노출"(필터 누락으로 삭제된 항목이 다시 보이는 사고)이 발생하지 않도록 모든 SELECT 쿼리에 필터 추가
- API 스펙은 그대로 (`DELETE /api/mindmap/{id}` → 204) — FE 무수정

## 변경 범위

### BE (DevLearn_BE)

| 파일 | 변경 |
|------|------|
| `src/main/resources/schema.sql` | `mindmaps` 테이블에 `deleted_at TIMESTAMP NULL` 컬럼 + 부분 인덱스 추가 |
| `src/main/resources/mapper/mindmap/MindmapMapper.xml` | 모든 SELECT/UPDATE에 `deleted_at IS NULL` 필터, `deleteById`를 UPDATE로 교체 |
| `src/main/java/com/moon/devlearn/mindmap/service/MindmapService.java` | `deleteMindmap()` 에서 노드 삭제 호출 제거 (마인드맵만 soft delete) |
| 운영 DB | 수동 ALTER TABLE 실행 (Spring sql.init 비활성 — schema.sql은 레퍼런스 문서) |

### FE
변경 없음.

### 영향 범위 — 변경하지 않는 것

- `MindmapNodeMapper.xml` — 변경 없음 (노드는 자체 `deleted_at` 컬럼 미도입; 마인드맵 필터로 보호됨)
- `MindmapService.saveMindmap` 의 `deleteByMindmapId` 호출 — 그대로 HARD DELETE 유지 (전체-교체 패턴; 매번 저장 시 노드를 갈아엎는 구조라 soft 전환 시 dead row 누적)
- `MindmapMapper.deleteByDocId` / `FeynmanMapper.deleteMindmapsByDocId` — 그대로 HARD DELETE 유지 (TOC 재추출 / 문서 자체 삭제 시 cascade — 사용자 시야가 아닌 시스템 정리 경로)

## 구현 계획

### 1. 스키마 (수동 ALTER + schema.sql 동기화)
```sql
ALTER TABLE mindmaps ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP NULL;
CREATE INDEX IF NOT EXISTS idx_mindmaps_alive_user
    ON mindmaps(user_id, updated_at DESC) WHERE deleted_at IS NULL;
```
schema.sql 의 `CREATE TABLE mindmaps (...)` 블록에도 동일한 컬럼/주석 추가.

### 2. MindmapMapper.xml — 필터 추가 / 삭제 교체

| 쿼리 | 변경 |
|------|------|
| `findById` | `WHERE id = ? AND deleted_at IS NULL` |
| `findByUserId` | `WHERE user_id = ? AND deleted_at IS NULL` |
| `findByDocId` | `WHERE doc_id = ? AND deleted_at IS NULL` |
| `countByUserAndDocAndChapter` | `... AND deleted_at IS NULL` (멱등성 체크 — soft 삭제된 건 새로 만들 수 있어야 함) |
| `updateTitle` | `WHERE id = ? AND deleted_at IS NULL` (방어적) |
| `updateUpdatedAt` | `WHERE id = ? AND deleted_at IS NULL` (방어적) |
| `countTotalNodesByUserId` | JOIN 절에 `m.deleted_at IS NULL` 추가 |
| `deleteById` | `DELETE FROM` → `UPDATE mindmaps SET deleted_at = now() WHERE id = ? AND deleted_at IS NULL` |
| `deleteByDocId` | **변경 없음** (HARD) |
| `countNodesByMindmapId` | **변경 없음** (호출 시점에 mindmap 이미 검증됨) |

### 3. MindmapService.deleteMindmap
```java
// before
mindmapNodeMapper.deleteByMindmapId(id);   // 제거
mindmapMapper.deleteById(id);               // 이제 soft delete UPDATE
// after
mindmapMapper.deleteById(id);  // soft delete only — nodes 보존
```
주석/JavaDoc도 "노드를 먼저 삭제한 뒤" 문구를 "사용자 시야에서 숨김 처리(보존)" 로 갱신.

### 4. 데이터 무결성 / 노드 노출 차단 논증
- **노드 fetch 진입 경로 전수 점검** — `mindmapNodeMapper.findByMindmapId` 호출자:
  1. `MindmapService.getMindmapDetail` → 직전에 `findById`로 mindmap alive 검증 ✓
  2. `MindmapService.saveMindmap` → 같은 검증 ✓
  3. `LectureScriptService:327` → `findByDocId` (필터 적용) 결과 활용 ✓
  4. `FeynmanService:954, 1121` → 동일 ✓
  → 모든 진입 경로에서 mindmap alive 검증이 선행되므로 노드 자체에 `deleted_at`을 두지 않아도 노출 0%.
- 통계 쿼리(`countTotalNodesByUserId`)는 JOIN에 필터 추가로 보장.

### 5. 유령 데이터 노출 방지 체크리스트
- [ ] `git grep "FROM mindmaps"` 로 모든 SQL 위치 확인 → 5곳 (mapper 4 + feynman cascade 1)
- [ ] mindmap 조회용 모든 쿼리에 `deleted_at IS NULL` 적용
- [ ] cascade-delete 쿼리는 의도적으로 미적용(주석 명시)
- [ ] 통계 JOIN 쿼리에 필터 적용
- [ ] 단위 테스트로 "soft 삭제된 마인드맵이 list/detail/save 진입 시 안 나옴" 확인

## 단위 테스트 계획

`MindmapServiceTest`에 다음 시나리오 추가 (이미 있는 테스트 클래스 재활용 또는 신규 작성):

1. **사용자 삭제 → 목록에서 사라짐**: 마인드맵 생성 → `deleteMindmap()` → `getUserMindmaps()` 결과에 없음
2. **사용자 삭제 → 단건 조회 404**: 같은 흐름 → `getMindmapDetail()` 호출 시 `BusinessException(NOT_FOUND)`
3. **사용자 삭제 → DB row 보존**: 직접 SQL로 `SELECT COUNT(*) FROM mindmaps WHERE id = ? AND deleted_at IS NOT NULL` = 1, `SELECT COUNT(*) FROM mindmap_nodes WHERE mindmap_id = ?` > 0 (보존)
4. **사용자 삭제 후 동일 (doc_id, chapter)로 재생성 가능**: 멱등성 체크가 deleted를 무시하는지 확인
5. **save 시 노드 전체 교체는 여전히 HARD**: 두 번 저장 후 `mindmap_nodes` 카운트가 노드 수와 일치 (누적 X)

추가 수동 검증: 로컬 DB에서 `psql`로 직접 ALTER 적용 후 mindmap 1개 만들고 삭제 → row 살아있는지 SELECT.

증거: `.claude/state/evidence/2026-05-02-mindmap-soft-delete/unit/notes.md`

## 회귀 테스트 계획

이번 변경과 무관한 핵심 기능 1개 이상을 실제로 사용:

1. **채팅 기능** — 새 채팅 1턴 주고받기 + 출처 팝오버 정상 표시
2. **마인드맵 생성/저장** — 새 마인드맵 만들고 저장 후 다시 열어서 노드 그대로 (전체-교체가 hard delete로 잘 동작하는지)
3. **파인만 모드** — 문서 한 챕터 자가설명 흐름 (`findByDocId` 가 cited 노드 가져오는 경로)

증거: `.claude/state/evidence/2026-05-02-mindmap-soft-delete/regression/notes.md`
