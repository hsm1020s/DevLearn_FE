# 설계: 2026-05-02-feynman-session-per-mode

**워크트리:** /Users/moon/DevLearn_FE_wt/2026-05-02-feynman-session-per-mode
**브랜치:** task/2026-05-02-feynman-session-per-mode

## 목표
파인만 세션(`feynmanDocId`/`feynmanChapter`)을 **공부/업무학습 모드별로 분리**한다. 현재는 글로벌 단일 슬롯이라 공부 모드에서 챕터를 잡고 업무학습으로 가도 그대로 따라가는 누수가 있다. 모드 전환 시 각자의 챕터/문서 선택이 보존되어야 한다.

## 변경 범위

### 수정
- `src/stores/useStudyStore.js`
  - 글로벌 `feynmanDocId`/`feynmanChapter` → `feynmanByMode: { study: {docId, chapter}, worklearn: {docId, chapter} }`
  - 액션 `setFeynmanSession(docId, chapter)` → `setFeynmanSession(mode, docId, chapter)` (mode 인자 필수)
  - 액션 `clearFeynmanSession()` → `clearFeynmanSession(mode)`
  - 새 셀렉터 헬퍼: `selectFeynmanSession(mode)` 또는 `getFeynmanSession(mode)` — useStudyStore.getState() 폴백용
  - persist v8 → v9 migrate: 기존 글로벌 값이 있으면 study 슬롯으로 이관, worklearn은 빈 슬롯
- `src/components/study/FeynmanChatPane.jsx`
  - `useStudyStore((s) => s.feynmanDocId)` → `useStudyStore((s) => s.feynmanByMode[mode].docId)` 식
  - 액션 호출에 `mode` 전달
- `src/hooks/useStreamingChat.js`
  - `useStudyStore((s) => s.feynmanDocId)` → mode 별 셀렉터로 교체
  - `handleSend` 내부 `useStudyStore.getState()` 사용 부분도 mode 기준으로 분기

### 영향 받지 않음
- `chatStyle`/`chatStyleLocked`는 그대로 글로벌 (사용자가 명시적으로 요구한 건 feynman만)
- 학습 채팅 외 모든 영역
- BE API 변경 없음

## 구현 계획
1. `useStudyStore` shape 변경 + persist v9 migrate
2. `FeynmanChatPane` 호출부 갱신 (mode prop 이미 보유)
3. `useStreamingChat` 호출부 갱신 (mode 인자 이미 받음)
4. `vite build`로 누락 호출자 검출

## 단위 테스트 계획
- 공부 모드에서 챕터 A 선택 → 업무학습 전환 시 우측은 시작 전 화면 (챕터 미선택)
- 업무학습에서 챕터 B 선택 + 시작 → 공부로 전환 시 공부의 챕터 A가 그대로
- 공부 챕터 A 종료 → 업무학습 챕터 B는 영향 없음
- 새로고침 후 두 모드 슬롯 모두 보존
- 기존 사용자(글로벌 feynmanDocId 보유) → 새로고침 시 study 슬롯에 마이그레이션, worklearn은 빈 슬롯

## 회귀 테스트 계획
- 단일 모드 학습 채팅 정상 (양쪽 다)
- 좌측 일반 채팅 영향 없음
- 인증 로그아웃 시 reset 정상 동작
