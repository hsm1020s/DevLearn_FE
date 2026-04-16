# 프로젝트 규칙

## 경로
- 프론트엔드: `/Users/moon/DevLearn_FE`
- 백엔드: `/Users/moon/IdeaProjects/DevLearn_BE`

## 작업 플로우
1. **설계 먼저** — 구현 전에 반드시 설계를 제시하고, 사용자 확인 후 구현에 들어간다.
2. **병렬 실행** — 독립적인 작업은 항상 병렬로 진행한다. 규모가 큰 작업은 git worktree + 브랜치 분리 후 에이전트 병렬 실행.
3. **기능 테스트** — 작은 기능이라도 완료 시 반드시 기능 테스트를 진행한다.
4. **완료 순서** — `빌드 테스트 → 커밋 → 푸시` 순서를 따른다.
5. **문서 기록** — 작업 완료 후 `docs/WORK_LOG.md`에 날짜별 요약 기록. 기능 추가 시 기능 md 파일에도 내용 추가.

## 코드 작성 규칙

### 주석
- 모든 파일 상단에 `@fileoverview` JSDoc 작성 (파일의 역할과 의도 명시)
- 컴포넌트 props가 있으면 `@param` JSDoc 작성
- 비자명한 로직에는 인라인 주석 추가
- 다른 AI가 읽고 의도를 파악할 수 있도록 작성

### 스타일링
- 색상은 CSS 변수(`globals.css :root`)로 정의하고, Tailwind 유틸리티(`bg-bg-primary` 등)로만 참조한다. `bg-white`, `#FFFFFF` 등 하드코딩 금지.
- 전체 배경은 크림/베이지 톤(클로드 스타일)을 유지한다.

### UI/UX
- 브라우저 내장 UI(`alert`, `confirm`)를 사용하지 않는다. 커스텀 팝오버 또는 Toast로 대체.
- 삭제 등 위험한 동작은 확인 팝오버를 먼저 표시한다. 모달보다 팝오버를 우선 고려.
- 버튼과 관련 팝업/드롭다운은 가까이 배치하여 마우스 동선을 최소화한다.
- 채팅 초기 화면은 `EmptyChatView` 공통 컴포넌트를 사용한다 (중앙 배치 → 입력 후 하단 이동 패턴).
- 한국어 입력(IME) 처리 시 `e.nativeEvent.isComposing` 체크를 반드시 포함한다.

### 설계 원칙
- 중복 코드가 발견되면 공통 컴포넌트로 추출한다.
- 새로운 데이터 구조(스토어)를 추가할 때는 localStorage 마이그레이션(`version` + `migrate`)을 고려한다.

## 프로젝트 구조 참고
> 전체 파일 인덱스 및 기능별 역참조는 `docs/PROJECT_MAP.md`를 참조한다.
| 항목 | 위치 | 설명 |
|------|------|------|
| 모드 레지스트리 | `src/registry/modes.js` | 새 모드 추가 시 이 파일만 수정 |
| 디자인 토큰 | `src/styles/globals.css` → `tailwind.config.js` | `:root` CSS 변수 정의 → Tailwind에서 참조 |
| API 전환 | `src/services/api.config.js` | `VITE_MOCK_API` 환경변수로 Mock/Real 전환 |
| 스토어 (6개) | `src/stores/` | useAppStore, useAuthStore, useChatStore, useCertStore, useDocStore, useMindmapStore |
| 마인드맵 | `src/stores/useMindmapStore.js` | 모드별 독립 관리 (`maps{}` + `activeMapId` + `lastActiveByMode`) |
