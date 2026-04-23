# 설계: 2026-04-23-feynman-verify-scope

**생성:** 2026-04-23 12:41
**워크트리:** /Users/moon/DevLearn_FE_wt/2026-04-23-feynman-verify-scope
**브랜치:** task/2026-04-23-feynman-verify-scope

## 목표
`POST /api/feynman/verify` 에도 직전 태스크(`feynman-doc-user-scope`)와 동일한 방식으로
소유자 검증을 추가해, 다른 사용자의 docId 로 RAG 청크(원문 텍스트)가 노출되지 않도록 한다.

## 변경 범위 (백엔드만)

- **`FeynmanController.verify(...)`**
  - `getCurrentUserId()` 호출 후 서비스에 userId 전달.
- **`FeynmanService.verify(...)`**
  - 시그니처를 `verify(String userId, VerifyRequest request)` 로 변경.
  - 진입 직후 `assertDocOwner(userId, request.getDocId())` 호출. 소유자 아니면 FORBIDDEN
    으로 즉시 차단.

프론트는 변경 없음 — `/api/feynman/verify` 를 호출하는 프론트 코드는 없지만(향후 호출
시에도) JWT 에서 userId 가 자동 주입됨.

## 구현 계획
1. FeynmanService.verify 시그니처/본문 수정.
2. FeynmanController.verify 에서 getCurrentUserId() 추가.
3. `./gradlew compileJava compileTestJava --rerun-tasks` 로 컴파일 확인.

## 단위 테스트 계획 (evidence/unit/notes.md)
- 백엔드 컴파일 성공.
- `verify` 메서드 진입부에 `assertDocOwner` 호출이 존재하는지 grep 확인.

## 회귀 테스트 계획 (evidence/regression/notes.md)
- 기존 소유자 검증이 이미 있는 엔드포인트(`/docs`, `/docs/all`, `/topics`, `/stream`,
  `/pipeline/{docId}`, `/upload`) 로직 불변.
- 컨트롤러 HTTP 경로/페이로드 시그니처 불변.
