# 설계: 2026-04-22-chat-llm-cost-effective-swap

**생성:** 2026-04-22 11:48
**워크트리:** /Users/moon/DevLearn_FE_wt/2026-04-22-chat-llm-cost-effective-swap
**브랜치:** task/2026-04-22-chat-llm-cost-effective-swap

## 목표
채팅 사이드바의 LLM 선택 드롭다운(`LLM_OPTIONS`)을 다음 기준으로 정리한다.

1. **클라우드 3사 가성비 모델로 교체**
   - OpenAI: `gpt-4o` → `gpt-4o-mini` ("GPT-4o mini")
   - Anthropic: `claude-3.5` → `claude-haiku-4-5` ("Claude Haiku 4.5")
   - Google: `gemini` → `gemini-2.5-flash` ("Gemini 2.5 Flash")
2. **로컬 모델 3종은 유지하되 label 뒤에 " (로컬)" 꼬리표만 덧붙임**
   - Llama 3.1 8B → "Llama 3.1 8B (로컬)"
   - EXAONE 3.5 32B → "EXAONE 3.5 32B (로컬)"
   - GPT-OSS 20B → "GPT-OSS 20B (로컬)"
3. **기본 선택 모델**을 `gpt-4o` → `claude-haiku-4-5` 로 변경.

백엔드 라우팅은 이번 범위가 아님. 프론트의 `llm` 필드 value만 바뀌며, 백엔드가 새 ID를 인식하도록 하는 작업은 별도 태스크로 처리한다. (사용자 지시 범위: "그거로 해주고 로컬모델에는 뒤에 (로컬) 만 붙여줘 문자열로")

## 변경 범위
수정 파일 2개로 한정.

- `src/utils/constants.js` — `LLM_OPTIONS` 배열 값/라벨 교체, 로컬 표기 부착.
- `src/stores/useAppStore.js` — `selectedLLM` 초기값 변경 (`'gpt-4o'` → `'claude-haiku-4-5'`).

영향 범위:
- `Sidebar.jsx`의 Dropdown은 `LLM_OPTIONS`를 그대로 렌더링하므로 파일 수정 불필요.
- `chatApi.js` / `useStreamingChat.js` 는 `selectedLLM` 값을 body의 `llm`로 전달하므로 코드 수정 불필요. 단 백엔드가 새 ID를 모르면 응답이 실패할 가능성 있음(아래 회귀 체크에서 확인).
- `useChatStore`는 대화 메타데이터로 `llm` 문자열을 저장만 하므로 수정 불필요.

## 구현 계획
1. `src/utils/constants.js` 의 `LLM_OPTIONS`를 아래 순서로 재작성한다.
   ```js
   export const LLM_OPTIONS = [
     { value: 'gpt-4o-mini', label: 'GPT-4o mini' },
     { value: 'claude-haiku-4-5', label: 'Claude Haiku 4.5' },
     { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
     { value: 'llama-8b', label: 'Llama 3.1 8B (로컬)' },
     { value: 'exaone-32b', label: 'EXAONE 3.5 32B (로컬)' },
     { value: 'gpt-oss-20b', label: 'GPT-OSS 20B (로컬)' },
   ];
   ```
   로컬 3종은 value를 그대로 두어 기존 대화 메타와의 호환성을 유지.
2. `src/stores/useAppStore.js` 의 `selectedLLM: 'gpt-4o'` → `'claude-haiku-4-5'` 로 교체.
3. dev 서버 재기동 후 UI/동작 점검.

## 단위 테스트 계획
- 사이드바의 LLM 드롭다운을 열어 6개 항목이 위 순서대로 표시되는지 확인.
- 로컬 3종 라벨에 " (로컬)" 접미어가 정확히 붙었는지 확인.
- 앱 첫 실행 시 기본 선택이 "Claude Haiku 4.5"로 잡히는지 확인.
- 드롭다운에서 각 옵션 선택 시 `useAppStore.selectedLLM` 이 해당 value로 바뀌는지 DevTools/렌더 결과로 확인.
- 새 대화 생성 시 `conversation.llm` 에 선택된 value가 저장되는지 확인.

## 회귀 테스트 계획
- 채팅 이외 주요 기능 1개 이상 동작 확인:
  - 마인드맵 모드 진입 및 기존 맵 렌더링.
  - 또는 문서 모드 진입/사이드바 네비게이션.
- 기존 대화(로컬 모델 value 보존됨)를 선택하면 Dropdown이 해당 로컬 모델을 올바르게 복원하는지 확인.
- 메시지 전송 시도 — 백엔드가 새 value(`gpt-4o-mini` 등)를 받고 기대대로 처리/에러 메시지를 반환하는지 기록. (실패 시 프론트 한정 변경이라는 범위를 evidence에 명시.)
