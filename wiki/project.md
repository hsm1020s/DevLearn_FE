# 업무공부도구 (Work Study Assistant)

> **기술스택:** React 19 + LLM + RAG (프론트엔드만 구현하기) 
> **작성일:** 2026-04-16  
> **버전:** v2.0

---

## 1. 프로젝트 개요

LLM과 RAG 기술을 활용한 통합 학습 도구. 일반 검색, 자격증 학습, 업무 문서 학습을 하나의 인터페이스에서 제공하며, 마인드맵 기능을 서브 모드로 결합하여 학습 내용을 시각적으로 정리할 수 있음.

### 1.1 모드 구조

#### 메인 모드 (3개)
| 모드 | 설명 | 핵심 기능 |
|------|------|-----------|
| 일반검색 | ChatGPT/Claude 스타일 대화 | 자유로운 Q&A, 다중 LLM 선택 |
| 자격증 | 자격증 시험 대비 학습 | PDF 업로드 → LLM 퀴즈 생성 → 학습 |
| 업무학습 | 사내 문서 기반 학습 (RAG) | PDF 업로드 → RAG 구축 → 질의응답 |

#### 서브 기능 (토글)
| 기능 | 설명 | 결합 시나리오 |
|------|------|---------------|
| 마인드맵 | 사용자 주도형 개념 시각화 도구 | 자격증: 오답 개념 정리 / 업무학습: 업무 구조 시각화 / 일반: 배운 내용 정리 |

### 1.2 화면 목록
| ID | 화면명 | 비고 |
|----|--------|------|
| U-001 | 메인 화면 | 모든 모드의 베이스 |
| U-001-A | 메인 + 마인드맵 분할 | 마인드맵 ON 시 |
| U-002 | 자격증 모드 (퀴즈) | PDF → 퀴즈 생성 → 풀이 |
| U-003 | 업무학습 모드 (RAG) | PDF → RAG → 질의 |
| A-001 | 관리자 대시보드 | 모니터링 |

---

## 2. 기술 스택

### Frontend
- **프레임워크**: React 19 (JavaScript만, TypeScript 금지)
- **빌드 도구**: Vite
- **라우팅**: React Router v6
- **상태 관리**: Zustand
- **스타일링**: Tailwind CSS
- **마인드맵**: React Flow
- **마크다운**: react-markdown + remark-gfm
- **코드 하이라이팅**: react-syntax-highlighter
- **차트**: Recharts
- **애니메이션**: Framer Motion
- **아이콘**: Lucide React
- **HTTP 클라이언트**: Axios

### Backend
- Spring Boot 3.x
- Spring WebFlux (SSE 스트리밍)
- Spring Data JPA
- PostgreSQL + pgvector

### LLM / RAG
- OpenAI API / Claude API / Gemini API
- LangChain4j 또는 Spring AI
- 임베딩: text-embedding-3-small
- PDF 파싱: Apache PDFBox

---

## 3. 공통 레이아웃

### 3.1 메인 화면 (마인드맵 OFF)
```
┌──────────┬─────────────────────────────────────────┐
│          │ [모드명] — 모드 설명           [액션버튼] │
│ 사이드바  ├─────────────────────────────────────────┤
│ (200px)  │                                         │
│          │              메인 콘텐츠 영역             │
│          │           (모드별로 다른 UI)              │
│          │                                         │
│          ├─────────────────────────────────────────┤
│          │ [📎] 메시지 입력...               [↑]   │
└──────────┴─────────────────────────────────────────┘
```

### 3.2 메인 화면 (마인드맵 ON)
```
┌──────────┬─────────────────────┬─────────────────────┐
│          │ [메인 모드 헤더]     │ [🧠 마인드맵] [💾][📥]│
│ 사이드바  ├─────────────────────┼─────────────────────┤
│ (180px)  │                     │ 선택: [노드명] [입력][+]│
│          │    메인 모드 영역    ├─────────────────────┤
│          │                     │                     │
│          │                     │   마인드맵 캔버스     │
│          │                     │                     │
│          ├─────────────────────┤                     │
│          │ [입력창]            │                     │
└──────────┴─────────────────────┴─────────────────────┘
```
분할 비율: 사이드바 180px / 메인 50% / 마인드맵 50%

### 3.3 사이드바
```
┌─────────────────────────┐
│ 📚 업무공부도구      [◀] │
├─────────────────────────┤
│ [    + 새 대화        ] │
├─────────────────────────┤
│ 🤖 LLM 선택             │
│ [GPT-4o           ▼]   │
├─────────────────────────┤
│ 🎯 메인 모드            │
│ [🔍 일반검색       ▼]   │
├─────────────────────────┤
│ 🧩 서브 기능            │
│ 🧠 마인드맵      [○━━]  │  ← 토글 스위치
├─────────────────────────┤
│ 💬 최근 대화            │
│ ├ 📝 정처기 실기 질문   │
│ ├ 💼 사내 휴가 규정     │
│ └ 🔍 React vs Vue      │
├─────────────────────────┤
│ ⚙️ 설정                 │
└─────────────────────────┘
```

| 요소 | 타입 | 설명 |
|------|------|------|
| 사이드바 토글 | Button | 접기/펼치기 (◀/▶), 접힘 시 아이콘만 (200px → 60px) |
| 새 대화 | Button | 새 대화 세션 시작 |
| LLM 선택 | Dropdown | GPT-4o, Claude 3.5, Gemini Pro |
| 메인 모드 | Dropdown | 일반검색, 자격증, 업무학습 |
| 마인드맵 토글 | Toggle Switch | ON: 화면 분할, OFF: 메인만 |
| 최근 대화 | List | 모드 아이콘 + 제목 (클릭 시 로드) |

### 3.4 메인 영역 헤더 (모드별)
| 모드 | 헤더 내용 | 액션 버튼 |
|------|-----------|-----------|
| 일반검색 | 🔍 일반검색 — 자유로운 질의응답 | - |
| 자격증 | 📝 자격증 모드 — PDF 기반 퀴즈 학습 | [📤 PDF 업로드] [📊 학습현황] |
| 업무학습 | 💼 업무학습 모드 — PDF RAG 질의응답 | [📤 PDF 업로드] [📚 문서관리] |

---

## 4. 화면별 상세

### 4.1 채팅 UI (일반검색 + 업무학습 공유)

```
┌─────────────────────────────────┐
│ 🤖 안녕하세요! 무엇을...        │
├─────────────────────────────────┤
│           질문입니다 👤         │
├─────────────────────────────────┤
│ 🤖 답변입니다...               │
│    📎 출처: 문서.pdf (p.24)    │
│    [원문 보기 →]               │
├─────────────────────────────────┤
│ [📎] 메시지 입력...        [↑] │
└─────────────────────────────────┘
```

- 사용자 메시지: 오른쪽 정렬, 파란 배경
- AI 응답: 왼쪽 정렬, 회색 배경, 마크다운 렌더링
- SSE 스트리밍 지원
- 새 메시지 시 자동 스크롤
- Enter 전송, Shift+Enter 줄바꿈

### 4.2 자격증 모드

#### 흐름
```
[PDF 업로드] → [텍스트 추출] → [청킹] → [LLM 퀴즈 생성] → [학습/풀이]
                                                              ↓
                              [마인드맵 추가] ← [AI 해설] ← [오답]
```

#### PDF 업로드 화면
```
┌─────────────────────────────────────────────┐
│  ┌─────────────────────────────────────┐    │
│  │     📄 PDF 파일을 드래그하거나       │    │
│  │        클릭하여 업로드              │    │
│  │         [파일 선택]                 │    │
│  └─────────────────────────────────────┘    │
│                                             │
│  업로드된 교재                               │
│  ├ 📕 정보처리기사_실기.pdf  ● 완료         │
│  └ 📗 SQLD_요약정리.pdf     ◐ 처리중 45%   │
└─────────────────────────────────────────────┘
```

#### 퀴즈 설정
| 설정 항목 | 타입 | 옵션 |
|-----------|------|------|
| 교재 선택 | Dropdown | 업로드된 PDF 목록 |
| 출제 범위 | Multi-select Chip | 장/섹션별 선택 |
| 문제 수 | Dropdown | 10 / 20 / 30 |
| 난이도 | Dropdown | 쉬움 / 혼합 / 어려움 |
| 문제 유형 | Checkbox | 4지선다, OX, 단답형 |

#### 퀴즈 풀이 화면
```
┌─────────────────────────────────────────────┐
│ 문제 5/20 | 정보처리기사                     │
├─────────────────────────────────────────────┤
│ 트랜잭션의 특성 중 Isolation에 대한          │
│ 설명으로 옳은 것은?                          │
│                                             │
│ ○ ① 연산 중 장애 시 전부 취소              │
│ ● ② 다른 트랜잭션과 독립 수행 ✓            │
│ ○ ③ 완료 후 결과 영구 반영                 │
│ ○ ④ 데이터 일관성 유지                     │
├─────────────────────────────────────────────┤
│ ✓ 정답! Isolation(격리성)은...              │
│ [🧠 마인드맵에 추가 →]                      │
├─────────────────────────────────────────────┤
│ [← 이전]                        [다음 →]   │
└─────────────────────────────────────────────┘
```

### 4.3 업무학습 모드 (RAG)

#### 흐름
```
[PDF 업로드] → [텍스트 추출] → [청킹] → [임베딩] → [벡터DB 저장]
                                                        ↓
[답변 + 출처] ← [LLM 생성] ← [관련 청크 검색] ← [질문 입력]
```

#### 화면 (문서 패널 포함)
```
┌─────────────────────────────────┬───────────────────┐
│ 💼 업무학습 모드      [📤][📚] │ 📚 업로드된 문서   │
├─────────────────────────────────┤                   │
│                                 │ 📄 사내규정.pdf   │
│ 🤖 사내 규정에 따르면 휴가는... │    48p | 127청크  │
│    📎 출처: 사내규정.pdf (p.24) │                   │
│    [원문 보기 →]                │ 📄 개발가이드.pdf │
│                                 │    32p | 89청크   │
│ 👤 우리 회사 휴가 신청은 어떻게?│                   │
│                                 │ ────────────────  │
│                                 │ 📊 RAG 현황       │
├─────────────────────────────────┤ 문서: 3 | 청크: 216│
│ [입력창]                   [↑] │                   │
└─────────────────────────────────┴───────────────────┘
```

### 4.4 마인드맵

- **사용자 주도형**: LLM 자동 생성이 아닌 사용자 직접 구성
- **서브 기능**: 독립 모드가 아닌 다른 모드와 결합 (토글 ON 시 50% 분할)

#### 인터랙션
| 동작 | 결과 |
|------|------|
| 노드 클릭 | 해당 노드 선택 (파란 테두리) |
| 노드 더블클릭 | 인라인 이름 편집 |
| [+] 버튼 / 입력 후 추가 | 선택 노드 하위에 새 노드 생성 |
| 노드 드래그 | 위치 이동 |
| 노드 우클릭 | 컨텍스트 메뉴 (삭제, 색상 변경) |
| 스크롤 / 버튼 | 줌 인/아웃 |

---

## 5. 폴더 구조

```
src/
├── components/
│   ├── common/          # Button, Dropdown, Toggle, Modal, Badge
│   ├── layout/          # Sidebar, MainContent, ModeHeader, SplitView
│   ├── chat/            # ChatContainer, ChatMessage, ChatInput, SourceCard
│   ├── cert/            # PdfUploader, QuizSettings, QuizPlayer, QuizOption, QuizResult
│   ├── work/            # DocumentList, RagStatus, SourcePanel
│   └── mindmap/         # MindmapPanel, MindmapCanvas, MindmapNode, MindmapControls, NodeEditor
│
├── pages/
│   ├── MainPage.jsx
│   └── AdminPage.jsx
│
├── stores/              # Zustand
│   ├── useAppStore.js   # 모드, LLM, 사이드바
│   ├── useChatStore.js  # 대화 상태
│   ├── useCertStore.js  # 자격증 모드 상태
│   ├── useRagStore.js   # 업무학습 모드 상태
│   └── useMindmapStore.js
│
├── hooks/
│   ├── useChat.js
│   ├── useCert.js
│   ├── useRag.js
│   └── useMindmap.js
│
├── services/            # API 레이어
│   ├── api.js           # Axios 인스턴스 (baseURL: localhost:8080/api)
│   ├── chatApi.js
│   ├── certApi.js
│   ├── ragApi.js
│   └── mindmapApi.js
│
├── utils/
│   ├── constants.js
│   ├── formatters.js
│   └── helpers.js
│
├── styles/
│   └── globals.css
│
├── App.jsx
└── main.jsx
```

---

## 6. 컴포넌트 트리

```
<App>
├── <Sidebar>
│   ├── <Logo />
│   ├── <NewChatButton />
│   ├── <LLMSelector />        // Dropdown
│   ├── <ModeSelector />       // Dropdown
│   ├── <MindmapToggle />      // Toggle Switch
│   ├── <RecentChats />        // 대화 목록
│   └── <SettingsButton />
│
├── <MainContent>
│   ├── <ModeHeader />
│   │
│   ├── (마인드맵 ON)
│   │   <SplitView>
│   │     ├── <ModeContent />    // 좌: 모드별 콘텐츠
│   │     └── <MindmapPanel />   // 우: 마인드맵
│   │
│   └── (마인드맵 OFF)
│       <ModeContent />
│         ├── <GeneralChat />
│         ├── <CertMode />
│         │   ├── <PdfUploader />
│         │   ├── <QuizSettings />
│         │   └── <QuizPlayer />
│         └── <WorkStudyMode />
│             ├── <PdfUploader />
│             ├── <RagChat />
│             └── <SourcePanel />
│
└── <InputBar />
```

---

## 7. 상태 관리 (Zustand)

### useAppStore.js
```javascript
{
  selectedLLM: 'gpt-4o',           // 'gpt-4o' | 'claude-3.5' | 'gemini'
  mainMode: 'general',             // 'general' | 'cert' | 'work'
  isMindmapOn: false,
  isSidebarCollapsed: false,
  // 액션
  setLLM, setMainMode, toggleMindmap, toggleSidebar
}
```

### useChatStore.js
```javascript
{
  currentConversationId: null,
  messages: [],                    // { id, role, content, sources?, timestamp }
  isStreaming: false,
  // 액션
  addMessage, setStreaming, clearMessages
}
```

### useCertStore.js
```javascript
{
  certDocs: [],                    // { id, fileName, pages, chunks, status, progress }
  currentQuiz: null,               // { id, questions }
  // Question: { id, type, question, options?, answer, explanation?, chapter? }
  // 액션
  addDoc, setQuiz
}
```

### useRagStore.js
```javascript
{
  ragDocs: [],                     // { id, fileName, pages, chunks, status, progress }
  // 액션
  addDoc, removeDoc
}
```

### useMindmapStore.js
```javascript
{
  nodes: [],                       // { id, label, parentId, position: {x, y}, color? }
  selectedNodeId: null,
  // 액션
  addNode, deleteNode, updateNode, selectNode, clearAll
}
```

---

## 8. API 명세

### 8.1 공통 채팅
```
POST /api/chat
Request: { message, mode, llm, conversationId? }
Response (SSE):
  data: {"type": "token", "content": "..."}
  data: {"type": "done", "conversationId": "uuid"}
```

### 8.2 자격증
```
POST /api/cert/upload          # PDF 업로드 (multipart)
→ { docId, fileName, pages, chunks, status }

POST /api/cert/generate-quiz   # 퀴즈 생성
← { docIds, chapters, count, difficulty, types }
→ { quizId, questions[] }

POST /api/cert/submit          # 정답 제출
← { quizId, questionId, userAnswer }
→ { correct, correctAnswer, explanation }
```

### 8.3 업무학습 (RAG)
```
POST   /api/rag/upload         # PDF 업로드 (multipart)
POST   /api/rag/query          # RAG 질의
← { query, topK }
→ { answer, sources: [{ docId, docName, page, chunk, similarity }] }

GET    /api/rag/source/{chunkId}  # 원문 조회
DELETE /api/rag/docs/{id}         # 문서 삭제
```

### 8.4 마인드맵
```
POST /api/mindmap/save         # 저장 { title, nodes[] }
GET  /api/mindmap/list         # 목록
GET  /api/mindmap/{id}         # 로드
```

---

## 9. 디자인 가이드

### 컬러 팔레트
```
Primary:    #378ADD  (파란색 — 선택, 강조)
Success:    #1D9E75  (초록색 — 자격증 모드)
Warning:    #BA7517  (주황색 — 마인드맵)

Background: #FFFFFF / #F5F5F5 / #EEEEEE
Text:       #1A1A1A / #666666
Border:     #E5E5E5 / #CCCCCC
```

### 스타일 규칙
- 모서리: rounded-lg (8px)
- 그림자: 사용 안 함 (플랫 디자인)
- 보더: border border-gray-200
- 패딩: p-4 (16px) 기본

---

## 10. 개발 순서

### Phase 1: 기반 구조
1. 폴더 구조 생성
2. Zustand 스토어 기본 설정
3. 공통 컴포넌트 (Button, Dropdown, Toggle, Modal)
4. Axios 인스턴스 + API 서비스 레이어

### Phase 2: 레이아웃
1. Sidebar (드롭다운, 토글, 접기/펼치기)
2. MainContent + ModeHeader
3. SplitView (마인드맵 ON/OFF 분할)

### Phase 3: 일반검색 (채팅)
1. ChatContainer + ChatMessage
2. ChatInput (입력 + 파일첨부)
3. SSE 스트리밍 연동

### Phase 4: 업무학습 모드
1. PdfUploader (드래그앤드롭)
2. DocumentList + RagStatus
3. SourcePanel (출처 표시)
4. RAG 질의 연동

### Phase 5: 자격증 모드
1. PdfUploader (재사용)
2. QuizSettings (설정 폼)
3. QuizPlayer + QuizResult
4. AI 해설 연동

### Phase 6: 마인드맵
1. MindmapPanel + MindmapCanvas (React Flow)
2. MindmapNode (커스텀 노드) + MindmapControls
3. 모드 결합 (자격증/업무학습 → 마인드맵 추가)

### Phase 7: 마무리
1. 관리자 대시보드
2. 통합 테스트 + 버그 수정

---

## 11. 주의사항

1. **JavaScript만 사용** — .js / .jsx만, TypeScript 금지
2. **파일당 200줄 제한** — 초과 시 컴포넌트 분리 또는 훅 추출
3. **하드코딩 금지** — 상수는 constants.js에서 관리
4. **API 레이어 분리** — 컴포넌트에서 직접 fetch/axios 호출 금지, services/ 레이어 경유
5. **키보드 단축키 없음** — Enter 전송, Shift+Enter 줄바꿈만 예외
6. **console.log 금지** — 개발 중에만 사용, 커밋 전 제거
7. **백엔드 미구현 시 Mock** — services/ 레이어에서 Mock 데이터 반환, 추후 실제 API로 교체
