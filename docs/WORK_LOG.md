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
