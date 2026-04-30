# 설계: 2026-04-30-hide-empty-suggestions

**생성:** 2026-04-30 21:16
**워크트리:** /Users/moon/DevLearn_FE_wt/2026-04-30-hide-empty-suggestions
**브랜치:** task/2026-04-30-hide-empty-suggestions

## 목표
채팅방 첫 진입(빈 상태)에서 노출되던 추천 질문 칩 3개를 모든 모드(일반/학습/업무학습)에서 숨겨, 사용자가 직접 입력에 집중하도록 한다.

## 변경 범위
- `src/components/chat/EmptyChatView.jsx` — 예시 질문 칩 렌더링 블록 제거 (props는 유지하되 무시)
- `src/components/chat/ChatContainer.jsx` — `EXAMPLE_QUESTIONS` 상수 및 `examples` 전달 제거
- `src/components/worklearn/WorkLearnMode.jsx` — `WORKLEARN_EXAMPLES` 상수 및 `examples` 전달 제거
- `src/components/study/StudyChatTab.jsx` — 빈 상태 예시 칩 렌더링 블록 제거 + `subjectMeta.examples` 폴백 제거

## 구현 계획
1. EmptyChatView에서 `examples` 칩 JSX 제거.
2. ChatContainer에서 `EXAMPLE_QUESTIONS` 상수 및 `examples` prop 제거.
3. WorkLearnMode에서 `WORKLEARN_EXAMPLES` 상수 및 `examples` prop 제거.
4. StudyChatTab에서 `resolvedExamples` 계산 및 칩 JSX 제거 (subject 카탈로그 예시 폴백도 동시 제거).
5. 미사용 import/상수 정리.

## 단위 테스트 계획
- 일반 모드 진입 시 빈 상태에 추천 칩이 보이지 않음.
- 업무학습 모드 진입 시 빈 상태에 추천 칩이 보이지 않음.
- 공부 모드 진입 시 빈 상태에 추천 칩이 보이지 않음(StudyHomeCards 3카드 런처는 유지).
- 메시지 전송 후 일반 채팅 화면이 정상 동작.

## 회귀 테스트 계획
- 마인드맵/문서/사이드바/모드 전환 등 다른 주요 화면 동작 확인.
- 채팅 전송 → 응답 스트리밍이 정상으로 흐르는지 확인.

