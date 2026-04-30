# DevLearn

> LLM·RAG 기반 학습 플랫폼 — 일반 채팅, PDF 공부 모드, 사내 문서 학습(RAG), 마인드맵을 한 화면에서 통합 제공

[![React](https://img.shields.io/badge/React-19-61dafb)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-6-646cff)](https://vite.dev/)
[![Zustand](https://img.shields.io/badge/Zustand-5-ffb86c)](https://zustand-demo.pmnd.rs/)
[![Tailwind](https://img.shields.io/badge/Tailwind-3-38bdf8)](https://tailwindcss.com/)

---

## 개요

DevLearn은 **여러 LLM(GPT-4o · Claude · Gemini · 로컬 Llama/EXAONE/GPT-OSS)** 을 한 인터페이스에서 전환하면서 사용할 수 있는 학습 도구다.

세 가지 사용 시나리오를 하나의 채팅 UI로 통합한다.

- **일반 모드** — 자유 질의응답 (SSE 스트리밍)
- **공부 모드** — PDF 교재 업로드 → LLM 자동 출제 → 즉시 채점·해설 → 오답을 마인드맵으로 정리
- **업무학습 모드** — 사내/개인 문서 업로드 → 벡터 인덱싱 → RAG 기반 Q&A + 출처 표시

**기술 스택**

| 영역 | 기술 |
|---|---|
| UI | React 19, Vite 6, Tailwind CSS (CSS 변수 디자인 토큰) |
| 상태 | Zustand 5 (+ persist · 모드별 격리) |
| 시각화 | ReactFlow 11 + dagre, recharts |
| 통신 | Axios (JWT 인터셉터 + 401 자동 갱신), SSE 스트리밍 |
| 마크다운 | react-markdown + remark-gfm + react-syntax-highlighter |
| 내보내기 | html-to-image + jsPDF |
| 백엔드 | Spring Boot · MyBatis · PostgreSQL ([DevLearn_BE](https://github.com/hsm1020s/DevLearn_BE)) |

---

## 멤버 구성

| 이름 | 역할 |
|---|---|
| 문희석 | 1인 풀스택 (FE · BE · 인프라 · 기획) |

기획부터 프론트/백엔드 구현, LLM 파이프라인 설계, dev 운영 환경까지 혼자 진행한 사이드 프로젝트.

---

## 프로젝트 목적

1. **여러 LLM을 한 곳에서 비교·활용** — 클라우드(OpenAI/Anthropic/Google) 모델과 로컬(Ollama) 모델을 같은 UI에서 전환하며 응답 품질·속도·비용을 직접 체감.
2. **PDF 한 번만 올리면 끝나는 학습 루틴** — 교재를 올리면 LLM이 자동으로 챕터를 추출하고 출제까지 해주는, "내 PDF로 만든 모의고사" 경험.
3. **사내 문서를 잊지 않는 RAG 어시스턴트** — 업무 문서를 인덱싱해 출처가 표시되는 답변을 받는 개인용 RAG 워크스페이스.
4. **개념을 시각화로 고정** — 채팅·퀴즈에서 나온 개념을 즉시 마인드맵 노드로 보내고, 모드별로 독립된 맵을 유지.
5. **혼자 풀스택을 굴려보는 학습 자체가 목적** — React 19 / Zustand 5 / Spring Boot / 로컬 LLM 파이프라인까지 직접 묶어보는 실전 연습.

---

## 구현 기능

### 1. 모드별 학습 화면

| 모드 | 핵심 |
|---|---|
| **일반 채팅** | SSE 스트리밍, LLM 6종 즉시 전환, 마크다운 + 코드 하이라이팅, 대화 즐겨찾기/검색 |
| **공부 (Study)** | PDF 업로드 → 챕터 자동 추출 → 난이도/문항 수/유형 선택 → 비동기 잡 + 폴링 출제 → 즉시 채점·해설 → **오답 한 클릭으로 마인드맵에 노드 추가** |
| **업무학습 (RAG)** | 다중 PDF 순차 업로드 → 벡터 인덱싱 진행률 실시간 폴링 → RAG Q&A + 출처(문서·페이지·유사도) → 원문 미리보기 |

### 2. 마인드맵 (모든 모드 공용)

- ReactFlow 캔버스, 노드 인라인 편집·드래그·우클릭 메뉴(색상 6종/삭제)
- **모드별 독립 저장** (`maps{}` + `activeMapId` + `lastActiveByMode`) — 모드 전환 시 마지막 활성 맵 자동 복원
- 디바운스 자동 동기화 ("N초 전 저장됨" 표시)
- TTS 재생, dagre 기반 자동 레이아웃, 캔버스 → PDF 내보내기 (html-to-image + jsPDF)

### 3. 인증 · 보안

- JWT (Access 15분 + Refresh 7일) + Axios 인터셉터로 401 시 자동 재발급 + 원 요청 재시도
- 갱신 실패 시 **하드 리다이렉트 대신 소프트 로그아웃** — 작성 중인 마인드맵 노드/입력값 등 휘발 UI 상태 보존
- 다중 디바이스 로그인 시 토큰 회전(Refresh 1회용)

### 4. LLM 파이프라인 모니터

- 우하단 FAB → 슬라이드 드로어로 **현재 진행 중인 LLM 호출 / 소스별 통계 / 최근 호출 / 백엔드 라이브 로그** 4섹션 실시간 폴링
- BE의 `LlmActivityRegistry` + `RingBufferLogAppender`와 연동, 응답에는 ID prefix·길이 메트릭만 노출(프롬프트 본문은 미전송)

### 5. 화면 선명도 슬라이더 (사생활 보호필름)

- `backdrop-filter: blur` + 알파 오버레이로 화면 전체를 점진적으로 흐리게
- **최저 도달 시 비밀번호 게이트** — 자리비움 사이 옆 사람이 슬라이더만 올려 화면 훔쳐보기를 차단

### 6. 관리자 대시보드

- `/admin` 라우트, 통계 카드(대화/문서/마인드맵/문제 수), 최근 대화 8건, RAG 문서 인덱싱 현황
- 서버 집계 + 로컬 폴백으로 BE 일시 장애 시에도 빈 화면 회피

### 7. UX · 디자인 시스템

- CSS 변수 → Tailwind 토큰 체인으로 모든 색상 토큰화 (`bg-bg-primary` 등 — `bg-white` 하드코딩 금지)
- 브라우저 `alert/confirm` 미사용 → 커스텀 팝오버 + Toast 시스템
- 한국어 IME 입력 가드(`e.nativeEvent.isComposing`)
- React.lazy + Suspense로 모드별 코드 스플리팅, Zustand persist로 대화/마인드맵 영속화

---

## 프로젝트 회고

### 잘한 것

- **모드 레지스트리 도입** — `src/registry/modes.js` 한 파일에 모드를 선언적으로 정의하고 동적 import로 지연 로드. 새 모드를 추가할 때 라우팅·사이드바·헤더를 따로 손대지 않아도 되는 구조가 후반부 변경 비용을 크게 줄였다.
- **모드별 마인드맵 격리 구조** — 처음엔 마인드맵 하나를 전역으로 두고 모드 전환 시 덮어쓰는 방식이었는데, "다른 모드로 잠깐 갔다 오면 작업이 사라진다"는 문제가 바로 드러났다. `maps{}` + `activeMapId` + `lastActiveByMode` 3-tier 구조로 바꾸고 나서야 모드 전환이 자유로워졌다.
- **JWT 인터셉터의 소프트 로그아웃** — 401에서 곧장 `window.location` 으로 튕기던 초기 구현이 마인드맵 작성 중 토큰 만료를 만나면 다 날아가는 사고를 만들었다. 토큰 상태만 비우고 React 상태는 보존하는 소프트 로그아웃으로 바꾸고서야 안정.
- **하네스(워크트리 + 5단계 게이트) 도입** — 솔로 프로젝트일수록 "그냥 master에서 고치자" 의 유혹이 커지는데, 워크트리 격리 + 단계 게이트를 강제하니 회귀가 줄었고, 사후 워크 로그를 따로 정리하지 않아도 설계 문서가 남는 효과.

### 시행착오

- **화면 선명도 1차 안 폐기** — `globals.css` surface 토큰을 RGB triplet + 알파로 합성한 1차 안은 톤 단계 차이만 흐려져 의도한 "사생활 보호필름" 효과가 안 났다. 화면 전체에 fixed 오버레이(`ClarityFilm`)를 깔고 `backdrop-filter: blur` + 크림톤 알파 가변으로 갈아엎고서야 의도와 일치.
- **파인만 학습 모드를 별도 메인 모드로 분리했다가 공부 모드 안의 칩으로 통합** — 별도 모드로 분리하니 기존 학습 대화 UX와 단절되고 챕터 선택이 모드 전환 단계에 끼어들어 번거로웠다. 공부 모드 안의 스타일 칩으로 편입.
- **퀴즈 생성 동기 호출 → 비동기 잡 + 폴링** — 로컬 32B 모델이 수 분 걸리는 동안 단일 HTTP 요청을 열어두니 타임아웃·스레드 부담·UX 모두 나빴다. `POST /generate-quiz` 즉시 `{quizId, status: processing}` 반환 + `@Async`로 백그라운드 진행 + `GET /quizzes/{id}` 폴링 구조로 전환.
- **멀티파트 업로드 boundary 사라짐** — Axios 인스턴스 기본 `Content-Type: application/json` 때문에 FormData의 boundary가 덮어씌워져 Spring이 파트를 못 파싱하던 함정. 인스턴스에서 기본 Content-Type을 제거하고 브라우저 자동 생성에 위임.

### 아쉬운 점 / 다음에 할 것

- 현재 다크 모드는 CSS 변수만 준비된 상태(토글 UI 미구현). 라이트 톤 단일.
- 모바일 레이아웃은 분할 뷰 50:50 가정이 깨져 추가 작업 필요.
- E2E 테스트(Playwright) 미도입 — 회귀는 현재 하네스의 수동 회귀 노트로만 보장.
- 로컬 LLM 모니터의 권한 모델은 현재 `/api/public/llm-activity` permitAll. 운영 배포 시 readonly admin 토큰 게이팅 필요.

---

## Reference

- 백엔드 저장소 — [DevLearn_BE](https://github.com/hsm1020s/DevLearn_BE) (Spring Boot · MyBatis · PostgreSQL · Ollama)
- React 19 — https://react.dev/
- Vite 6 — https://vite.dev/
- Zustand 5 — https://zustand-demo.pmnd.rs/
- ReactFlow 11 — https://reactflow.dev/
- Tailwind CSS — https://tailwindcss.com/
- jsPDF — https://github.com/parallax/jsPDF
- Ollama — https://ollama.com/

---

## 구현 화면

| 화면 | 설명 |
|---|---|
| 일반 채팅 | LLM 선택 드롭다운, SSE 스트리밍, 코드 블록 하이라이팅 |
| 공부 모드 | PDF 업로드 → 챕터 칩 → 난이도/문항 수 → 폴링 진행 → 채점 결과 화면 |
| 업무학습 모드 | RAG 다중 업로드, 인덱싱 진행률, 답변 + 출처 카드 (페이지·유사도) |
| 마인드맵 | 분할 뷰, 우클릭 컨텍스트 메뉴, 자동 레이아웃, PDF 내보내기 |
| LLM 활동 모니터 | 우하단 FAB → 드로어 4섹션(진행 중 / 통계 / 최근 호출 / 라이브 로그) |
| 화면 선명도 슬라이더 | 0%로 내리면 비밀번호 게이트 팝오버 자동 오픈 |
| 관리자 대시보드 | 통계 카드 + 최근 대화 + RAG 문서 현황 |

