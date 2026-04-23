# 프로젝트 맵 — AI 탐색용 인덱스

> AI가 이 파일을 먼저 읽으면 2단계 이내로 원하는 코드를 찾을 수 있다.
> 1단계: 기능/레이어 → 파일 경로 확인, 2단계: 해당 파일 읽기

## 레이어별 파일 인덱스

### 진입점
| 파일 | 역할 |
|------|------|
| `src/main.jsx` | React 앱 마운트 (BrowserRouter 래핑) |
| `src/App.jsx` | 라우팅 정의 (`/` → MainPage, `/admin` → AdminPage) |

### 페이지 (src/pages/)
| 파일 | 역할 |
|------|------|
| `MainPage.jsx` | Sidebar + MainContent 레이아웃 조합 |
| `AdminPage.jsx` | 관리자 대시보드 (통계 카드, 최근 대화, RAG 문서 현황) |

### 레이아웃 (src/components/layout/)
| 파일 | 역할 |
|------|------|
| `Sidebar.jsx` | 사이드바 — LLM 선택, 모드 전환, 채팅 목록, PDF 업로드, 마인드맵 토글 |
| `MainContent.jsx` | 모드 컴포넌트 lazy 로딩 + SplitView + 모달 렌더링 |
| `ModeHeader.jsx` | 상단 헤더 — 현재 모드 아이콘·이름·설명 표시 |
| `SplitView.jsx` | 좌우 분할 뷰 (메인 콘텐츠 / 마인드맵 50:50) |

### 일반 모드 (src/components/chat/)
| 파일 | 역할 |
|------|------|
| `ChatContainer.jsx` | 일반 모드 채팅 화면 (EmptyChatView + 메시지 목록) |
| `ChatInput.jsx` | 채팅 입력창 (textarea, IME 처리, Enter 전송) |
| `ChatMessage.jsx` | 단일 메시지 렌더링 (마크다운, 코드 하이라이팅) |
| `EmptyChatView.jsx` | 채팅 빈 상태 공통 — 모드 전환 탭 + 마인드맵 토글 + 입력창 + 예시 질문 |
| `SourceCard.jsx` | 출처 카드 (문서명, 페이지, 유사도) |

### 자격증 모드 (src/components/cert/)
| 파일 | 역할 |
|------|------|
| `CertMode.jsx` | 자격증 모드 채팅 화면 |
| `PdfUploader.jsx` | 자격증 PDF 문서 목록 표시 |
| `QuizSettings.jsx` | 퀴즈 설정 (난이도, 문제수, 유형, 범위) |
| `QuizPlayer.jsx` | 퀴즈 풀이 + 채점 + 해설 + 마인드맵 추가 |
| `StudyStats.jsx` | 학습 현황 통계 |

### 업무학습 모드 (src/components/work/)
| 파일 | 역할 |
|------|------|
| `WorkStudyMode.jsx` | 업무학습 채팅 화면 + 문서 패널 |
| `DocumentList.jsx` | RAG 문서 목록 (상태 표시) |
| `RagUploader.jsx` | RAG 문서 업로드 목록 표시 |
| `SourcePanel.jsx` | 답변 출처 패널 (접기/펼치기) |

### 마인드맵 (src/components/mindmap/)
| 파일 | 역할 |
|------|------|
| `MindmapPanel.jsx` | 마인드맵 패널 — 목록/생성/삭제/이름변경 + 노드 입력 + 캔버스 |
| `MindmapCanvas.jsx` | ReactFlow 캔버스 — 노드/엣지 렌더링, 자동 fitView |
| `MindmapNode.jsx` | 커스텀 노드 — 더블클릭 인라인 편집, 색상 표시 |
| `MindmapControls.jsx` | 하단 컨트롤 바 — 줌, 전체보기, PDF 내보내기 |
| `NodeContextMenu.jsx` | 우클릭 메뉴 — 삭제, 색상 변경 |

### 공통 컴포넌트 (src/components/common/)
| 파일 | 역할 |
|------|------|
| `Button.jsx` | 공통 버튼 (primary/secondary/ghost/danger) |
| `Modal.jsx` | 모달 래퍼 (앵커 팝오버 지원) |
| `Toast.jsx` | 토스트 알림 시스템 (Zustand 기반) |
| `Dropdown.jsx` | 드롭다운 선택 |
| `Toggle.jsx` | 토글 스위치 |
| `Badge.jsx` | 뱃지 (상태 표시용) |
| `FileDropZone.jsx` | 드래그앤드롭 파일 업로드 영역 |
| `PdfUploadModal.jsx` | PDF 업로드 + 문서 관리 모달 |
| `LoginModal.jsx` | 로그인 모달 (현재 하드코딩 계정) |
| `ModeSwitcher.jsx` | 모드 전환 탭 버튼 |
| `SuggestionModal.jsx` | 기능개선 제안 모달 (localStorage 저장) |

### 스토어 (src/stores/) — Zustand
| 파일 | 역할 | persist |
|------|------|---------|
| `useAppStore.js` | 모드, LLM, 사이드바, 마인드맵 토글, 모달 | - |
| `useAuthStore.js` | 로그인 상태, 사용자 정보 | O |
| `useChatStore.js` | 대화 목록, 메시지 CRUD, 즐겨찾기 | O |
| `useCertStore.js` | 퀴즈 설정, 문제, 채점 결과 | - |
| `useMindmapStore.js` | 모드별 마인드맵 (maps/activeMapId/lastActiveByMode) | O (v1) |
| `useRagStore.js` | RAG 질의 상태 | - |

### 훅 (src/hooks/)
| 파일 | 역할 |
|------|------|
| `useStreamingChat.js` | SSE 스트리밍 채팅 로직 — 3개 모드 공통 사용 |

### 서비스/API (src/services/)
| 파일 | 역할 |
|------|------|
| `api.config.js` | Mock/Real 전환 설정 (`VITE_MOCK_API`) |
| `api.js` | Axios 인스턴스 (인터셉터, 에러 처리) |
| `chatApi.js` | 채팅 API (SSE 스트리밍) |
| `certApi.js` | 자격증 API (업로드, 퀴즈 생성, 채점) |
| `ragApi.js` | RAG API (업로드, 질의, 원문 조회) |
| `mindmapApi.js` | 마인드맵 API (저장, 목록, 조회) |
| `mock/chatMock.js` | 채팅 Mock (스트리밍 시뮬레이션) |
| `mock/certMock.js` | 자격증 Mock (퀴즈 데이터) |
| `mock/ragMock.js` | RAG Mock (문서 업로드/질의) |
| `mock/mindmapMock.js` | 마인드맵 Mock (저장/목록) |

### 유틸리티 (src/utils/)
| 파일 | 역할 |
|------|------|
| `constants.js` | 상수 정의 (LLM 목록, 문서 상태, 퀴즈 옵션) |
| `errorHandler.js` | 중앙 에러 처리 (NETWORK/TIMEOUT/SERVER → Toast) |
| `exportPdf.js` | DOM → PNG → PDF 내보내기 |
| `formatters.js` | 날짜/숫자 포매터 |
| `helpers.js` | ID 생성, 기타 헬퍼 |
| `layoutGraph.js` | dagre 기반 마인드맵 자동 레이아웃 계산 |

### 설정/스타일
| 파일 | 역할 |
|------|------|
| `src/styles/globals.css` | CSS 변수 디자인 토큰 (라이트/다크), 스크롤바, 애니메이션 |
| `src/registry/modes.js` | 모드 레지스트리 (label, icon, component, actions) |
| `tailwind.config.js` | Tailwind 설정 — CSS 변수 참조로 색상 정의 |
| `vite.config.js` | Vite 빌드 설정 |

## 기능별 역참조 (기능 → 관련 파일)

### 채팅/대화
`useStreamingChat.js` → `useChatStore.js` → `chatApi.js` → `ChatContainer.jsx` / `CertMode.jsx` / `WorkStudyMode.jsx` → `ChatInput.jsx` + `ChatMessage.jsx` + `EmptyChatView.jsx`

### PDF 업로드/문서 관리 (파인만 파이프라인 통합)
`feynmanApi.uploadPdf` → `DocumentUploadModal.jsx` (사이드바) + `FeynmanPipelineTab.jsx` → `/api/feynman/upload` → `rag_docs`

### 마인드맵
`useMindmapStore.js` → `mindmapApi.js` → `MindmapPanel.jsx` → `MindmapCanvas.jsx` + `MindmapNode.jsx` + `MindmapControls.jsx` + `NodeContextMenu.jsx` → `layoutGraph.js` + `exportPdf.js`

### 자격증 퀴즈
`useCertStore.js` → `certApi.js` → `CertMode.jsx` → `QuizSettings.jsx` → `QuizPlayer.jsx` → `StudyStats.jsx`

### 테마/스타일링
`globals.css` (:root 변수) → `tailwind.config.js` (참조) → 모든 컴포넌트 (Tailwind 유틸리티)

### 인증
`useAuthStore.js` → `LoginModal.jsx` → `Sidebar.jsx` (로그인 버튼)

### 모드 전환
`registry/modes.js` → `useAppStore.js` (setMainMode) → `useMindmapStore.js` (restoreForMode) → `Sidebar.jsx` + `EmptyChatView.jsx` + `ModeHeader.jsx` + `MainContent.jsx`
