# 설계: 2026-05-13-fe-usage-bar-relocate

**생성:** 2026-05-13 18:02
**워크트리:** /Users/moon/DevLearn_FE_wt/2026-05-13-fe-usage-bar-relocate
**브랜치:** task/2026-05-13-fe-usage-bar-relocate

## 목표
사용자의 원래 의도(헤더 최상단)에 맞게 ChatUsageBar 를 `ModeHeader.jsx` 의 오른쪽 끝으로 이동.
이전 phase 에서 채팅 입력창 위에 넣은 위치는 사용자 의도가 아니었음.

## 변경 범위
1. `src/components/layout/ModeHeader.jsx` — `justify-between` 의 우측 슬롯에 `<ChatUsageBar />` 추가. 모드 라벨("공부" 등) 옆에 시각적으로 자연스럽게 자리잡음.
2. `src/components/chat/ChatContainer.jsx` — ChatInput 위 ChatUsageBar 제거 + import 제거
3. `src/components/study/FeynmanChatPane.jsx` — 동
4. `src/components/study/GeneralChatPane.jsx` — 동

ChatUsageBar 컴포넌트 자체는 그대로 — 헤더에서 한 번만 마운트되고 모드 전환 시 상태 유지됨 (zustand store 가 전역 보존). 채팅 종료 후 자동 refresh hook 도 그대로 작동.

## 구현 계획
1. ModeHeader 의 header `flex justify-between` 안에 두 번째 `<div>` 로 `<ChatUsageBar />` 삽입. 모바일에서 너무 넓어질 수 있으니 ChatUsageBar 자체의 `min-w-[80px]` 칸 3개 + 구분점이라 ~280px 가량. 모바일 햄버거 + 모드 라벨과 함께 한 줄에 들어갈지 검증.
2. 3개 채팅 컨테이너에서 `<ChatUsageBar />` 라인 + import 삭제.

## 단위 테스트 계획
- 일반 모드: 헤더 오른쪽에 "오늘 / 이번주 / 이번달" 사용량 표시
- 공부 모드: 동일
- 업무학습 모드: 동일
- 채팅 입력창 위에는 사용량 바 없음 (제거 확인)
- 채팅 메시지 1번 전송 → 헤더 사용량 자동 갱신 (스트림 onDone refresh 가 zustand store 갱신 → 헤더 리렌더)

dev :3006 transform 통과.

## 회귀 테스트 계획
- 사이드바·로고·모드 토글·EmptyChatView 정상
- 다른 페이지(/admin) transform 정상
- 헤더 모바일 햄버거 버튼 위치 유지
