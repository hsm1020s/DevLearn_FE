# 설계: 2026-05-13-fe-chat-usage-bar

**생성:** 2026-05-13 17:40
**워크트리:** /Users/moon/DevLearn_FE_wt/2026-05-13-fe-chat-usage-bar
**브랜치:** task/2026-05-13-fe-chat-usage-bar

## 목표
일반 채팅·파인만 채팅 입력창 위 여백에 **오늘 / 이번주 / 이번달** LLM 사용 금액(USD 1차, KRW 동봉)을 표시. BE Phase 2 가 토큰·USD 를 기록하므로 FE 는 GET /api/usage/summary 결과를 받아 표시만 한다.

## 변경 범위 (모두 FE 리포)
1. `src/services/usageApi.js` 신설 — `getUsageSummary()`
2. `src/stores/useUsageStore.js` 신설 — zustand, persist 없음(휘발성)
3. `src/components/common/ChatUsageBar.jsx` 신설 — 3영역(오늘/이번주/이번달), 각 칸 라벨/USD/KRW 3줄
4. `src/hooks/useStreamingChat.js` — 스트림 onDone 콜백(일반·파인만 2곳)에서 `useUsageStore.getState().refresh()` 호출
5. `src/components/chat/ChatContainer.jsx` — ChatInput 바로 위에 `<ChatUsageBar />`
6. `src/components/study/FeynmanChatPane.jsx` — 진행 중 상태의 ChatInput 위
7. `src/components/study/GeneralChatPane.jsx` — ChatInput 위

EmptyChatView 는 입력창이 중앙이라 어색 → 제외 (메시지 1건 던지면 ChatContainer 로 전환되며 표시).

## 구현 계획
1. **usageApi.js** — api.get('/usage/summary') → data.data 반환
2. **useUsageStore** — `summary`(객체|null) + `loading` + `refresh()`. persist 안 함 — 새로고침마다 BE 진실로 다시 받는 게 정확. 마운트 시 1회 + 스트림 종료 후 호출.
3. **ChatUsageBar** —
   - 마운트 시 `refresh()` (이미 summary 있으면 그대로)
   - `summary == null` → 자리표시자 "—"
   - 3영역 가로 — 각 칸 라벨(10px)/USD($X.XX, 12px)/KRW(₩X, 10px)
4. **useStreamingChat.onDone** (2곳) — onDone 마지막에 `useUsageStore.getState().refresh()`
5. **3개 컨테이너 삽입** — ChatInput 바로 위 1줄

## 단위 테스트 계획
- BE :8080 동작 중에 dev 진입 → ChatInput 위에 "오늘/이번주/이번달 $X / ₩Y" 표시
- 채팅 1번 전송 → 종료 후 금액 갱신
- LectureScriptService 가 이미 기록한 누적이 month 에 반영됨
- summary 미로드 시 "—" 자리표시자, UI 깨지지 않음

dev 서버 :3004 로 모듈 transform 통과 + UI 확인.

## 회귀 테스트 계획
- 기존 채팅 흐름(메시지 전송/스트림/저장) 영향 없음
- 사이드바·문서 업로드 모달·파이프라인 관리 탭 transform 통과
- EmptyChatView 그대로 (사용량 바 없음)
- `useStreamingChat` 외부 시그니처 그대로, 내부 onDone 만 추가
