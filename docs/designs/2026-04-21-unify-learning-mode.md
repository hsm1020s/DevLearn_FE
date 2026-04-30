# 설계: 2026-04-21-unify-learning-mode

**생성:** 2026-04-21 12:34
**워크트리:** /Users/moon/DevLearn_FE_wt/2026-04-21-unify-learning-mode
**브랜치:** task/2026-04-21-unify-learning-mode

## 목표
자격증·업무학습 두 모드를 삭제·통합하여 사이드바에 `일반`과 `학습` 두 모드만 남기고, 내부 구현은 기존 cert 모드의 PDF 퀴즈 학습 로직을 `study`로 전면 rename해 승계한다.

1. **`work`(업무학습) 모드 완전 제거** — FE/BE 관련 코드·파일·라우트·스토어·API·모크·테스트 전부 삭제.
2. **`cert`(자격증) 모드 → `study`(학습) 모드로 전면 rename** — 모드 키·파일명·디렉터리·심볼·API 엔드포인트·UI 라벨 일괄 변경. 자격증/업무학습 두 모드를 추상화한 단일 "학습 모드"로 일원화한다(단, 내부 구현은 기존 cert 모드의 PDF 퀴즈 학습 로직을 그대로 계승).
3. 사용자 관점에서 사이드바에는 **`일반`, `학습`** 두 모드만 남는다.

## 변경 범위

### FE: /Users/moon/DevLearn_FE

#### 삭제 (work)
- `src/components/work/` 전체 디렉터리 (`WorkStudyMode.jsx`, `RagUploader.jsx`, `DocumentList.jsx`, `SourcePanel.jsx`, `SourceChunkModal.jsx`)
- `src/stores/useDocStore.js` (work 전용 RAG 문서 스토어라면)
- `src/registry/modes.js` 의 `work` 엔트리
- `src/components/layout/MainContent.jsx` — work 관련 dynamic import / 모달 설정
- `src/services/mock/chatMock.js`, `src/services/mock/adminMock.js` 내 `'work'` 참조
- `src/components/admin/RecentConversations.jsx` — `MODE_LABELS.work`
- `src/hooks/useStreamingChat.js`, `src/services/chatApi.js`, `src/utils/errorHandler.js` 내 work 분기

#### Rename (cert → study)
**디렉터리/파일:**
- `src/components/cert/` → `src/components/study/`
- `CertMode.jsx` → `StudyMode.jsx`
- `CertStatsPanel.jsx` → `StudyStatsPanel.jsx`
- `src/stores/useCertStore.js` → `src/stores/useStudyStore.js`
- `src/services/certApi.js` → `src/services/studyApi.js`
- `src/services/mock/certMock.js` → `src/services/mock/studyMock.js`

**심볼:**
- `useCertStore` → `useStudyStore`, `certApi` → `studyApi`, `certMock` → `studyMock`
- 컴포넌트: `CertMode` → `StudyMode`, `CertStatsPanel` → `StudyStatsPanel`
- 모드 값 리터럴 `'cert'` → `'study'`
- persist 키 `cert-store` → `study-store`
- 내부 상태 키 `certDocs`, `certStep` → `studyDocs`, `studyStep`

**UI 라벨:**
- `'자격증'` → `'학습'`, `'자격증 모드'` → `'학습 모드'`, description `'PDF 기반 퀴즈 학습'` 유지 또는 `'PDF 기반 학습'` 으로 미세 조정

**아이콘:** `FileText` 유지 (의미 중립)

### BE: /Users/moon/IdeaProjects/DevLearn_BE

#### 삭제 (work = rag)
- `src/main/java/com/moon/devlearn/rag/` 전체 (컨트롤러/서비스/DTO/매퍼)
- `src/main/resources/mapper/rag/` 전체
- 관련 테스트 (`src/test/java/.../rag/`)
- `ChatRequest.java` 등 채팅 주석에서 `work` 제거 (`general / cert / work` → `general / study`)

#### Rename (cert → study)
- 패키지 `com.moon.devlearn.cert` → `com.moon.devlearn.study`
- 클래스: `CertController`, `CertService`, `CertDocMapper`, `CertDocEntity`, `QuizMapper` 등 → `Study*` prefix
- 매퍼 XML `src/main/resources/mapper/cert/` → `mapper/study/`
- API 경로: `/api/cert/*` → `/api/study/*`
- Swagger `@Tag` / `@Operation` 한글 라벨: `자격증` → `학습`
- **DB 테이블명(`cert_docs`, `quiz`, `quiz_questions`, `quiz_answers`)은 유지** — FE/BE API만 rename, DB 마이그레이션은 이번 스코프 밖. MyBatis XML 내부의 테이블명은 그대로.
- 테스트 클래스 `CertServiceTest`, `CertControllerTest` → `StudyServiceTest`, `StudyControllerTest`

### 주의

- **localStorage 마이그레이션:** `cert-store` persist 키 변경 시 기존 사용자 데이터는 버려진다. 본 프로젝트는 로컬 개발 단계이므로 마이그레이션 로직 대신 `resetUserStores()`에서 legacy `cert-store`, `doc-store` 키를 `localStorage.removeItem`으로 한 번 정리해주는 정도로 끝낸다.
- **DB 컬럼/테이블은 유지** — 스키마 변경 없이 매퍼 XML 내부만 그대로 쓰고, Java 엔티티/매퍼 인터페이스 이름만 rename.
- `certificate` 같은 다른 단어는 현재 코드베이스에 없음(조사 완료) — `cert` 부분 문자열 오탐 없음.

## 구현 계획

1. **BE 먼저** (FE보다 독립적, 빌드·테스트로 검증 용이)
   - (a) `rag` 패키지 전체 삭제 + `work` 관련 주석/문서 제거
   - (b) `cert` → `study` 패키지/클래스/XML 매퍼/API 경로 rename
   - (c) `./gradlew compileJava` 로 빌드 확인
   - (d) BE 서버 구동 후 `/api/study/*` 엔드포인트 개별 호출 스모크 확인
2. **FE: work 삭제**
   - (a) `src/components/work/` 디렉터리 삭제
   - (b) `modes.js` 의 `work` 엔트리 삭제
   - (c) `MainContent.jsx`, `EmptyChatView.jsx`, `RecentConversations.jsx`, `chatMock.js`, `adminMock.js`, `useStreamingChat.js`, `chatApi.js`, `errorHandler.js`, `useAppStore.js`, `useAuthStore.js`, `resetUserStores.js` 에서 `work` 분기 제거
   - (d) `useDocStore.js` 삭제 (work 전용이면)
3. **FE: cert → study rename**
   - (a) 디렉터리/파일명 변경 (`git mv`)
   - (b) 파일 내부 심볼 일괄 치환 (`CertMode` → `StudyMode`, `useCertStore` → `useStudyStore`, `certApi` → `studyApi`, 모드 리터럴 `'cert'` → `'study'`, persist 키 `cert-store` → `study-store`, UI 라벨 `자격증` → `학습`)
   - (c) `main.jsx`, `AdminPage.jsx`, `useAppStore.js`, `useAuthStore.js`, `useChatStore.js`, `useMindmapStore.js`, `resetUserStores.js`, `useStreamingChat.js`, `chatApi.js`, `chatMock.js`, `adminMock.js`, `errorHandler.js` 등 참조 모두 업데이트
   - (d) `resetUserStores.js`에 `localStorage.removeItem('cert-store')` 일회성 정리
4. **빌드/타입/린트 확인**
   - FE: `npm run build` (혹은 `npm run lint`)
   - BE: `./gradlew build`
5. **문서/mock 정합성 최종 확인**
   - `docs/PROJECT_MAP.md`, `docs/FEATURES.md`, `docs/WORK_LOG.md` 에 반영

## 단위 테스트 계획

- (FE) `npm run dev` 으로 로컬 실행 → 사이드바에 `일반`, `학습` 두 모드만 표시되는지 확인.
- (FE) `학습` 모드 진입 → PDF 업로드 → 퀴즈 생성 → 문제 풀이 → 제출 → 통계 확인까지의 플로우가 정상 작동하는지 (기존 cert 플로우 그대로).
- (FE) 브라우저 localStorage에 legacy `cert-store` 키가 있다면 리셋 시 정리되는지 확인.
- (FE) 네트워크 탭에서 API 요청이 `/api/study/*` 로 나가는지 확인.
- (BE) `./gradlew test` 로 `StudyServiceTest`, `StudyControllerTest` 통과.
- (BE) Swagger UI(`/swagger-ui/index.html`)에서 `학습` 태그로 4개 엔드포인트 노출 확인.

## 회귀 테스트 계획

- **채팅(`일반` 모드)**: 메시지 송수신, 스트리밍, 사이드바 대화 목록 유지 확인.
- **마인드맵**: 각 모드별 마인드맵 독립성 — 이전 `cert` 모드용 맵이 `study` 모드에서도 그대로 보이는지(모드 키가 persist 되는 스토어에서 변환되어야 함; 필요 시 `useMindmapStore` 의 `maps[cert]` → `maps[study]` 일회성 마이그레이션).
- **관리자 페이지(`AdminPage`)**: 최근 대화 목록에 `학습` 라벨이 정상 노출되고 `work` 항목이 사라졌는지.
- **인증 플로우**: 로그인/로그아웃 → `resetUserStores()` 호출 시 legacy 키 정리가 예외 없이 수행되는지.
