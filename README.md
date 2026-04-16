# StudyTools — AI 기반 통합 학습 플랫폼

LLM과 RAG 기술을 활용한 학습 도구. 일반 검색, 자격증 퀴즈, 업무 문서 학습을 하나의 인터페이스에서 제공한다.

> **현재 상태**: 프론트엔드 완성 (Mock API), 백엔드 연동 예정

## 스크린샷

<!-- TODO: 주요 화면 캡처 추가 -->

## 주요 기능

### 일반검색
- LLM 기반 자유 질의응답 채팅
- SSE 스트리밍으로 실시간 응답 출력
- GPT-4o / Claude 3.5 / Gemini Pro 선택
- 마크다운 렌더링 (코드 하이라이팅, 테이블, GFM)

### 자격증
- PDF 교재 업로드 → LLM이 퀴즈 자동 생성
- 4단계 플로우: 업로드 → 설정(난이도/문제수/유형) → 풀이 → 결과
- 즉시 채점 + 해설 표시
- 오답을 마인드맵 노드로 추가하여 개념 정리

### 업무학습 (RAG)
- 사내 문서 업로드 → 벡터 인덱싱 → 문서 기반 Q&A
- 답변에 출처 표시 (문서명, 페이지, 유사도%)
- 문서 관리 (목록, 상태 확인, 삭제)

### 마인드맵
- 모든 모드에서 토글로 활성화 (화면 50:50 분할)
- ReactFlow 기반 노드 시각화
- 노드 추가/편집/삭제/색상 변경/드래그 이동
- 저장 및 불러오기

### 관리자 대시보드
- 통계 카드 (대화 수, 교재 수, 문서 수, 노드 수, 문제 수)
- 최근 대화 목록, RAG 문서 현황

## 기술 스택

| 영역 | 기술 | 선택 이유 |
|------|------|-----------|
| UI | React 19 | 최신 동시성 렌더링, Suspense 기반 코드 스플리팅 |
| 빌드 | Vite 6 | HMR 속도, ESM 네이티브 지원 |
| 상태관리 | Zustand 5 | Redux 대비 보일러플레이트 최소화, persist 미들웨어로 localStorage 영속성 |
| 스타일 | Tailwind CSS | 유틸리티 우선 접근으로 일관된 디자인 + CSS 변수로 다크모드 준비 |
| 마인드맵 | ReactFlow v11 | 노드 기반 시각화에 특화, 커스텀 노드/엣지 지원 |
| HTTP | Axios | 인터셉터 기반 에러 처리, 요청/응답 변환 |
| 마크다운 | react-markdown + remark-gfm | GFM 테이블, 코드 블록 하이라이팅 |

## 아키텍처

### 설계 패턴

- **모드 레지스트리**: `registry/modes.js`에서 모드를 선언적으로 정의. 새 모드 추가 시 1개 파일만 수정
- **Mock/Real API 분리**: `VITE_MOCK_API` 환경변수로 전환. 백엔드 없이 프론트엔드 독립 개발 가능
- **커스텀 훅 추출**: `useStreamingChat` — 일반검색/업무학습의 중복 스트리밍 로직 통합
- **중앙 에러 처리**: `errorHandler.js` — NETWORK/TIMEOUT/SERVER 분류, Toast 알림 연동
- **상태 영속성**: Zustand persist로 대화/문서/마인드맵 데이터 localStorage 저장

### 폴더 구조

```
src/
├── pages/           # 페이지 (MainPage, AdminPage)
├── components/
│   ├── common/      # 재사용 UI (Button, Modal, Toast 등)
│   ├── layout/      # 레이아웃 (Sidebar, ModeHeader, SplitView)
│   ├── chat/        # 일반검색 모드
│   ├── cert/        # 자격증 모드
│   ├── work/        # 업무학습 모드
│   └── mindmap/     # 마인드맵
├── stores/          # Zustand 스토어 5개
├── hooks/           # 커스텀 훅
├── services/        # API 레이어 + Mock
├── registry/        # 모드 레지스트리
└── utils/           # 상수, 헬퍼, 포매터, 에러 핸들러
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
- 다크 모드 토글 UI
- 사용자 인증 (JWT)
- 학습 이력 분석 및 추천
