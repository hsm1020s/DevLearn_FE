# 설계: 2026-05-02-remove-study-quiz-record-tabs

**생성:** 2026-05-02 19:34
**워크트리:** /Users/moon/DevLearn_FE_wt/2026-05-02-remove-study-quiz-record-tabs
**브랜치:** task/2026-05-02-remove-study-quiz-record-tabs

## 목표
공부 모드의 **퀴즈/기록 서브탭을 완전히 제거**하고 학습 채팅(좌우 분할 워크스페이스) 단독 모드로 단순화한다. 더 이상 쓰지 않을 컴포넌트·스토어 필드·API·유틸·등록부를 모두 dead code로 정리해 코드베이스 부피와 잔존 분기를 줄인다.

## 변경 범위

### 삭제 (파일 통째)
**컴포넌트 (`src/components/study/`)**
- `StudyQuizTab.jsx`, `QuizSettings.jsx`, `QuizPlayer.jsx`, `QuizTimer.jsx`, `QuizResultByParts.jsx` (퀴즈 트리)
- `StudyRecordTab.jsx`, `WrongAnswerPanel.jsx`, `StudyStatsTab.jsx`, `StatsBreakdownChart.jsx`, `StatsSummaryCards.jsx` (기록 트리)
- `StudyStats.jsx`, `StudyStatsPanel.jsx` (모달용 통계 위젯)
- `StudyHomeCards.jsx` (퀴즈/기록으로 보내는 3카드 런처)
- `ChecklistPanel.jsx` (이미 v6에서 데이터 드롭됐던 잔존 파일)
- `StudySubTabs.jsx` (서브탭이 1개만 남으니 탭바 자체 불필요)

**서비스**
- `src/services/studyApi.js` 전체 (generateQuiz / fetchQuizStatus / submitAnswer / getStudyStats)
- `src/services/mock/studyMock.js` 전체

**유틸**
- `src/utils/examScoring.js` (QuizResultByParts + studyMock 전용)

**훅**
- `src/hooks/useActiveSubject.js` (subjects 축 제거 후 의미 없음)

**레지스트리**
- `src/registry/subjects.js` (subjects 축 제거)

### 수정 (필요한 부분만)
- `src/components/study/StudyWorkspace.jsx` — 서브탭 분기 제거 → `<SplitLearningWorkspace mode="study" />` 만 렌더
- `src/components/study/StudyMode.jsx` — 현 상태 유지 (단순 위임)
- `src/stores/useStudyStore.js`
  - `subjects`, `activeSubject` 및 모든 퀴즈/기록/오답 필드·액션 제거
  - 남는 것: `chatStyle`, `chatStyleLocked`, `feynmanDocId`, `feynmanChapter` + setter 4개 + `reset()`
  - persist v7 → v8 migrate: 위 4개 필드만 남김
  - SUBJECT_CATALOG/LIST 재export 삭제
- `src/stores/useAppStore.js` — `studySubTab` 필드 + `setStudySubTab` + persist 항목 제거
- `src/components/layout/MainContent.jsx` — `MODAL_CONFIG`에서 `studyStats`, `studyStatsPanel` 두 항목 제거 + lazy import 제거
- `src/utils/constants.js` — `QUIZ_COUNTS`, `QUIZ_DIFFICULTIES`, `QUIZ_TYPES` 제거 (`CHAT_STYLES`는 유지)

### 영향 받지 않음 (의도적 보존)
- 학습 채팅 좌우 분할(`SplitLearningWorkspace`/`GeneralChatPane`/`FeynmanChatPane`/`StudyStyleChips`) — 그대로
- `useStreamingChat`, `useChatStore` — 그대로
- 일반 모드, 업무학습 모드, 마인드맵, 강의 모드 — 그대로
- `Modal` 인프라 — 그대로 (다른 용도 재사용)

## 구현 계획
1. 진입점에서부터 import 제거: `StudyWorkspace.jsx`를 단순화
2. `MainContent.jsx`에서 모달 항목 제거
3. `useAppStore.js`에서 `studySubTab` 정리
4. `useStudyStore.js` 대수술 + persist v8 migrate
5. 컴포넌트 파일 일괄 삭제 (`git rm`)
6. 서비스/유틸/훅/레지스트리 파일 삭제
7. `constants.js`에서 QUIZ_* 제거
8. `vite build`로 누락 import 잡기 → 남은 참조 모두 정리

## 단위 테스트 계획
- 공부 모드 진입 시 좌우 분할 채팅 단독 화면 즉시 노출 (탭바 없음)
- 좌측 일반 채팅, 우측 파인만 채팅 — 기존과 동일
- 새로고침 후 persist 마이그레이션 통과 (이전 퀴즈/오답 데이터 보유 사용자도 에러 없이 로드)
- 빌드 통과 (`vite build` 청크 정상)

## 회귀 테스트 계획
- 일반 모드 채팅: 정상
- 업무학습 모드: 좌우 분할 정상
- 마인드맵 모드: 영향 없음
- 강의 모드: 영향 없음
- 인증 로그아웃: useStudyStore.reset() 호출 → 남은 필드만 정상 리셋
