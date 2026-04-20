# DevLearn — AI 기반 통합 학습 플랫폼

LLM과 RAG 기술을 활용한 학습 도구. 일반 채팅, 자격증 퀴즈, 업무 문서 학습을 하나의 인터페이스에서 제공한다.

> **현재 상태**: 프론트엔드 + Spring Boot 백엔드 연동 완료 (2026-04-20 실서버 풀스택 통합 검증 통과)

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
- **학습 통계 패널** — 난이도/유형별 정답률 집계 (서버 집계 API 연동)

### 업무학습 모드 (RAG)
- 사내 문서 업로드 → 벡터 인덱싱 → 문서 기반 Q&A
- 답변에 출처 표시 (문서명, 페이지, 유사도%)
- **출처 카드 클릭 시 청크 원문 모달** — `highlightRange` 기반 3분할 하이라이트
- 문서 관리 (목록, 업로드 상태 폴링, 삭제)

### 마인드맵
- 모든 모드에서 토글로 활성화 (화면 50:50 분할)
- **모드별 독립 관리** — 모드마다 별도 마인드맵 저장, 전환 시 자동 복원
- ReactFlow 기반 노드 시각화 + dagre 자동 레이아웃
- 노드 추가/편집/삭제/색상 변경/드래그 이동
- 마인드맵 생성/삭제/이름변경/목록 관리
- **서버 자동 동기화** — 변이 시 디바운스 저장, SyncIndicator 표시
- 노드 변경 시 자동 fitView + 수동 전체보기 버튼
- PDF 내보내기

### 공통 기능
- **JWT 인증** — 로그인/회원가입, 액세스 토큰(15분) + 리프레시 토큰(7일) 자동 갱신
- **대화 서버 동기화** — 로그인 시 최초 fetch, 이름변경/즐겨찾기/삭제 fire-and-forget 반영
- LLM 모델명 뱃지 표시, 대화 즐겨찾기 / 이름 변경 / 개별·다중 삭제 (커스텀 팝오버 확인)
- 사이드바 접힘/펼침
- PDF 업로드 통합 모달 (문서 목록 + 삭제 + 업로드 상태 폴링)
- **관리자 대시보드** — 서버 집계 우선 + 로컬 폴백, 통계 카드 / 최근 대화 / RAG 문서 현황
- Toast 알림 시스템, 기능개선 제안 모달

## 기술 스택

| 영역 | 기술 | 선택 이유 |
|------|------|-----------|
| UI | React 19 | 최신 동시성 렌더링, Suspense 기반 코드 스플리팅 |
| 빌드 | Vite 6 | HMR 속도, ESM 네이티브 지원 |
| 상태관리 | Zustand 5 | 보일러플레이트 최소화, persist 미들웨어로 localStorage 영속성 |
| 스타일 | Tailwind CSS | 유틸리티 우선 + CSS 변수 기반 테마 시스템 |
| 마인드맵 | ReactFlow v11 + dagre | 노드 기반 시각화 + 자동 레이아웃 |
| HTTP | Axios | 인터셉터 기반 JWT 자동 갱신 + 중앙 에러 처리 |
| 마크다운 | react-markdown + remark-gfm | GFM 테이블, 코드 블록 하이라이팅 |

## 아키텍처

### 설계 패턴

- **모드 레지스트리**: `registry/modes.js`에서 모드를 선언적으로 정의. 새 모드 추가 시 1개 파일만 수정
- **Mock/Real API 분리**: `VITE_MOCK_API` 환경변수로 전환. 백엔드 없이 프론트엔드 독립 개발 가능
- **JWT 자동 갱신 인터셉터**: `services/api.js` — 401 수신 시 `/auth/refresh` 호출 후 원 요청 자동 재시도, 동시 요청은 단일 refresh 프로미스로 중복 방지
- **서버 우선 + 로컬 폴백**: 관리자 대시보드 등에서 서버 응답(`data?.counts`)을 우선 사용, 실패 시 Zustand 상태로 폴백
- **UUID/임시 ID 이중 매핑**: 마인드맵 노드는 FE에서 임시 ID(`n1` 등) 생성 가능, 서버 저장 시 UUID 재생성하여 PostgreSQL UUID 컬럼과 호환
- **디바운스 자동 저장**: 마인드맵 변이 액션에 `scheduleSave` 체이닝, 모듈 스코프 `saveTimers/dirtySet`로 중복 저장 억제
- **커스텀 훅 추출**: `useStreamingChat` — 3개 모드의 스트리밍 로직 통합
- **EmptyChatView 패턴**: 빈 상태 중앙 배치 → 대화 시작 후 하단 이동, 3개 모드 공통 사용
- **중앙 에러 처리**: `errorHandler.js` — NETWORK/TIMEOUT/SERVER 분류, Toast 알림 연동
- **디자인 토큰**: CSS 변수(`:root`) → Tailwind 참조, 다크 모드 준비 완료
- **상태 영속성**: Zustand persist로 대화/문서/마인드맵 데이터 localStorage 저장 (버전 마이그레이션 포함)

### 스토어 구조 (Zustand 6개)

| 스토어 | 역할 | persist |
|--------|------|---------|
| `useAppStore` | 모드, LLM 선택, 사이드바, 모달 | - |
| `useAuthStore` | 로그인 상태, JWT 토큰, 사용자 정보 | O |
| `useChatStore` | 대화 목록, 메시지, 즐겨찾기, 서버 동기화 상태 | O |
| `useCertStore` | 퀴즈 설정, 문제, 채점 결과 | - |
| `useDocStore` | 통합 문서 관리 (업로드/상태 폴링/삭제) | O |
| `useMindmapStore` | 모드별 마인드맵 (maps/activeMapId) + 자동 저장 | O |

### 폴더 구조

```
src/
├── pages/           # 페이지 (MainPage, AdminPage, LoginPage, RegisterPage)
├── components/
│   ├── common/      # 재사용 UI (Button, Modal, Toast, FileDropZone 등)
│   ├── layout/      # 레이아웃 (Sidebar, ModeHeader, SplitView, MainContent)
│   ├── chat/        # 일반 모드 (ChatContainer, ChatInput, ChatMessage, EmptyChatView)
│   ├── cert/        # 자격증 모드 (CertMode, QuizPlayer, QuizSettings, CertStatsPanel)
│   ├── work/        # 업무학습 모드 (WorkStudyMode, DocumentList, SourcePanel, SourceChunkModal)
│   ├── mindmap/     # 마인드맵 (MindmapPanel, MindmapCanvas, MindmapNode, Controls)
│   └── admin/       # 관리자 대시보드 (StatCard, RecentConversations, DocumentTable)
├── stores/          # Zustand 스토어 6개
├── hooks/           # 커스텀 훅 (useStreamingChat, useAdminDashboard)
├── services/        # API 레이어 + Mock (services/mock/) + JWT 인터셉터
├── registry/        # 모드 레지스트리
├── styles/          # 전역 CSS (디자인 토큰)
└── utils/           # 상수, 헬퍼, 포매터, 에러 핸들러, 레이아웃 계산
```

## 실행 방법

```bash
# 설치
npm install

# 개발 서버 (Mock API, port 3000) — 기본
npm run dev

# 실제 백엔드 연결 — 프로젝트 루트에 .env.local 생성
cat > .env.local <<EOF
VITE_MOCK_API=false
VITE_API_URL=http://localhost:8080/api
EOF
npm run dev

# 빌드
npm run build
```

백엔드 실행 방법은 별도 저장소 참조: [DevLearn_BE](https://github.com/hsm1020s/DevLearn_BE)

## API 명세

FE가 기대하는 실 백엔드 계약. 모든 응답은 `ApiResponse<T> = { data, errorCode, message, success }` 래퍼로 감싸져 반환되며, 인터셉터에서 언래핑한다.

### 인증
| Method | Endpoint | 용도 |
|--------|----------|------|
| POST | `/auth/register` | 회원가입 |
| POST | `/auth/login` | 로그인 (access 15분 + refresh 7일 발급) |
| POST | `/auth/refresh` | 토큰 갱신 (401 자동 트리거) |

### 채팅
| Method | Endpoint | 용도 |
|--------|----------|------|
| POST | `/chat/stream` | 채팅 스트리밍 (SSE) |
| GET | `/chat/conversations` | 대화 목록 |
| PATCH | `/chat/conversations/{id}` | 대화 이름/즐겨찾기 수정 |
| DELETE | `/chat/conversations` | 대화 다중 삭제 (`{ids:[...]}`) |

### 자격증
| Method | Endpoint | 용도 |
|--------|----------|------|
| POST | `/cert/upload` | 교재 PDF 업로드 |
| POST | `/cert/generate-quiz` | 퀴즈 생성 (LLM) |
| POST | `/cert/submit` | 답안 채점 |
| GET | `/cert/stats` | 학습 통계 (난이도/유형별 집계) |

### RAG (업무학습)
| Method | Endpoint | 용도 |
|--------|----------|------|
| POST | `/rag/upload` | RAG 문서 업로드 |
| GET | `/rag/docs` | 문서 목록 (업로드 상태 포함) |
| DELETE | `/rag/docs/{id}` | 문서 삭제 |
| POST | `/rag/query` | RAG 질의 |
| GET | `/rag/source/{chunkId}` | 원문 청크 조회 (하이라이트 범위 포함) |

### 마인드맵
| Method | Endpoint | 용도 |
|--------|----------|------|
| POST | `/mindmap/save` | 저장 (생성/업데이트 통합) |
| GET | `/mindmap/list` | 목록 |
| GET | `/mindmap/{id}` | 단건 조회 |
| DELETE | `/mindmap/{id}` | 삭제 |

### 관리자
| Method | Endpoint | 용도 |
|--------|----------|------|
| GET | `/admin/dashboard` | 대시보드 통계 (counts / recentConversations / documents) |

## 향후 계획

- 다크 모드 토글 UI (디자인 토큰은 준비 완료)
- 학습 이력 분석 및 추천
- 회사명 기반 로그인 및 테스트 계정 자동 발급
- E2E 테스트 자동화 (Playwright)
