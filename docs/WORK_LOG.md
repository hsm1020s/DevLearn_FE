# 개발 로그

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
