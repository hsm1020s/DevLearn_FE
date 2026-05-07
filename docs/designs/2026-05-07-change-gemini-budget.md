# 설계: 2026-05-07-change-gemini-budget

**생성:** 2026-05-07 16:25
**워크트리:** /Users/moon/DevLearn_FE_wt/2026-05-07-change-gemini-budget
**브랜치:** task/2026-05-07-change-gemini-budget

## 목표
사이드바 LLM 옵션의 Gemini 항목을 최신·가성비 티어로 교체한다.
- `gemini-2.5-flash` (Flash) → `gemini-2.5-flash-lite` (Flash Lite)
- 라벨: "Gemini 2.5 Flash" → "Gemini 2.5 Flash Lite"

요구 조건: Claude Sonnet 4.6 이하의 단가. Gemini 2.5 Flash Lite 는 Flash 의 절반 이하 단가로, Sonnet 4.6 보다 한 자릿수 더 저렴해 요구를 만족.

## 변경 범위
- `src/utils/constants.js` — `LLM_OPTIONS` 의 Gemini 항목 1줄

(useAppStore 기본값/다른 컴포넌트는 영향 없음. selectedLLM 기본값은 직전 태스크에서 `claude-sonnet-4-6` 으로 설정되어 있으므로 본 태스크에서 손대지 않음.)

## 구현 계획
1. `LLM_OPTIONS[2]` value/label 갱신 (`gemini-2.5-flash` → `gemini-2.5-flash-lite`)

## 단위 테스트 계획
- 사이드바 드롭다운에 "Gemini 2.5 Flash Lite" 노출 확인
- 해당 항목 선택 시 store `selectedLLM = 'gemini-2.5-flash-lite'` 반영 확인

## 회귀 테스트 계획
- 메인 채팅(general) 1회 메시지 전송하여 스트리밍 정상 확인
- 사이드바 LLM 드롭다운에서 Claude Sonnet 4.6 / GPT-5.4 mini 도 정상 선택되는지 확인
