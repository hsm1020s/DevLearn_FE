# 설계: 2026-05-02-fix-left-pane-feynman-leak

**워크트리:** /Users/moon/DevLearn_FE_wt/2026-05-02-fix-left-pane-feynman-leak

## 목표
좌우 분할 학습 워크스페이스에서, 우측 파인만 패널이 챕터를 잡고 시작하면 좌측 일반 패널의 `useStreamingChat` 도 자동 트리거 useEffect를 발동시켜 좌측에까지 파인만 conv가 만들어지는 누수를 잡는다. 좌측은 항상 일반 채팅만 처리해야 한다.

## 원인
`useStreamingChat`의 `autoStartFeynman` 기본값이 `!(isSplit && paneKey === 'right')`이라, split 좌측(`paneKey === 'left'`)에서도 true. 좌측이 `feynmanByMode[mode].docId/chapter` 셀렉터를 구독하다가 우측이 챕터를 set하는 순간 useEffect가 발동.

## 수정
`src/hooks/useStreamingChat.js`
- `autoStartFeynman` 기본값을 `!isSplit` 으로 변경 — split이면 좌·우 모두 자동 트리거 끔. 분할 환경에서는 우측 [▶ 시작] 버튼만 명시적으로 `startFeynmanSession()`을 호출. 단일 모드(paneKey 없음)는 기존대로 자동 트리거 유지.
- 자동 트리거 useEffect 내부에 `if (isSplit) return` 추가하지 않고 기본값으로만 처리 — 옵션을 명시적으로 `autoStartFeynman: true` 로 넘기면 split 환경에서도 강제 활성 가능 (방어적 유연성).

## 영향 범위
- 좌측: 자동 트리거 비활성 (정상)
- 우측: 이미 `autoStartFeynman: false` 명시 → 동작 동일
- 단일 모드 호출처(ChatContainer 일반 모드, 그 외 학습 채팅 단독 호출): 이미 paneKey 없음 → 기본값 true 유지 → 행동 변화 없음

## 단위 테스트 계획
- 우측에서 챕터 선택 + [▶ 시작] → 우측만 새 conv + 첫 질문, 좌측 변화 없음
- 우측에서 챕터만 선택(시작 버튼 안 누름) → 좌측·우측 둘 다 conv 생성 안 됨
- 좌측 메시지 전송 → 좌측만 일반 채팅 응답
- 우측 [✕ 종료] → 좌측 영향 없음

## 회귀 테스트 계획
- 일반 모드 채팅 (ChatContainer) 정상
- 다른 모드 영향 없음
