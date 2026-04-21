# 개발 로그

## 2026-04-21 (5차) — 마인드맵 fitView race 수정 + 하네스 증거 포맷 변경
- 루트 노드 접었다 펼치면 일부 자식이 뷰 밖에 남는 버그 수정 ([MindmapCanvas.jsx](../src/components/mindmap/MindmapCanvas.jsx))
  - 단일 `useEffect` 에서 count 비교와 fitView 실행을 동시에 처리하던 구조가 `useNodesInitialized` 의 stale true 와 결합해 측정 전에 fit 이 한 번 실행되고 `lastFittedCount` 가 선갱신되면서 재-fit 기회를 잃는 race 를 만들었음.
  - "감지 effect" 와 "실행 effect" 로 분리. 감지 측은 `pendingFit` 플래그만 세우고, 실행 측은 `nodesInitialized === true` 이면서 플래그가 켜진 순간에만 fit 을 실행 후 플래그 해제.
- 하네스 증거 포맷 변경: 스크린샷 → `notes.md` 텍스트 기록으로 완화 (맥북 환경에서 헤드리스 스크린샷 자동화가 불안정). [phase.sh](../.claude/hooks/phase.sh) 게이트와 [CLAUDE.md](../CLAUDE.md) 동시 업데이트.
- 설계 문서: [docs/designs/2026-04-21-fix-mindmap-collapse-fitview.md](designs/2026-04-21-fix-mindmap-collapse-fitview.md)

## 2026-04-16 (1차)
- 이전 코드 전부 삭제, 새 명세서(wiki/project.md) 기반 클린 스타트
- 분산된 md 5개 → wiki/project.md 1개로 통합 (중복 제거, React 19 통일)
- Phase 1~6 프론트엔드 구현 완료 (42개 파일, 전부 200줄 이내, 빌드 성공)
  - 기반: Zustand 스토어 5개, 공통 컴포넌트 5개, API Mock 5개
  - 레이아웃: Sidebar(접기/펼치기), ModeHeader, SplitView(마인드맵 분할)
  - 일반검색: 채팅 UI + 스트리밍 Mock + 마크다운 렌더링
  - 업무학습: 채팅 + 문서목록 패널 + 출처 표시
  - 자격증: PDF 업로드 → 퀴즈 설정 → 풀이 → 결과 (4단계 플로우)
  - 마인드맵: React Flow 캔버스 + 노드 추가/삭제/드래그
- 버그 수정: text-tertiary 누락, border-border 오류(6곳), useMemo side-effect

## 2026-04-16 (2차) — Phase 7
- ModeHeader 액션 버튼 연결 (PDF업로드/학습현황/문서관리 → Modal 또는 스텝이동)
- 업무학습 PDF 업로드 플로우 추가 (RagUploader 신규 생성)
- 마인드맵 보강: 노드 더블클릭 인라인편집, 우클릭 컨텍스트메뉴(삭제/색상변경), 저장목록/불러오기
- 퀴즈 "마인드맵에 추가" 버튼 동작 연결
- 자격증 출제범위 Multi-select Chip UI 추가
- Toast 알림 시스템 추가, DocumentList 에러처리 연결
- 관리자 대시보드 구현 (통계카드, 최근대화, RAG문서현황)
- 학습현황 모달 (StudyStats) 추가
- 코드 스플리팅 적용 (React.lazy + Suspense, 569KB→청크 분리)
- 신규 파일 5개: RagUploader, StudyStats, NodeContextMenu, Toast, (MindmapNode/Panel 대폭 확장)
- 빌드 성공 확인

## 2026-04-16 (3차) — 리팩토링 R1~R7
- R1: 버그 수정 — QuizPlayer TDZ에러, SourcePanel border, chatApi sources 누락, 하드코딩 색상
- R2: 모드 레지스트리 패턴 — registry/modes.js 1곳에서 모드 정의, constants/ModeHeader/MainContent/Sidebar 연동
- R3: 스트리밍 커스텀 훅 — hooks/useStreamingChat.js 추출, ChatContainer(156→91줄) WorkStudyMode(171→97줄) 중복 제거
- R4: API 레이어 — mock/real 분리 (services/mock/), api.config.js 환경변수 전환, SSE 스트리밍 실제 구현 준비
- R5: 상태 영속성 — Zustand persist 미들웨어 적용 (대화/문서/마인드맵 localStorage 저장)
- R6: 에러처리 통합 — errorHandler.js 중앙화, alert() 전부 Toast 전환, Modal onDone prop 수정
- R7: 디자인 토큰 — CSS 변수 체계 구축 (:root + dark mode), 하드코딩 색상 제거
- 신규 파일 8개, 수정 파일 25개, 빌드 성공, dev 서버 정상 확인

## 2026-04-16 (4차) — UX 개선
- 대화 삭제 시 브라우저 내장 confirm → 커스텀 팝오버로 교체
  - 개별 삭제(컨텍스트 메뉴): 삭제 버튼 옆에 확인 팝오버 표시
  - 다중 삭제(삭제 모드): 삭제(N) 버튼 옆에 확인 팝오버 표시
  - 바깥 클릭 시 자동 닫힘, animate-popover-in 애니메이션 적용
- 수정 파일: Sidebar.jsx, 빌드 성공
- 대화 목록에 LLM 모델명 뱃지 표시 기능 추가
  - useChatStore: createConversation에 llm 파라미터 추가
  - Sidebar: 즐겨찾기 및 최근 대화 목록에 모델명(GPT-4o, Claude 3.5 등) 뱃지 표시
  - 수정 파일: useChatStore.js, Sidebar.jsx, 빌드 성공
- LLM 모델명 뱃지를 제목 아래(왼쪽)로 이동하여 ··· 메뉴 버튼과 겹침 해소
- 새 대화 생성 시 대화명 입력 기능 추가
  - 마인드맵 토글과 새 대화 버튼 사이에 텍스트 입력창 배치
  - 입력 시 해당 텍스트로 대화명 생성, 미입력 시 '새 대화'로 기본 생성
  - Enter 키로도 생성 가능, 수정 파일: useChatStore.js, Sidebar.jsx
- 사이드바 용어 통일: '대화' → '채팅' (새 채팅, 최근 채팅, 삭제 팝오버 등)
- 전체 배경색 크림/베이지 톤으로 변경 (클로드 스타일 눈 편한 색감)
  - bg-primary: #FFFFFF → #FAF9F5, bg-secondary: #F5F5F5 → #F1EFE7
  - border도 따뜻한 톤으로 통일, 텍스트/포인트 컬러는 유지
- 하드코딩 bg-white → bg-bg-primary 일괄 교체 (Sidebar, Modal, MindmapNode, MindmapControls, NodeContextMenu)
- tailwind.config.js 색상값을 하드코딩에서 CSS 변수 참조로 전환 (테마 변경이 실제 반영되지 않던 버그 수정)
- 새 채팅 버튼을 ghost 스타일로 변경하여 배경과 동일한 톤으로 통일
- 자격증/업무학습 모드 헤더의 PDF 업로드 버튼 제거 (사이드바 하단 업로드로 통일)
- PDF 업로드 모달에 문서 관리 기능 추가
  - 문서 목록에 삭제 버튼(호버 시 표시), RAG 문서 페이지/청크 정보 표시
  - useCertStore에 removeDoc 액션 추가
- 문서 스토어 통합 리팩토링: certDocs/ragDocs → useDocStore.docs 단일 경로
  - useDocStore.js 신규 생성 (통합 문서 관리)
  - PdfUploadModal: 용도 선택 UI 제거, 단일 업로드 경로로 단순화
  - PdfUploader, RagUploader: 업로드 로직 제거, 문서 목록 표시만 담당
  - QuizSettings, StudyStats, DocumentList, WorkStudyMode, AdminPage: useDocStore 참조로 전환
- 모드명 '일반검색' → '일반'으로 변경
- 일반 모드 채팅 UI를 클로드 스타일로 개선
  - 빈 상태: 입력창이 화면 중앙에 위치 + 예시 질문 하단 배치
  - 대화 시작 후: 입력창이 하단으로 이동, 메시지 영역 상단에 표시
- EmptyChatView 공통 컴포넌트 추출
  - 일반/자격증/업무학습 3개 모드의 채팅 초기 상태를 단일 컴포넌트로 통일
  - 자격증 모드를 스텝 기반에서 채팅 기반 레이아웃으로 전환
- 업무학습 모드 초기 채팅창 위치 통일
  - SplitView 좌측 패널 h-full 누락으로 높이 계산 불일치 수정
  - 빈 상태를 다른 모드와 동일한 세로 flex 구조로 변경
  - 업무학습 모드에 예시 질문 3개 추가
- 마인드맵 모드별 독립 관리 구조로 전면 개편
  - useMindmapStore: nodes[] → maps{} + activeMapId + lastActiveByMode 구조
  - 모드 전환 시 해당 모드의 마지막 마인드맵 자동 복원
  - 마인드맵 생성/삭제/이름변경/목록 관리 UI (MindmapPanel 전면 개편)
  - 대화 삭제와 무관하게 마인드맵 독립 보존
  - localStorage 마이그레이션 (v0 → v1) 처리
- EmptyChatView에 모드 전환 탭 + 마인드맵 토글 버튼 추가
  - 첫 채팅 화면에서 일반/자격증/업무학습 전환 + 마인드맵 열기/닫기 가능
- 노드 추가/삭제 시 fitView 자동 호출 (캔버스 벗어남 방지)
- 마인드맵 컨트롤 바 개선
  - 세로 → 가로 배치, 아이콘 확대, 전체보기/PDF에 텍스트 라벨 추가

## 2026-04-20 — 미구현 기능 6개 병렬 구현
- 백엔드/프론트 전수 스캔으로 미구현 항목 도출 → `docs/DESIGN_미구현기능.md` 설계서 작성 → worktree 기반 병렬 에이전트 5개로 동시 구현
- 섹션 1 — 채팅 대화 목록 서버 동기화
  - chatApi에 `listConversations/updateConversation/deleteConversations` 추가, Mock 동기 재현
  - useChatStore: `fetchConversations` + `isConversationsLoading/conversationsError/lastSyncedAt`, 이름변경/즐겨찾기/삭제 시 fire-and-forget 서버 반영
  - Sidebar: 로그인 상태 진입 시 최초 fetch
- 섹션 2+6 — RAG 문서 목록 · 청크 원문 모달
  - ragApi에 `listRagDocs`, ragMock 모듈 스코프 `mockDocs(Map)` 전환
  - useDocStore: `fetchDocs/pollDocStatus/stopPolling`(모듈 스코프 `activePollers: Set` 로 중복 방지)
  - PdfUploadModal: 업로드 후 processing 폴링
  - SourcePanel: 카드 버튼화 + `onSelectSource` prop
  - 신규 `SourceChunkModal` — `getSource` 조회 후 `highlightRange` 3분할 하이라이트
- 섹션 3 — 자격증 학습 통계
  - certApi `getCertStats`, `STATS_DIFFICULTY_LABELS/STATS_TYPE_LABELS` 상수
  - 신규 `StatsSummaryCards / StatsBreakdownChart / CertStatsPanel`
  - MainContent에 `MODAL_CONFIG.certStats` 등록, CertMode 헤더 BarChart3 트리거 연결
- 섹션 4 — 마인드맵 서버 동기화
  - mindmapApi `deleteMindmap`, mindmapMock 모듈 스코프 `mockMaps(Map)` 전환
  - useMindmapStore: `fetchMapList/loadMapFromServer/scheduleSave/saveActiveNow`, 모듈 스코프 `saveTimers/dirtySet` 기반 디바운스 자동 저장, 변이 액션(create/rename/addNode/deleteNode/updateNode/clearAll)에 scheduleSave 체이닝
  - MindmapPanel: 마운트 시 `fetchMapList`, SyncIndicator 표시
- 섹션 5 — 관리자 대시보드 서버 연동
  - 신규 `adminApi.getAdminDashboard` + Mock, `useAdminDashboard`(loading/error/refresh, inflightRef)
  - 신규 `StatCard / RecentConversations / DocumentTable / DashboardSkeleton / DashboardError`
  - AdminPage: 서버 우선 + 로컬 폴백 패턴(`data?.counts ?? fallbackCounts` 등)
- 공통 원칙: 기존 기능 삭제 없이 변경 최소화, Mock/Real API 분기 보존, 기존 액션 시그니처 유지
- 빌드 성공, 커밋 `dedc58b6` 푸시 완료, dev 서버 재구동

## 2026-04-20 (2차) — 풀스택 통합 테스트 + P0 버그 전수 해결
- `.gitignore` 보안 강화: `.env.*` 화이트리스트, 인증서/SSH 키/secrets/service-account/.npmrc/.yarnrc, 전 로그, coverage/, 캐시(.cache/.turbo/.parcel-cache), DB 덤프(*.sql/*.dump/*.sqlite), 백업 파일, macOS `._*`, `.history/` 차단
- `.env.local` 생성(`VITE_MOCK_API=false`), FE↔BE(8080)↔PostgreSQL 동시 기동 후 LLM 미관여 엔드포인트 16개 라이브 curl 매트릭스 실행
- 결과: 정상 7 + 500 INTERNAL_ERROR 9건(B1~B9) + 403/401 계약 불일치(C4) + 응답 shape 미세 불일치 → `docs/풀스택테스트.md` 보고서 작성
- P0 수정(병렬 에이전트 6개, FE 1 + BE 5):
  - FE `src/services/api.js` 500/404 전역 리다이렉트 제거(통합 환경에서 에러 즉시 튕김 방지), 401 refresh 로직 유지
  - FE `src/services/chatApi.js` JSDoc `updateConversation/deleteConversations` → `Promise<void>` 정정
  - BE `SecurityConfig` + 신규 `JwtAuthenticationEntryPoint` — 인증 실패 시 403 → **401 + `ApiResponse(UNAUTHORIZED)`** 통일 (FE 자동 토큰 갱신 복구)
  - BE `ChatService.updateConversation/deleteConversations` — UUID 포맷 사전 검증, 존재하지 않는 id 500 → 404/200
  - BE `RagService.deleteDocument/getSource/getDocName` — UUID 검증 + null-safe(filePath/docId/content)
  - BE `MindmapService.saveMindmap/deleteMindmap/toNodeEntity` — FE 임시 id(`n1` 등) 허용(서버 재생성), 기본 label/color 보정, UUID 검증
  - BE `GlobalExceptionHandler` — `IllegalArgumentException`/`BadSqlGrammarException` → 400, `DataIntegrityViolationException` → 409 추가
  - BE `QuizMapper.xml` — JOIN `::text` 캐스트 제거(UUID 컬럼이라 불필요, `/cert/stats` 500 해소)
  - BE `LoginResponse.UserInfo` + `AuthService.buildLoginResponse` — `id` 필드 추가(FE user.id 참조 안전)
  - BE `application-local.yml` — `file.upload-dir: /Users/moon/DevLearn_uploads`(절대경로) + 디렉토리 생성 → `/rag/upload`·`/cert/upload` FILE_UPLOAD_FAILED 해결
- 회귀 검증: BE 재기동 후 전 매트릭스 재실행 → 이전 500 9건 전부 200/400/404/401로 정상화, FE 빌드 성공
- 커밋: FE `f47be9d9` (3 files +112/-11) / BE `8ad0209` (9 files +375/-37) 푸시 완료, dev 서버 정상

## 2026-04-20 (3차) — 대화창 스크롤 UX 개선 P0
- 문제: 긴 대화에서 사용자가 위로 올려 이전 메시지를 읽는 중에도 새 스트리밍 토큰이 도착하면 강제로 맨 아래로 튕겨 가독성 저하
- 해결: `useStreamingChat`에 스마트 오토스크롤 도입
  - 하단 근접(임계 120px) 상태일 때만 새 메시지·토큰에 맞춰 자동 스크롤
  - 위에 있으면 위치 고정, 새 답변 도착 시 `hasNewBelow=true`로 플래그
  - 대화 전환 시 자동 하단 복귀, 사용자 전송 시 무조건 하단 복귀
- 공통 컴포넌트 신규: `src/components/chat/JumpToBottomButton.jsx`
  - 플로팅 원형 버튼, `visible/hasNew/onClick` props
  - 평소엔 아이콘(또는 "맨 아래로") — 새 답변 도착 상태에선 primary 배경 + "새 답변" 라벨
- 적용 범위: general(`ChatContainer`), cert(`CertMode`), work(`WorkStudyMode`) 세 모드 모두
- 커밋 `6ae1e082` 푸시 완료, dev 서버 재구동

## 2026-04-20 (4차) — 로그아웃 시 사용자 로컬 데이터 누출 버그 수정
- 문제: `useChatStore`·`useDocStore`·`useMindmapStore`·`useCertStore`·`useRagStore`가 전부
  Zustand persist로 `localStorage`에 상태를 저장하지만, `useAuthStore.logout()`은
  토큰과 `auth-storage`만 삭제해 이전 사용자의 대화/문서/마인드맵이 로그아웃 후
  (또는 다른 계정으로 로그인해도) 그대로 노출됨 — PII 유출 위험
- 해결: 5개 스토어에 `reset()` 액션 추가 + 일괄 초기화 유틸 도입
  - `src/utils/resetUserStores.js` 신규 — 각 스토어 reset 호출 + persist 키 5개 `removeItem`
  - 마인드맵은 모듈 스코프 `saveTimers`/`dirtySet`도 정리(예약 저장이 다음 세션에 발화 방지)
  - 문서 스토어는 `activePollers` Set 정리
  - `useAuthStore.login()`에도 선제 reset 호출(계정 전환 대비)
  - `useAuthStore.logout()`에서 `resetUserStores()` 호출
  - `main.jsx` 부팅 가드: 비로그인 상태로 시작이면 렌더 전 캐시 청소 → 기존에 남아 있던 유출 상태도 자연 복구
- 커밋 `a3c414f9` 푸시 완료, dev 서버 재구동
