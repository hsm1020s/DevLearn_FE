# 설계: 2026-05-07-change-llm-models

**생성:** 2026-05-07 16:21
**워크트리:** /Users/moon/DevLearn_FE_wt/2026-05-07-change-llm-models
**브랜치:** task/2026-05-07-change-llm-models

## 목표
사이드바 LLM 선택 옵션에서 OpenAI/Anthropic 모델을 최신 가성비 티어로 교체한다.
- GPT-4o mini → GPT-5.4 mini (`gpt-5.4-mini`)
- Claude Haiku 4.5 → Claude Sonnet 4.6 (`claude-sonnet-4-6`)

## 변경 범위
- `src/utils/constants.js` — `LLM_OPTIONS` 두 항목 교체
- `src/stores/useAppStore.js` — 기본 `selectedLLM`을 새 Claude(소넷 4.6)로 교체

(Gemini/로컬 3종은 그대로. 라벨/주석 외 다른 코드 변경 없음.)

## 구현 계획
1. `LLM_OPTIONS` 의 GPT/Claude 항목 value/label 갱신
2. `useAppStore.selectedLLM` 초기값 `claude-haiku-4-5` → `claude-sonnet-4-6`
3. 헤더 주석 가성비 티어 기준 날짜를 2026-05로 갱신

## 단위 테스트 계획
- dev 서버에서 사이드바 LLM 드롭다운에 두 신규 모델이 노출되는지 확인
- 기본 선택값이 Claude Sonnet 4.6 인지 (persist 초기값 기준) 확인
- 두 모델을 각각 선택했을 때 store `selectedLLM` 값이 정상 반영되는지 확인 (DevTools / 화면 라벨)

## 회귀 테스트 계획
- 마인드맵 토글 / 사이드바 접기 등 기존 useAppStore 다른 액션 정상 동작 확인
- 일반 채팅에 한 메시지 보내서 스트리밍이 정상인지 (LLM 메타만 바뀌었으므로 흐름 영향 없어야 함)
