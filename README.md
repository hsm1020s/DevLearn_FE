# DevLearn

LLM·RAG 기반 학습 플랫폼의 프론트엔드. 일반 채팅과 PDF 교재 기반 퀴즈 학습을 하나의 UI에서 제공하며, 마인드맵으로 개념을 정리한다.

풀스택 연동 완료 (Spring Boot 백엔드, 2026-04 기준).

## 기술 스택

| 영역 | 기술 |
|------|------|
| UI | React 19 + Vite 6 |
| 상태 | Zustand 5 (+ persist) |
| 스타일 | Tailwind CSS (CSS 변수 토큰) |
| 시각화 | ReactFlow 11 + dagre |
| 통신 | Axios (JWT 인터셉터) + SSE 스트리밍 |
| 마크다운 | react-markdown + remark-gfm |

## 주요 기능

- **일반 모드** — LLM 자유 질의응답 + SSE 스트리밍, GPT-4o / Claude / Gemini 선택
- **학습 모드** — PDF 업로드 → LLM 퀴즈 생성 → 즉시 채점·해설, 오답 마인드맵 연동
- **마인드맵** — 모드별 독립 저장, 노드 편집/드래그, 디바운스 자동 동기화, TTS 재생, PDF 내보내기
- **인증** — JWT (access 15분 + refresh 7일) 자동 갱신, 실패 시 소프트 로그아웃으로 in-flight UI 보존
- **관리자 대시보드** — 서버 집계 + 로컬 폴백, 대화/문서 현황

## 엔지니어링 포인트

1. **모드 레지스트리** ([src/registry/modes.js](src/registry/modes.js)) — 모드를 선언적으로 정의하고 컴포넌트는 동적 import로 지연 로드. 새 모드 추가 시 한 파일만 수정한다.
2. **JWT 자동 갱신 인터셉터** ([src/services/api.js](src/services/api.js)) — 401 수신 시 `/auth/refresh` 호출 후 원 요청 재시도. 갱신 실패 시 하드 리다이렉트 대신 소프트 로그아웃으로 마인드맵·작성 중 노드 등 휘발 UI 상태를 지킨다.
3. **멀티파트 업로드 함정 회피** — axios 인스턴스에 `Content-Type: application/json`을 고정하면 FormData 요청의 boundary가 사라져 Spring이 파트를 파싱하지 못한다. 기본 Content-Type을 제거해 브라우저가 자동 생성하도록 위임.
4. **모드별 마인드맵 격리** ([src/stores/useMindmapStore.js](src/stores/useMindmapStore.js)) — `maps{}` + `activeMapId` + `lastActiveByMode` 구조로 모드 전환 시 마지막 활성 맵을 복원. 변이 시 디바운스 저장으로 서버 호출을 억제.
5. **디자인 토큰** ([src/styles/globals.css](src/styles/globals.css)) — CSS 변수 → Tailwind 참조 체인. `bg-white` 같은 하드코딩을 막고 다크 모드로 확장 가능하게 유지.
6. **Mock/Real API 전환** — `VITE_MOCK_API` 플래그로 백엔드 없이 프론트 독립 개발.

## 실행

```bash
npm install
npm run dev           # Mock API, http://localhost:3000

# 실서버 연결
cat > .env.local <<EOF
VITE_MOCK_API=false
VITE_API_URL=http://localhost:8080/api
EOF
npm run dev
```

백엔드: [DevLearn_BE](https://github.com/hsm1020s/DevLearn_BE)

## 구조

```
src/
├── pages/        MainPage, AdminPage, LoginPage, RegisterPage
├── components/   chat / study / mindmap / admin / layout / common
├── stores/       Zustand 6개 (app/auth/chat/doc/mindmap/study)
├── hooks/        useStreamingChat, useMindmapTts, useAdminDashboard
├── services/     api.js(인터셉터) + studyApi·chatApi·authApi + mock/
├── registry/     modes.js
└── styles/       globals.css (디자인 토큰)
```

전체 파일 인덱스는 [docs/PROJECT_MAP.md](docs/PROJECT_MAP.md) 참고.
