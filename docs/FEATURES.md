# 기능 명세

## 개요

AI 기반 통합 학습 플랫폼. 3가지 학습 모드와 마인드맵 서브 기능을 제공한다.

- **기술스택**: React 19, Vite 6, Zustand 5, Tailwind CSS, ReactFlow v11, Axios
- **백엔드**: Spring Boot (미구현, Mock으로 대체 중)
- **API Base**: `http://localhost:8080/api` (환경변수 `VITE_API_URL`로 변경 가능)
- **Mock 전환**: `VITE_MOCK_API=false`로 실제 API 연결

---

## 모드 1: 일반검색

LLM 기반 자유 질의응답 채팅.

| 기능 | 설명 |
|------|------|
| 스트리밍 응답 | SSE 기반 실시간 토큰 출력 |
| LLM 선택 | 클라우드(GPT-4o mini, Claude Haiku 4.5, Gemini 2.5 Flash) / 로컬(Llama 3.1 8B, EXAONE 3.5 32B, GPT-OSS 20B) |
| 마크다운 렌더링 | 코드 하이라이팅, 테이블, GFM 지원 |
| 대화 관리 | 새 대화 생성, 대화 목록, 전환, LLM 모델명 뱃지 표시 |
| 메시지 복사 | 응답 텍스트 클립보드 복사 |

**컴포넌트**: ChatContainer, ChatMessage, ChatInput, SourceCard  
**스토어**: useChatStore (conversations, messages, isStreaming)  
**API**: `POST /chat/stream`

---

## 모드 2: 자격증

PDF 교재 업로드 → LLM 퀴즈 자동 생성 → 풀이 → 오답 분석.

### 4단계 플로우

1. **Upload** — PDF 드래그앤드롭 업로드, 처리 상태 표시
2. **Settings** — 교재 선택, 출제범위(챕터 Chip), 난이도, 문제 수, 유형
3. **Quiz** — 객관식 문제 풀이, 즉시 채점, 해설 표시, 마인드맵 추가
4. **Result** — 정답률 통계, 다시 풀기, 새 퀴즈 생성

| 기능 | 설명 |
|------|------|
| PDF 업로드 | 드래그앤드롭, 다중 파일, 진행률 표시 |
| 퀴즈 커스터마이징 | 난이도(쉬움/보통/어려움), 문제 수(5/10/20), 유형(객관식/OX/주관식) |
| 즉시 채점 | 선택 시 정답/오답 + 해설 즉시 표시 |
| 마인드맵 연동 | 오답 개념을 마인드맵 노드로 추가 |
| 학습현황 | 정답/오답 수, 정답률 통계 (StudyStats 모달) |

**컴포넌트**: CertMode, PdfUploader, QuizSettings, QuizPlayer, StudyStats  
**스토어**: useCertStore (certDocs, currentQuiz, answers, certStep)  
**API**: `POST /cert/upload`, `POST /cert/generate-quiz`, `POST /cert/submit`

---

## 모드 3: 업무학습 (RAG)

사내 문서 업로드 → 벡터 인덱싱 → RAG 기반 Q&A.

| 기능 | 설명 |
|------|------|
| PDF 업로드 | 드래그앤드롭, 인덱싱 진행률 표시 |
| RAG 질의 | 업로드 문서 기반 답변 + 출처 |
| 출처 표시 | 문서명, 페이지, 유사도(%), 원문 미리보기 |
| 문서 관리 | 업로드된 문서 목록, 상태 확인, 삭제 |
| 스트리밍 | 일반검색과 동일한 SSE 스트리밍 |

**컴포넌트**: WorkStudyMode, RagUploader, DocumentList, SourcePanel  
**스토어**: useRagStore (ragDocs)  
**API**: `POST /rag/upload`, `POST /rag/query`, `GET /rag/source/{chunkId}`, `DELETE /rag/docs/{id}`

---

## 서브 기능: 마인드맵

모든 모드에서 토글로 활성화. 화면 50:50 분할.

| 기능 | 설명 |
|------|------|
| 노드 추가 | 선택된 부모 노드 아래에 자식 추가 |
| 인라인 편집 | 노드 더블클릭으로 텍스트 수정 |
| 색상 변경 | 우클릭 컨텍스트 메뉴에서 6가지 색상 선택 |
| 노드 삭제 | 우클릭 메뉴, 자식 노드 재귀 삭제 |
| 드래그 이동 | 노드 위치 자유 배치 |
| 저장/불러오기 | 서버에 마인드맵 저장 및 목록 조회 |
| 줌/팬 컨트롤 | ZoomIn, ZoomOut, FitView |
| PDF 출력 | 마인드맵 캔버스를 PDF로 캡처하여 다운로드 (html-to-image + jsPDF) |
| 자동저장 표시 | 노드 변경/서버 저장/PDF 다운로드 시 "N초 전 저장됨" 실시간 표시 |
| 툴바 UI | 아이콘(20px) + 텍스트 라벨 + 커스텀 말풍선 툴팁 |

**컴포넌트**: MindmapPanel, MindmapCanvas, MindmapNode, MindmapControls, NodeContextMenu  
**스토어**: useMindmapStore (nodes, selectedNodeId, lastSavedAt)  
**API**: `POST /mindmap/save`, `GET /mindmap/list`, `GET /mindmap/{id}`

---

## 관리자 대시보드

`/admin` 라우트. Sidebar 설정 버튼으로 진입.

| 항목 | 내용 |
|------|------|
| 통계 카드 | 총 대화 수, 자격증 교재 수, RAG 문서 수, 마인드맵 노드 수, 풀이 문제 수 |
| 최근 대화 | 최대 8개 대화 목록 (모드, 제목, 시간) |
| RAG 문서 현황 | 문서명, 인덱싱 상태 |

---

## 공통 기능

| 기능 | 설명 |
|------|------|
| 사이드바 접기/펼치기 | 200px ↔ 60px |
| 삭제 확인 팝오버 | 대화 삭제 시 버튼 옆에 커스텀 확인 팝오버 표시 (브라우저 alert 미사용) |
| Toast 알림 | success/error/info, 3초 자동 제거 |
| 모달 시스템 | ragUpload, docManage, studyStats |
| 코드 스플리팅 | React.lazy + Suspense (모드별 청크 분리) |
| 상태 영속성 | Zustand persist → localStorage (대화, 문서, 마인드맵) |
| 에러 처리 | 중앙화된 errorHandler (NETWORK/TIMEOUT/SERVER 분류) |
| 다크 모드 준비 | CSS 변수 체계 구축 완료 (토글 UI 미구현) |

---

## 폴더 구조

```
src/
├── pages/           MainPage, AdminPage
├── components/
│   ├── common/      Button, Dropdown, Toggle, Modal, Badge, Toast
│   ├── layout/      Sidebar, MainContent, ModeHeader, SplitView
│   ├── chat/        ChatContainer, ChatMessage, ChatInput, SourceCard
│   ├── cert/        CertMode, PdfUploader, QuizSettings, QuizPlayer, StudyStats
│   ├── work/        WorkStudyMode, RagUploader, DocumentList, SourcePanel
│   └── mindmap/     MindmapPanel, MindmapCanvas, MindmapNode, MindmapControls, NodeContextMenu
├── stores/          useAppStore, useChatStore, useCertStore, useRagStore, useMindmapStore
├── hooks/           useStreamingChat
├── services/        api, chatApi, certApi, ragApi, mindmapApi + mock/
├── registry/        modes (모드 레지스트리)
├── utils/           constants, helpers, formatters, errorHandler
└── styles/          globals.css
```

---

## API 엔드포인트 총괄

| Method | Endpoint | 용도 |
|--------|----------|------|
| POST | `/chat/stream` | 채팅 스트리밍 |
| POST | `/cert/upload` | 자격증 PDF 업로드 |
| POST | `/cert/generate-quiz` | 퀴즈 생성 |
| POST | `/cert/submit` | 답변 채점 |
| POST | `/rag/upload` | RAG 문서 업로드 |
| POST | `/rag/query` | RAG 질의 |
| GET | `/rag/source/{chunkId}` | 원문 조회 |
| DELETE | `/rag/docs/{id}` | 문서 삭제 |
| POST | `/mindmap/save` | 마인드맵 저장 |
| GET | `/mindmap/list` | 마인드맵 목록 |
| GET | `/mindmap/{id}` | 마인드맵 조회 |
