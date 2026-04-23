# 설계: 2026-04-23-sidebar-upload-to-feynman

**생성:** 2026-04-23 12:08
**워크트리:** /Users/moon/DevLearn_FE_wt/2026-04-23-sidebar-upload-to-feynman
**브랜치:** task/2026-04-23-sidebar-upload-to-feynman

## 목표
사이드바 "문서 업로드" 버튼이 학습(자격증) 모드 전용 `/api/study/upload` 대신 파인만
업로드 파이프라인(`/api/feynman/upload`)을 사용하도록 전환. 학습 모드 전용 업로드
경로는 프론트·백엔드에서 완전히 제거한다. 자격증 모드(퀴즈 탭 등)는 그대로 유지하되,
PDF 업로드 관련 UI는 정리한다. 파이프라인 실행은 사용자가 "파인만 파이프라인 관리"
탭에서 수동으로 하므로 사이드바에서는 업로드만 처리한다(사용자 확정 1-a).

## 변경 범위

### 프론트
1. **`src/components/common/DocumentUploadModal.jsx`**
   - import: `studyApi.uploadPdf` → `feynmanApi.uploadPdf`. `useDocStore` 의존 제거.
   - 상태: 모달 내부 `useState`로 세션 로컬 업로드 목록 관리 (닫히면 사라짐).
     파이프라인 관리 탭이 서버 상태(상태/진행/챕터)를 관리하므로 중복 피함.
   - 업로드 성공 토스트 문구: "업로드 완료 · 파인만 → 파이프라인 관리 탭에서 실행하세요."
   - 파일 상단 JSDoc 갱신.
2. **`src/services/studyApi.js`** — `uploadPdf` 함수 전체 제거 + mock import 중 필요 없는 항목 정리.
3. **`src/services/mock/studyMock.js`** — `uploadPdf` mock 제거.
4. **`src/stores/useDocStore.js`** — 파일 **전체 삭제** (사이드바 업로더가 유일한 생산자였고, 자격증 모드 읽기 쪽도 이번에 같이 정리).
5. **`src/components/study/PdfUploader.jsx`** — 파일 **전체 삭제**. 사이드바 업로더 유도 목적이었고 자체 업로드 기능이 없어 의미 상실.
6. **`src/components/study/QuizSettings.jsx`** — `useDocStore` 참조, `docOptions` 드롭다운, "업로드된 교재 없음 (사이드바 → 문서 업로드) …" 문구 제거. Mock 폴백으로 데모 데이터 퀴즈는 그대로 동작.
7. **자격증 탭 구성** 중 `PdfUploader`를 임포트/렌더하는 상위 컴포넌트에서 사용 라인 제거.
8. **`src/utils/resetUserStores.js`** — `useDocStore.reset()` 호출 제거.
9. **문서**
   - `docs/PROJECT_MAP.md` 의 `useDocStore` 라인 제거.
   - `docs/WORK_LOG.md` 에 이번 변경 항목 추가.

### 백엔드
1. **`StudyController.java`** — `uploadPdf(@RequestPart MultipartFile ...)` 엔드포인트 제거.
2. **`StudyService.java`** — `uploadPdf` 메서드 및 PDF 파싱 관련 private 헬퍼(이 메서드 전용이면) 제거.
3. **`StudyDocMapper.java`** + **`StudyDocMapper.xml`** — 자격증 문서 CRUD 전용이면 파일 통째 삭제. (자격증 퀴즈 생성에서 참조한다면 유지)
4. **`PdfUploadResponse.java`** — 삭제.
5. **`application.yml`** 의 `file.upload-dir` — 파인만도 사용하므로 **유지**.
6. DB 테이블 `cert_docs` 및 물리 파일 `./uploads/cert/*` — 사용자 결정 3에 따라 **이번엔 정리하지 않음**.

## 구현 계획
1. 프론트 API 교체부터 (`DocumentUploadModal`의 `studyApi` → `feynmanApi`) + `useDocStore` 제거 → 연쇄 삭제(`PdfUploader`, `QuizSettings` 수정, 상위 탭 정리, `resetUserStores`).
2. `services/studyApi.js`, `mock/studyMock.js`에서 upload 함수 제거 — 프론트 빌드로 dangling import 확인.
3. 백엔드: `StudyController.uploadPdf` → `StudyService.uploadPdf` → `StudyDocMapper`/XML → DTO 순으로 제거. Gradle 컴파일로 미참조 심볼 확인.
4. 검증
   - `vite build` 성공 (프론트).
   - `./gradlew build` 또는 컴파일 성공 (백엔드) — 내 환경에서 안 되면 IntelliJ 가 열려 있을 것이니 컴파일 에러 없게 최소한 심볼 참조 정리만 확신.
   - 워크트리 dev 서버(포트 3100)에서 사이드바 업로드 모달 열어 API 경로가 `/feynman/upload` 로 호출되는지 네트워크 패널 없이 검증은 어려우나 최소 모달 렌더·에러 없음은 headless 로 확인.
   - 자격증 모드 퀴즈 탭이 docs 없어도 Mock 데모로 진입 가능한지 headless/빌드 수준에서 확인.

## 단위 테스트 계획 (evidence/unit/notes.md)
자동:
1. `vite build` 성공 (dead import 없음).
2. 워크트리 dev 서버 3100 첫 화면 `#root` 렌더 정상.
3. 번들에서 `studyApi.uploadPdf`/`useDocStore`/`PdfUploader` 심볼이 사라졌는지 grep 확인.

수동(사용자 Chrome):
4. 사이드바 "문서 업로드" 버튼 클릭 → 모달 열림 → PDF 드래그앤드롭 → "업로드 완료" 토스트.
5. 파인만 모드 → 파이프라인 관리 탭에서 방금 업로드한 문서가 목록에 보이고 파이프라인 실행 가능.
6. 자격증 모드 → 퀴즈 탭이 에러 없이 열리고 데모 데이터로 퀴즈 시작 가능.

## 회귀 테스트 계획 (evidence/regression/notes.md)
1. 파인만 대화형 학습(기존) 정상 — 업로드·파이프라인 완료된 문서로 챕터 선택 후 대화 시작.
2. 일반 채팅 전송/스트리밍 정상.
3. 어제 추가한 STT 마이크 버튼 회귀 없음.
4. 로그아웃/로그인 반복 시 스토어 초기화가 `useDocStore` 제거에도 런타임 에러 없음.
