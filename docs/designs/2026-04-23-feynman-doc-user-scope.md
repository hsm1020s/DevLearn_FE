# 설계: 2026-04-23-feynman-doc-user-scope

**생성:** 2026-04-23 12:33
**워크트리:** /Users/moon/DevLearn_FE_wt/2026-04-23-feynman-doc-user-scope
**브랜치:** task/2026-04-23-feynman-doc-user-scope

## 목표
파인만 문서 접근 경로 중 **사용자별 격리가 누락된 엔드포인트 3개**를 수정해
다른 사용자가 업로드한 문서/챕터/RAG 컨텍스트가 노출되지 않도록 한다.

- ❌ 현재: `GET /api/feynman/docs` 는 `SELECT ... WHERE status='completed'` 로 전역 조회.
  A가 올린 completed 문서가 B의 "학습 시작 · 문서 선택" 드롭다운에 뜸.
- ❌ 현재: `GET /api/feynman/topics?docId=...` · `POST /api/feynman/stream` 은 `docId` 만
  받고 소유자 검증 없음. B가 A의 `docId` 를 알면 챕터·RAG·대화 모두 접근 가능.
- ✅ 정상인 곳 (변경 없음): `POST /upload`, `GET /docs/all`, `POST /pipeline/{docId}` —
  이미 userId 필터/소유자 검증 있음.

## 변경 범위 (백엔드만, 프론트 무변경)

### MyBatis 매퍼
- `src/main/resources/mapper/feynman/FeynmanMapper.xml`
  - `findCompletedDocs` → **`findCompletedDocsByUserId`** 로 이름 변경 및
    `AND user_id = #{userId}::uuid` 필터 추가.
- `src/main/java/com/moon/devlearn/feynman/mapper/FeynmanMapper.java`
  - `findCompletedDocs()` 시그니처를 `findCompletedDocsByUserId(String userId)` 로 변경.

### 서비스
- `src/main/java/com/moon/devlearn/feynman/service/FeynmanService.java`
  - `getDocs()` → `getDocs(String userId)` — 매퍼 호출 시 userId 전달.
  - `getTopics(String docId)` → `getTopics(String userId, String docId)` — 서두에
    `findDocOwner(docId).equals(userId)` 확인, 아니면 기존 파이프라인 패턴과 동일한
    예외(`BusinessException`).
  - `streamChat(...)`: 진입 직후 동일 패턴의 소유자 검증을 추가해 B가 A의 docId 로
    학습 스트리밍 못 하게 차단.

### 컨트롤러
- `src/main/java/com/moon/devlearn/feynman/controller/FeynmanController.java`
  - `getDocs()` · `getTopics(docId)` 가 `getCurrentUserId()` 를 받아서 서비스에 전달.

### 테스트
- 해당 3개 엔드포인트 단위/웹 테스트가 있으면 시그니처 변경에 맞춰 수정. 없으면 skip.
  (현재 검색 기준 Feynman 단위 테스트는 최소 수준 — 컴파일 통과만 확인.)

### 프론트
- 변경 없음. `fetchDocs()` / `fetchTopics(docId)` / `streamFeynmanChat(...)` 는
  서버가 JWT 로 userId 를 자동 추출하므로 호출 시그니처 불변.

## 구현 계획
1. XML: `findCompletedDocs` → `findCompletedDocsByUserId` 로 rename + userId 필터.
2. Mapper 인터페이스 메서드명/파라미터 일치.
3. FeynmanService 세 곳 수정: `getDocs(userId)` / `getTopics(userId, docId)` /
   `streamChat` 에 소유자 검증.
4. Controller 두 곳에 `getCurrentUserId()` 호출 추가.
5. `./gradlew compileJava compileTestJava --rerun-tasks` 로 컴파일 확인.
6. 런타임 수동 시나리오는 사용자 두 계정이 있어야 하므로 코드 리뷰 + 정적 검증으로 대체.

## 단위 테스트 계획 (evidence/unit/notes.md)
자동:
1. 백엔드 컴파일 성공.
2. XML · Mapper · Service · Controller 에서 `userId` 전파 경로가 끊기지 않음을 grep 확인.
3. 소유자 불일치 시 예외 throw 코드 존재 확인.

수동:
4. 두 계정 환경이면 A 업로드 후 B 로그인해서 파인만 학습 시작 화면의 문서 목록이 비어
   있는지 확인. (단일 계정 환경에선 회귀만.)

## 회귀 테스트 계획 (evidence/regression/notes.md)
1. 본인 계정의 completed 문서가 여전히 드롭다운에 뜸.
2. 본인 문서로 파인만 학습 시작 → 스트리밍 정상.
3. 파이프라인 관리 탭 / 업로드 / 파이프라인 실행 회귀 없음.
4. 사이드바 "문서 파이프라인" 모달 정상 동작.
