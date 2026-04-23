# 설계: 2026-04-23-fix-llm-selector-sync

**생성:** 2026-04-23 10:45
**워크트리:** /Users/moon/DevLearn_FE_wt/2026-04-23-fix-llm-selector-sync
**브랜치:** task/2026-04-23-fix-llm-selector-sync

## 목표
GPT로 설정된 채팅방을 열어둔 채로 브라우저를 새로고침하면 좌측 사이드바의 "LLM 선택" 드롭다운이 기본값(Claude Haiku)으로 되돌아가는 버그 수정.
**불변식**: 사이드바 셀렉터의 값은 항상 현재 선택된 대화(`currentConversationId`)에 저장된 `llm`과 일치해야 한다 — 새로고침 직후에도, 대화 전환 시에도.

## 변경 범위
- `src/components/layout/Sidebar.jsx` — `currentConversationId` 변경 시(복원/전환 모두) 해당 대화의 `llm`/`mode`를 `selectedLLM`/`mainMode`에 동기화하는 `useEffect` 추가. 기존 `handleSelectConversation` 내부의 수동 동기화는 useEffect로 일원화 가능하면 제거.

영향 범위:
- 사이드바 LLM/모드 셀렉터 표시값
- 채팅 전송 시 사용할 LLM 결정 로직(셀렉터 `selectedLLM`을 참조하는 모든 곳) — 새로고침 직후 첫 전송이 대화에 저장된 모델로 나가야 정상
- 대화 전환 시 동작은 그대로 유지돼야 함

## 구현 계획
1. `Sidebar.jsx` 에 다음 useEffect 추가:
   ```
   useEffect(() => {
     if (!currentConversationId) return;
     const conv = conversations.find((c) => c.id === currentConversationId);
     if (!conv) return;
     if (conv.llm && conv.llm !== selectedLLM) setLLM(conv.llm);
     if (conv.mode && conv.mode !== mainMode) setMainMode(conv.mode);
   }, [currentConversationId, conversations]);
   ```
   - 의존성은 `currentConversationId`와 `conversations` — persist 복원 직후 `conversations` 배열이 채워지는 시점에도 확실히 동기화되도록.
   - 이미 같은 값이면 set 호출을 skip(불필요한 리렌더/`setMainMode` 부작용 방지).
2. `handleSelectConversation` 내 `setLLM`/`setMainMode` 호출은 유지(즉시성 우선). useEffect는 새로고침 복원 같은 "클릭 없는" 경로의 세이프티넷.
3. `setMainMode` 호출은 모드 전환 시 `useChatStore.switchMode()`까지 트리거하므로, useEffect에서는 **현재 모드와 다를 때만** 호출(의존성 루프/무한 반영 방지). llm도 동일.

## 단위 테스트 계획
검증 수단: Vite 프리뷰 빌드 + Playwright/브라우저 수동 확인.
1. GPT 대화 생성 → 새로고침 → 셀렉터가 GPT인지 확인 (버그 재현 → 수정 후 통과)
2. Claude 대화로 전환 → 셀렉터가 Claude로 바뀌는지 확인 (회귀 없음)
3. 대화 없는 상태(빈 conversations)에서 새로고침 → 셀렉터가 기본값 유지, 에러 없음
4. 서로 다른 mode(general/study)에 속한 대화로 전환 → mode도 함께 동기화되는지 확인
5. 콘솔에 useEffect 무한 루프(동일 값 재설정으로 인한 rerender 폭주) 없음을 React DevTools 또는 로그로 확인

## 회귀 테스트 계획
이번 변경과 무관한 주요 기능 1개 이상을 실제 사용:
- 마인드맵 토글 on/off
- 문서 업로드 모달 열기/닫기
- 채팅 메시지 전송 1회 (모델 선택이 올바르게 반영되는지까지 포함)

결과는 `.claude/state/evidence/2026-04-23-fix-llm-selector-sync/regression/notes.md`에 기록.
