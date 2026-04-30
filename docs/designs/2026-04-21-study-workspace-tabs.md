# 설계: 2026-04-21-study-workspace-tabs

**생성:** 2026-04-21 21:18
**워크트리:** /Users/moon/DevLearn_FE_wt/2026-04-21-study-workspace-tabs
**브랜치:** task/2026-04-21-study-workspace-tabs

## 목표
학습 모드를 **3-탭 워크스페이스**로 재구성하여 A(문제 출제)·C(학습 누적·복습)·D(이해도 점검) 기능군을 한 화면에서 전환 가능하게 한다. 백엔드 연결은 후속 단계이며, 이번 태스크는 **UI/상태/목업 응답까지 프론트 단독으로 동작**하는 것을 목표로 한다.

핵심 변경:

1. `학습` 모드 진입 시 상단에 항상 표시되는 `Sub-Tab Bar` — `[💬 학습 채팅] [🎯 퀴즈] [📚 기록]`.
2. 탭 전환은 **상태 보존**(브라우저 탭 모델). 퀴즈 세션·채팅 히스토리·기록 필터 모두 각 탭 로컬 state.
3. **학습 채팅(D그룹)** — 입력창 위 "스타일 칩"(일반/파인만/한줄요약). 칩은 다음 턴 1회 적용(기본), 📌 고정 토글 시 지속. 메시지에 스타일 뱃지 표시.
4. **퀴즈(A그룹)** — 세션 없음 시 `QuizSettings`(모의고사 프리셋 + 적응형 토글 추가), 세션 중 `QuizPlayer`(타이머, 일시정지, 나가기). 탭 이동 시 자동 일시정지 + 재개.
5. **기록(C그룹)** — 내부 세로 탭 `오답노트 | 체크리스트 | 통계`. 오답 카드 `🔁 다시 풀기` → 퀴즈 탭으로 이동 + seed 세션 시작(액티브 리콜 #16).
6. **빈 화면 3카드 런처** — `EmptyChatView`의 학습 모드 분기에서 3개 탭으로 바로 진입하는 카드.

기본 정책(사용자 승인):
- 스타일 칩 = 턴당 1회(📌 고정 별도)
- 퀴즈 세션 = 동시 1개
- 탭 위치 = `ModeHeader` 아래 별도 바

## 변경 범위

### 신규 파일

| 경로 | 역할 |
|------|------|
| `src/components/study/StudyWorkspace.jsx` | 3-탭 컨테이너 — `studySubTab` 따라 분기 렌더 |
| `src/components/study/StudySubTabs.jsx` | 상단 탭 바 — 탭 버튼 + 뱃지 |
| `src/components/study/StudyChatTab.jsx` | 채팅 탭 — 스타일 칩 + 채팅 본문 |
| `src/components/study/StudyStyleChips.jsx` | 스타일 칩 바(일반/파인만/요약 + 📌 고정) |
| `src/components/study/StudyQuizTab.jsx` | 퀴즈 탭 — 설정/플레이어 분기 + 진행 관리 |
| `src/components/study/QuizTimer.jsx` | 모의고사 타이머 위젯 |
| `src/components/study/StudyRecordTab.jsx` | 기록 탭 컨테이너 — 세로 탭 분기 |
| `src/components/study/WrongAnswerPanel.jsx` | 오답노트 카드 리스트 + 다시풀기 버튼 |
| `src/components/study/ChecklistPanel.jsx` | 교재/챕터 체크리스트 |
| `src/components/study/StudyStatsPanel.jsx` | 통계 (기존 StatsSummaryCards/Chart 재사용) |
| `src/components/study/StudyHomeCards.jsx` | 빈 화면 3카드 런처 |

### 수정 파일

| 경로 | 변경 |
|------|------|
| `src/components/study/StudyMode.jsx` | 내부를 `StudyWorkspace`로 교체. EmptyChatView 대신 탭 기반 분기 |
| `src/components/study/QuizSettings.jsx` | "모의고사 프리셋" 버튼 + "적응형 출제" 토글 추가 |
| `src/components/study/QuizPlayer.jsx` | 상단에 타이머/일시정지/나가기 액션. 완료 시 오답노트 push |
| `src/stores/useAppStore.js` | `studySubTab: 'chat' \| 'quiz' \| 'record'` + setter, 기본값 `'chat'` |
| `src/stores/useStudyStore.js` | `chatStyle`, `chatStyleLocked`, `wrongAnswers[]`, `checklist[]`, `quizPaused`, 관련 액션 추가. persist(v2) 마이그레이션 |
| `src/components/chat/ChatMessage.jsx` | `message.meta?.style`가 있으면 스타일 뱃지 표시 |
| `src/hooks/useStreamingChat.js` | 전송 시 현재 `chatStyle`을 시스템 프롬프트 프리픽스로 주입, 메시지 meta에 style 기록 |
| `src/services/mock/chatMock.js` | 파인만/요약 스타일 프리픽스가 오면 응답 변형(목업). 백엔드 연결 전 임시 |
| `src/utils/constants.js` | `CHAT_STYLES` 상수 추가 (`general/feynman/summary`) |

### 영향 범위

- 학습 모드만. 일반 모드는 손대지 않음(ChatMessage는 meta.style 없으면 기존 동작).
- 사이드바·마인드맵은 유지. 마인드맵 토글은 탭과 직교(어느 탭에서도 on 가능).
- 채팅 스토어(`useChatStore`)는 메시지에 `meta` 필드만 이미 있거나 없으면 추가 — 기존 대화 호환.

## 구현 계획

단계는 파일 의존성 그래프에 따라 직렬 1단계로 스켈레톤을 세운 후, 독립 영역을 **병렬 에이전트**로 구현.

### Phase 2-1: 스켈레톤 (직렬, 단일 차례)

1. `useAppStore`에 `studySubTab` 상태 추가.
2. `useStudyStore` 확장 + persist v2 migrate.
3. `constants.js`에 `CHAT_STYLES` 추가.
4. `StudyWorkspace` + `StudySubTabs` + 세 탭 placeholder 파일 작성.
5. `StudyMode.jsx`에서 `StudyWorkspace` 렌더. (빈 화면 조건은 채팅 탭 내부로 이동)

이 시점에 앱이 깨지지 않고 탭 전환만 동작해야 함.

### Phase 2-2: 각 탭 본문 (병렬 3갈래)

**Agent A — 채팅 탭 + 스타일 칩 + mock 응답**
- `StudyStyleChips`, `StudyChatTab` 구현
- `useStreamingChat` 수정: 전송 시 style 프리픽스 + 메시지 meta
- `ChatMessage` 뱃지 표시
- `chatMock.js` 스타일별 mock 응답 분기
- `StudyHomeCards`: 채팅 탭의 빈 상태일 때 3카드 + 기존 예시 질문

**Agent B — 퀴즈 탭 + 타이머 + 세션 보존**
- `StudyQuizTab` 구현(`studyStep` 따라 QuizSettings ↔ QuizPlayer 렌더)
- `QuizSettings` 변경(모의고사 프리셋, 적응형 토글)
- `QuizTimer` + `QuizPlayer` 상단 액션(일시정지/나가기)
- 탭 이동 감지 → 자동 일시정지
- 퀴즈 완료 시 오답 `useStudyStore.addWrongAnswers()` 호출

**Agent C — 기록 탭 3개 sub 패널**
- `StudyRecordTab` 세로 탭 컨테이너
- `WrongAnswerPanel` (카드 + 다시 풀기 → `studySubTab='quiz'` + seed)
- `ChecklistPanel` (mock 챕터 체크리스트)
- `StudyStatsPanel` (기존 StatsSummaryCards/Chart 재사용)
- 시드 데이터 4~5건 기본 포함(화면 확인용)

병렬 에이전트는 **서로 다른 신규 파일만 쓰는** 범위로 격리. 공유 파일(`useStudyStore`, `useAppStore`, `QuizSettings`, `QuizPlayer`, `ChatMessage`, `useStreamingChat`, `chatMock`) 수정은 Phase 2-1 스켈레톤 단계와 각 에이전트 내에서 **자기 범위 라인만** 수정하도록 지시.

### Phase 2-3: 통합 (직렬)

- 빈 화면 3카드 → 탭 이동 동선 확인
- 탭 간 badge(`● 진행중`, `(3)` 오답 수) 연결
- 스타일 문서화(@fileoverview, @param)
- dev 서버에서 실제 시연 확인 후 단위 테스트 노트 작성

## 단위 테스트 계획

dev 서버(`npm run dev`)에서 수동 검증. 기록 위치: `.claude/state/evidence/2026-04-21-study-workspace-tabs/unit/notes.md`

| # | 시나리오 | 기대 결과 |
|---|----------|-----------|
| 1 | 학습 모드 진입(빈 상태) | 3카드 런처 보임. 탭 바 상단 고정 |
| 2 | 카드 "퀴즈" 클릭 | 퀴즈 탭으로 전환 + QuizSettings 표시 |
| 3 | 퀴즈 설정 → 풀이 시작 → 7문제 풀고 채팅 탭 이동 | 탭 바에 `🎯 퀴즈●7/N` 뱃지. 채팅 탭 정상 |
| 4 | 다시 퀴즈 탭 | 7번부터 재개. "일시정지 해제"/재개 버튼 정상 |
| 5 | 채팅 탭에서 `🧠 파인만` 칩 선택 → 메시지 전송 | AI 응답이 파인만 스타일로 나오고 메시지에 뱃지 표시. 다음 턴 자동으로 `일반`으로 리셋 |
| 6 | 📌 고정 on 후 메시지 2회 전송 | 두 메시지 모두 파인만 뱃지 유지 |
| 7 | 메시지 호버 시 `✂️ 요약` 액션 → 클릭 | 해당 메시지 요약 답변 추가 |
| 8 | 퀴즈 1세션 완료 후 기록 탭 | 오답노트 탭에 이번 세션 오답 나열 |
| 9 | 오답 카드 `🔁 다시 풀기` | 퀴즈 탭으로 이동 + 해당 문제 seed로 새 세션 |
| 10 | 체크리스트 항목 체크 | % 진행 바 업데이트 + 새로고침 시 유지(persist) |
| 11 | 새로고침 후 상태 | 현재 탭/스타일 고정/오답/체크 모두 persist에서 복원 |
| 12 | 일반 모드로 전환 | 기존 일반 채팅 영향 없음(학습 탭 UI 사라짐) |

## 회귀 테스트 계획

이번 변경과 무관한 기능이 깨지지 않았는지 확인. 기록: `.claude/state/evidence/2026-04-21-study-workspace-tabs/regression/notes.md`

- **일반 모드 채팅** — 메시지 전송/수신, 즐겨찾기/삭제
- **마인드맵** — 학습 모드 진입 후 마인드맵 토글 on → 분할 비율 드래그 유지(SplitView)
- **문서 업로드** — 사이드바 `문서 업로드` 모달 동작
- **로그인/로그아웃** — 모달 + 사이드바 유저 메뉴
- **사이드바 접기/펼치기** — collapsed/expanded
- **모드 전환** — 학습 ↔ 일반 전환 시 대화 목록 필터, LLM 복원
