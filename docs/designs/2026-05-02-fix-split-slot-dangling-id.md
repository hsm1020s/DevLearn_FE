# 설계: 2026-05-02-fix-split-slot-dangling-id

## 목표
학습 워크스페이스 좌·우 분할 슬롯(`useChatStore.splitConversationIds[mode][paneKey]`)이 가리키는 conv가 사이드바 삭제 등으로 사라져도 슬롯이 정리되지 않아, 좌측 패널이 dangling id (실제로는 우측 파인만의 옛 conv id)를 BE에 전송 → BE가 ON CONFLICT DO NOTHING 으로 같은 id에 메시지를 INSERT → 좌측 일반 채팅이 옛 파인만 conv 히스토리를 컨텍스트로 받아 "파인만 책 내용"이 나오는 누수.

두 군데를 막는다:
1. **`deleteConversations` 시 splitConversationIds 동시 정리** — 새로 발생하는 dangling 차단
2. **셀렉터 단계에서 dangling 검증** — 이미 store에 남은 dangling id는 conversations 배열에 없으면 null 취급, 호출자가 새 conv를 만들도록 유도

## 변경 범위

### `src/stores/useChatStore.js`
- `deleteConversations(ids)` 내부에서 `splitConversationIds`도 청소:
  각 mode/paneKey 슬롯의 id가 삭제 대상이면 null로 교체
- (선택) `fetchConversations` 후에도 슬롯의 id가 conversations에 없으면 null로 정규화 — 다음 새로고침 시 자동 정리

### `src/hooks/useStreamingChat.js`
- split 셀렉터를 conv 존재 검증과 묶음:
  ```js
  const splitConvId = useChatStore((s) => {
    if (!isSplit) return null;
    const id = s.splitConversationIds[mode]?.[paneKey] ?? null;
    if (!id) return null;
    return s.conversations.some((c) => c.id === id) ? id : null;
  });
  ```
- 이렇게 하면 dangling 슬롯은 즉시 effective null 처리 → ensureConversation이 새 conv를 만든다.

### 영향 받지 않음
- BE / 다른 모드 / 일반 채팅 / 마인드맵 / 강의 모드 — 변경 없음

## 단위 테스트 계획
- 사이드바에서 split 좌측이 사용 중인 conv 삭제 → 좌측 send 시 새 conv 생성 (옛 id 재사용 안 함)
- 사이드바에서 우측 파인만 conv 삭제 → 우측 종료/시작 흐름 정상
- 양쪽이 모두 사용 중일 때 한쪽 conv만 삭제 → 다른쪽 영향 없음

## 회귀 테스트 계획
- 정상 흐름(삭제 없음)에서 좌·우 메시지 송수신 정상
- conv 일괄 삭제(여러 개 선택) 시 splitConversationIds 청소가 마인드맵/일반 모드에 영향 없음
