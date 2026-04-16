# 프로젝트 규칙

## 경로
- 프론트엔드: /Users/moon/studytools
- 백엔드: /Users/moon/IdeaProjects/workStudyTool

## 작업 원칙
- 구현하기 전에 반드시 설계를 먼저 한다. 설계 확인 후 구현에 들어간다. 구현하기 전에 반드시 물어본다.
- 매 작업 완료 후 docs/WORK_LOG.md에 날짜별로 요약을 기록한다.
- 규모가 큰 구현 작업 시 git worktree를 생성하여 기능별로 브랜치를 분리하고, 에이전트를 병렬로 실행한 뒤 완료 후 master에 머지한다.
- 항상 작은 기능이라도 완료될시 기능테스트를 진행한다.
- 기능이 추가될시 기능 md 파일에 내용을 추가한다.
- 항상 코드를 작성하면 주석을 추가해준다.
- 다른 AI가 잘 읽을 수 있도록 주석과 의도를 작성한다.
- 항상 병렬로 실행가능하면 병렬로 코딩한다.
- 기능 구현 완료 시 빌드 테스트 → 커밋 → 푸시 순서를 따른다.
- UI 배치 시 마우스 동선을 최소화한다. 버튼과 관련 팝업/드롭다운은 가까이 배치하고, 모달보다 팝오버 형태를 우선 고려한다.
- 중복 코드가 발견되면 공통 컴포넌트로 추출한다.

## 코딩 규칙
- 브라우저 내장 UI(alert, confirm)를 사용하지 않는다. 커스텀 팝오버 또는 Toast로 대체한다.
- 한국어 입력(IME) 처리 시 `e.nativeEvent.isComposing` 체크를 반드시 포함한다.
- 색상은 하드코딩하지 않는다. CSS 변수(`globals.css :root`)를 정의하고 Tailwind 유틸리티(`bg-bg-primary` 등)로 참조한다.
- 모든 컴포넌트 파일 상단에 `@fileoverview` JSDoc을 작성한다.
- 컴포넌트 props가 있으면 `@param` JSDoc을 작성한다.
- 비자명한 로직에는 인라인 주석을 추가한다.

## UI/UX 규칙
- 채팅 초기 화면은 EmptyChatView 공통 컴포넌트를 사용한다 (중앙 배치 → 입력 후 하단 이동 패턴).
- 삭제 등 위험한 동작은 확인 팝오버를 먼저 표시한다 (모달보다 팝오버 우선).
- 전체 배경은 크림/베이지 톤(클로드 스타일)을 유지한다. `bg-white` 하드코딩 금지.
- 새로운 데이터 구조(스토어)를 추가할 때는 localStorage 마이그레이션(version + migrate)을 고려한다.

## 프로젝트 구조 참고
- 모드 정의: `src/registry/modes.js` (새 모드 추가 시 이 파일만 수정)
- 디자인 토큰: `src/styles/globals.css` (:root 변수) → `tailwind.config.js` (CSS 변수 참조)
- Mock/Real API 전환: `VITE_MOCK_API` 환경변수, `src/services/api.config.js`
- 스토어: Zustand 6개 (useAppStore, useAuthStore, useChatStore, useCertStore, useDocStore, useMindmapStore)
- 마인드맵: 모드별 독립 관리 (`maps{}` + `activeMapId` + `lastActiveByMode`)
