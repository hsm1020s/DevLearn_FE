# DevLearn — AI 기반 통합 학습 플랫폼

LLM과 RAG 기술을 활용한 학습 도구. 일반 채팅, 자격증 퀴즈, 업무 문서 학습을 하나의 인터페이스에서 제공한다.

> **현재 상태**: 프론트엔드 완성 (Mock API), 백엔드 연동 예정

## 주요 기능

### 일반 모드
- LLM 기반 자유 질의응답 채팅
- SSE 스트리밍으로 실시간 응답 출력
- GPT-4o / Claude 3.5 / Gemini Pro 선택
- 마크다운 렌더링 (코드 하이라이팅, 테이블, GFM)
- 클로드 스타일 UI (빈 상태 중앙 입력창 → 대화 시작 후 하단 이동)

### 자격증 모드
- PDF 교재 업로드 → LLM이 퀴즈 자동 생성
- 출제 설정: 난이도, 문제수, 유형, 범위 선택
- 즉시 채점 + 해설 표시
- 오답을 마인드맵 노드로 추가하여 개념 정리

### 업무학습 모드 (RAG)
- 사내 문서 업로드 → 벡터 인덱싱 → 문서 기반 Q&A
- 답변에 출처 표시 (문서명, 페이지, 유사도%)
- 문서 관리 (목록, 상태 확인, 삭제)

### 마인드맵
- 모든 모드에서 토글로 활성화 (화면 50:50 분할)
- **모드별 독립 관리** — 모드마다 별도 마인드맵 저장, 전환 시 자동 복원
- ReactFlow 기반 노드 시각화 + dagre 자동 레이아웃
- 노드 추가/편집/삭제/색상 변경/드래그 이동
- 마인드맵 생성/삭제/이름변경/목록 관리
- 노드 변경 시 자동 fitView + 수동 전체보기 버튼
- PDF 내보내기

### 공통 기능
- 대화 관리: 즐겨찾기, 이름 변경, 개별/다중 삭제 (커스텀 팝오버 확인)
- LLM 모델명 뱃지 표시
- 사이드바 접힘/펼침
- PDF 업로드 통합 모달 (문서 목록 + 삭제)
- 기능개선 제안 모달
- Toast 알림 시스템
- 관리자 대시보드 (통계 카드, 최근 대화, RAG 문서 현황)

## 기술 스택

| 영역 | 기술 | 선택 이유 |
|------|------|-----------|
| UI | React 19 | 최신 동시성 렌더링, Suspense 기반 코드 스플리팅 |
| 빌드 | Vite 6 | HMR 속도, ESM 네이티브 지원 |
| 상태관리 | Zustand 5 | 보일러플레이트 최소화, persist 미들웨어로 localStorage 영속성 |
| 스타일 | Tailwind CSS | 유틸리티 우선 + CSS 변수 기반 테마 시스템 |
| 마인드맵 | ReactFlow v11 + dagre | 노드 기반 시각화 + 자동 레이아웃 |
| HTTP | Axios | 인터셉터 기반 에러 처리 |
| 마크다운 | react-markdown + remark-gfm | GFM 테이블, 코드 블록 하이라이팅 |

## 아키텍처

### 설계 패턴

- **모드 레지스트리**: `registry/modes.js`에서 모드를 선언적으로 정의. 새 모드 추가 시 1개 파일만 수정
- **Mock/Real API 분리**: `VITE_MOCK_API` 환경변수로 전환. 백엔드 없이 프론트엔드 독립 개발 가능
- **커스텀 훅 추출**: `useStreamingChat` — 3개 모드의 스트리밍 로직 통합
- **EmptyChatView 패턴**: 빈 상태 중앙 배치 → 대화 시작 후 하단 이동, 3개 모드 공통 사용
- **중앙 에러 처리**: `errorHandler.js` — NETWORK/TIMEOUT/SERVER 분류, Toast 알림 연동
- **디자인 토큰**: CSS 변수(`:root`) → Tailwind 참조, 다크 모드 준비 완료
- **상태 영속성**: Zustand persist로 대화/문서/마인드맵 데이터 localStorage 저장

### 스토어 구조 (Zustand 6개)

| 스토어 | 역할 | persist |
|--------|------|---------|
| `useAppStore` | 모드, LLM 선택, 사이드바, 모달 | - |
| `useAuthStore` | 로그인 상태, 사용자 정보 | O |
| `useChatStore` | 대화 목록, 메시지, 즐겨찾기 | O |
| `useCertStore` | 퀴즈 설정, 문제, 채점 결과 | - |
| `useDocStore` | 통합 문서 관리 (업로드/상태/삭제) | O |
| `useMindmapStore` | 모드별 마인드맵 (maps/activeMapId) | O |

### 폴더 구조

```
src/
├── pages/           # 페이지 (MainPage, AdminPage)
├── components/
│   ├── common/      # 재사용 UI (Button, Modal, Toast, FileDropZone 등)
│   ├── layout/      # 레이아웃 (Sidebar, ModeHeader, SplitView, MainContent)
│   ├── chat/        # 일반 모드 (ChatContainer, ChatInput, ChatMessage, EmptyChatView)
│   ├── cert/        # 자격증 모드 (CertMode, QuizPlayer, QuizSettings, PdfUploader)
│   ├── work/        # 업무학습 모드 (WorkStudyMode, DocumentList, SourcePanel)
│   └── mindmap/     # 마인드맵 (MindmapPanel, MindmapCanvas, MindmapNode, Controls)
├── stores/          # Zustand 스토어 6개
├── hooks/           # 커스텀 훅 (useStreamingChat)
├── services/        # API 레이어 + Mock (services/mock/)
├── registry/        # 모드 레지스트리
├── styles/          # 전역 CSS (디자인 토큰)
└── utils/           # 상수, 헬퍼, 포매터, 에러 핸들러, 레이아웃 계산
```

## 실행 방법

```bash
# 설치
npm install

# 개발 서버 (Mock API, port 3000)
npm run dev

# 실제 백엔드 연결
VITE_MOCK_API=false VITE_API_URL=http://localhost:8080/api npm run dev

# 빌드
npm run build
```

## API 명세

백엔드 연동 시 필요한 엔드포인트. 현재는 Mock으로 동작.

| Method | Endpoint | 용도 |
|--------|----------|------|
| POST | `/chat/stream` | 채팅 스트리밍 (SSE) |
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

## 향후 계획

- Spring Boot 백엔드 구현 (WebFlux + PostgreSQL + pgvector)
- 실제 LLM API 연동 (OpenAI, Anthropic)
- 회사명 기반 로그인 및 테스트 계정 발급
- 다크 모드 토글 UI
- 사용자 인증 (JWT)
- 학습 이력 분석 및 추천
