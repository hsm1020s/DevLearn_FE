# 설계: 2026-04-23-cert-quiz-from-rag

**생성:** 2026-04-23 12:53
**워크트리:** /Users/moon/DevLearn_FE_wt/2026-04-23-cert-quiz-from-rag
**브랜치:** task/2026-04-23-cert-quiz-from-rag

## 목표
자격증 퀴즈 출제 재료를 **본인이 파인만 파이프라인으로 올린 문서(`rag_docs`) + 선택
챕터(`rag_chunks`)** 로 전환한다. 기존 `cert_docs` 기반 자격증 문서 파이프라인은 전부
정리한다. 기존에 없던 문서/챕터 선택 UI를 복원해 사용자가 퀴즈 범위를 명시적으로
지정할 수 있게 한다.

## 변경 범위

### 프론트
1. **`src/components/study/QuizSettings.jsx`**
   - `feynmanApi.fetchDocs()` 로 본인 completed 문서 목록 로드 (useEffect).
   - "문서 선택" Dropdown — 선택된 docId 상태 관리.
   - 문서 선택 시 `feynmanApi.fetchTopics(docId)` 호출 → 챕터 리스트 로드.
   - "출제 범위" 섹션의 `MOCK_CHAPTERS` 제거, 실제 챕터로 대체. 다중 선택 칩 유지.
   - 문서 미선택/목록 비어 있을 때 안내 문구 ("파인만 파이프라인에서 문서를 업로드·
     실행해주세요").
   - 퀴즈 생성 버튼은 문서 선택이 있어야 활성.
   - `generateQuiz({ subject, docIds:[docId], chapters, count, difficulty, types })` 호출.

### 백엔드 — `StudyService.generateQuiz` 를 rag 기반으로 재작성
2. **`StudyController.generateQuiz`**
   - `getCurrentUserId()` 호출 후 서비스에 userId 전달.
3. **`StudyService`**
   - 필드에서 `StudyDocMapper`, `PdfParserService` 제거. `FeynmanMapper` 주입 추가.
   - `generateQuiz(String userId, QuizGenerateRequest request)`:
     - 첫 `docId` 로 `feynmanMapper.findDocOwner(docId)` 소유자 검증 (NOT_FOUND/FORBIDDEN).
     - `chapters` 가 있으면 해당 챕터 청크, 없으면 전체 청크에서 content 수집 →
       하나의 문자열로 이어붙이고 `MAX_DOC_TEXT_LENGTH` 로 자름.
     - 이후 `buildQuizPrompt`/`callLlmForQuiz`/`parseQuizResponse`/스텁 폴백 로직 그대로.
   - `extractDocumentText` private 메서드 제거 (파일 IO 기반, 더 이상 필요 없음).
4. **`FeynmanMapper.java` · `FeynmanMapper.xml`**
   - 신규 `findChunksContentByDocAndChapters(docId, chapters)` — `rag_chunks` 에서
     `content` 를 `seq` 오름차순으로 조회. `chapters` 가 비어 있으면 전체, 있으면 IN 절.
   - MyBatis dynamic SQL(`<foreach>` 또는 `<if>`)로 chapters 존재 여부 분기.

### 백엔드 — cert_docs 레거시 정리
5. **삭제**
   - `src/main/java/com/moon/devlearn/study/mapper/StudyDocMapper.java`
   - `src/main/java/com/moon/devlearn/study/mapper/StudyDocEntity.java`
   - `src/main/resources/mapper/study/StudyDocMapper.xml`
   - `src/main/java/com/moon/devlearn/study/service/PdfParserService.java`
     (cert_docs 업로드/추출 전용. 파인만 파이프라인은 Python 스크립트에서 처리.)
6. **수정**
   - `src/main/resources/schema.sql` — `cert_docs` 테이블 `CREATE` 블록 제거 및 주석에
     "파인만 rag_docs 를 공용으로 사용한다" 메모. 기존 DB 의 cert_docs 테이블 DROP 은
     범위 외(사용자가 직접 마이그레이션 시 수행).
   - `QuizEntity.docId` 는 이제 `rag_docs.id` 를 가리키지만 컬럼 타입(UUID) · 이름 동일.
     주석만 갱신.

### 테스트
7. **`StudyServiceTest.generateQuiz_stubMode_generatesStubQuestions`**
   - `@Mock StudyDocMapper` → 제거, `@Mock FeynmanMapper` 추가.
   - `pdfParserService.extractText` 모킹 → `feynmanMapper.findChunksContentByDocAndChapters`
     모킹 + `findDocOwner` 모킹.
   - DTO 필드 그대로 유지.
8. **`StudyControllerTest`** 는 컨트롤러 시그니처 불변이라 변경 없음 (단, service.generateQuiz
   시그니처가 `(userId, request)` 로 바뀌었으므로 `given(...)` 매칭 수정).

### 불변
- `QuizGenerateRequest` DTO — 기존 필드(docIds/chapters/count/difficulty/types) 그대로.
- `QuizResponse` · 퀴즈 저장 파이프라인(`QuizMapper.insertQuiz/insertQuestion`) 그대로.
- 파인만 모드의 파이프라인 관리/학습/스트리밍 로직 전부 건드리지 않음.
- 사이드바 "문서 파이프라인" 팝업 — 영향 없음.

## 구현 순서
1. 백엔드: `FeynmanMapper` 에 `findChunksContentByDocAndChapters` 추가 (Java · XML).
2. `StudyService.generateQuiz` 를 rag 기반으로 재작성. `StudyDocMapper`/`PdfParserService`
   의존 제거.
3. `StudyController.generateQuiz` 에 userId 전달.
4. cert_docs 레거시 파일 4개 삭제. `schema.sql` 에서 `cert_docs` 블록 제거.
5. 테스트 2개 파일 업데이트.
6. `./gradlew compileJava compileTestJava --rerun-tasks` 성공 확인.
7. 프론트: `QuizSettings.jsx` 2단계 선택 UI 구현. `feynmanApi` import.
8. `vite build` + 워크트리 dev 서버(3100) 에서 headless Chrome 렌더 확인.

## 단위 테스트 계획 (evidence/unit/notes.md)
자동:
1. FE: `vite build` · 번들에 `feynmanApi` / 문서·챕터 로딩 코드 포함.
2. BE: `compileJava compileTestJava --rerun-tasks` 성공.
3. BE: `StudyDocMapper` / `PdfParserService` 참조가 main/test 모두 0건.
4. BE: `StudyService` 에 `assertDocOwner` 또는 `findDocOwner` 호출이 `generateQuiz` 내에 존재.

수동:
5. 자격증 퀴즈 설정 진입 → 본인 completed 문서 드롭다운 노출 → 문서 선택 → 챕터 칩 로딩.
6. 챕터 다중 선택 후 "퀴즈 시작" → LLM 응답 기반 문제(또는 스텁) 출제.
7. 타인 계정의 docId 는 드롭다운에 노출 안 됨 (사용자별 격리 유지).

## 회귀 테스트 계획
1. 파인만 모드 학습·파이프라인·업로드 정상.
2. 사이드바 "문서 파이프라인" 팝업 정상.
3. 자격증 모드 학습 채팅/기록 탭 정상.
4. 마인드맵/일반 채팅/STT 마이크 정상.

## 후속
- 실제 PostgreSQL 에서 `DROP TABLE cert_docs` 와 `uploads/cert/*` 정리는 별도 마이그레이션
  작업으로 진행. 이 태스크에서는 코드/스키마 파일만 정리.
