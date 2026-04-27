# 설계: 2026-04-27-docs-pipeline-pagination

**생성:** 2026-04-27 12:57
**워크트리:** /Users/moon/DevLearn_FE_wt/2026-04-27-docs-pipeline-pagination
**브랜치:** task/2026-04-27-docs-pipeline-pagination

## 목표
- 파인만 → 파이프라인 관리 페이지 문서 목록을 페이징 처리. 스크롤 길이를 줄이고 폴링 비용도 현재 페이지로 한정.
- **방식**: 페이지 번호(1, 2, 3, …) + 페이지당 **10건** 고정.
- **상태 필터** 추가: 전체 / 업로드 / 진행 중 / 완료 / 오류
- 정렬은 기존대로 `created_at DESC` 고정(이번 작업 범위 외).
- BE 쿼리/엔드포인트, FE UI/호출 둘 다 수정.

## 변경 범위

### BE
- 새 DTO: `DocPageResponse` `{ items: List<DocResponse>, totalCount, page, size, totalPages }`
- `FeynmanController.getAllDocs(...)` — `@RequestParam` 추가
  - `page` (default=0, 0-base) / `size` (default=15) / `status` (default="all")
  - 반환 타입: `ApiResponse<List<DocResponse>>` → `ApiResponse<DocPageResponse>`
- `FeynmanService.getAllDocs(userId, page, size, status)` — 시그니처 변경, `DocPageResponse` 반환
- `FeynmanMapper`
  - `findDocsByUserIdPaged(userId, status, limit, offset)` 신규
  - `countDocsByUserId(userId, status)` 신규
- `FeynmanMapper.xml` — 위 두 SQL 추가. status는 다음과 같이 매핑:
  - `all` → 조건 없음
  - `uploaded` → `status = 'uploaded'`
  - `processing` → `status IN ('extracting', 'grouping', 'embedding')`
  - `completed` → `status = 'completed'`
  - `error` → `status = 'error'`
- 기존 `findAllDocsByUserId`는 페이징 SQL로 대체(또는 미사용 시 제거).

### FE
- `src/services/feynmanApi.js`
  - `fetchAllDocs()` → `fetchDocsPage({ page, size, status })` 로 교체.
    응답: `{ items, totalCount, page, size, totalPages }`
- `src/components/feynman/FeynmanPipelineTab.jsx`
  - state 확장: `page`, `status`, `totalPages`, `totalCount`
  - 상단 헤더 옆에 상태 필터 select(전체/업로드/진행 중/완료/오류)
  - 본문 끝에 페이지네이션 컨트롤(이전 / 번호 / 다음)
  - `loadDocs(page, status)` — 호출 시 페이지+필터 반영. status가 바뀌면 page=0으로 리셋.
  - 업로드 끝나고 `loadDocs(0, status)`로 첫 페이지 노출(최신 업로드 즉시 보임).
  - 폴링: 현재 페이지의 `items` 중 진행 중 문서가 있을 때만 3초 폴링(같은 page+status로 reload).

### 비변경
- 기타 모듈(마인드맵, 채팅, 인증), `RagDoc` 스키마, 다른 매퍼.

## 구현 계획
1. **BE** — `DocPageResponse` 추가, 매퍼 두 메서드 + XML 두 select 추가, 서비스/컨트롤러 시그니처 갱신.
2. **빌드/실행** — `./gradlew compileJava` 또는 IDE 빌드. 가능하면 BE 재기동.
3. **FE 서비스** — `fetchDocsPage` 교체.
4. **FE UI** — `FeynmanPipelineTab`에 상태 필터 + 페이지네이션 컨트롤 + state 갱신.
5. **수동 테스트(Step 2)** — 데이터 N건 기준 1페이지/2페이지 이동, 필터 변경, 업로드 후 1페이지로 리셋.
6. **회귀(Step 3)** — 다른 모듈(마인드맵 자동 생성 탭 등) 동작 확인.

## 단위 테스트 계획
- [ ] 페이지당 10건 노출 확인 (11번째는 2페이지)
- [ ] 카드 우측에 상태 뱃지가 일관되게 노출(업로드/진행 중/완료/오류 모두 우측)
- [ ] "전체" 필터 카운트 = 모든 상태 합
- [ ] "진행 중" 필터: extracting/grouping/embedding만 보임
- [ ] "완료" 필터: completed만 보임
- [ ] "오류" 필터: error만
- [ ] 필터 변경 시 page=1(0-base 0)로 리셋
- [ ] 업로드 직후 1페이지로 이동 + 새 문서 노출
- [ ] 진행 중 문서 있는 페이지에서만 3초 폴링 재호출(다른 페이지로 이동하면 정지)
- [ ] 마지막 페이지에서 "다음" 비활성화, 1페이지에서 "이전" 비활성화
- 결과: `.claude/state/evidence/2026-04-27-docs-pipeline-pagination/unit/notes.md`

## 회귀 테스트 계획
- [ ] 마인드맵 자동 생성 탭: 챕터 상태 정상 표시
- [ ] 사이드바 문서 업로드 모달: 멀티 업로드 OK (이전 작업 기능 유지)
- [ ] 채팅(파인만 또는 일반): 메시지 송수신 OK
- 결과: `.claude/state/evidence/2026-04-27-docs-pipeline-pagination/regression/notes.md`
