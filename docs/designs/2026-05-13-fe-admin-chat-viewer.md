# 설계: 2026-05-13-fe-admin-chat-viewer

**생성:** 2026-05-13 18:53
**워크트리:** /Users/moon/DevLearn_FE_wt/2026-05-13-fe-admin-chat-viewer
**브랜치:** task/2026-05-13-fe-admin-chat-viewer

## 목표
AdminPage 에 "사용자 채팅" 섹션 추가 — 전체 사용자 대화를 검색·필터·페이징으로 보고,
행 클릭 시 메시지 전체 본문(질문/답변 페어)을 펼친다.

BE Phase (`938c5c7`):
- GET /api/admin/conversations (검색·모드·기간·페이징)
- GET /api/admin/conversations/{id}/messages

## 변경 범위 (모두 FE)
1. `src/services/adminChatApi.js` 신설 — `listAdminConversations(params)`, `fetchAdminConversationDetail(id)`
2. `src/components/admin/AdminConversationsBoard.jsx` 신설 — 검색바 + 필터 + 표 + 펼침
3. `src/pages/AdminPage.jsx` — 새 섹션 추가 (BarChart3 옆에 MessagesSquare 아이콘)

## 구현 계획

### adminChatApi.js
```js
export async function listAdminConversations({ q, mode, period, page, size }) {
  const { data } = await api.get('/admin/conversations', {
    params: { q, mode, period, page, size },
  });
  return data.data;
}
export async function fetchAdminConversationDetail(id) {
  const { data } = await api.get(`/admin/conversations/${id}/messages`);
  return data.data;
}
```

### AdminConversationsBoard
- state: q(debounced), mode, period, page, listData, loading, error, expandedId, detail(map id→detail), detailLoading
- 검색바: 입력 후 300ms debounce 로 fetch
- 모드 토글: all/general/study/worklearn
- 기간 토글: total/today/week/month
- 표: 사용자(name/email) | 권한 | 모드 | 제목 | 메시지 수 | 마지막 시각
- 행 클릭 → lazy fetch /messages → 인라인 펼침 (UsageBoard 패턴 차용)
- 펼침: user/assistant 메시지 페어 시간순 (각각 라벨 + 본문, role 색상 구분)
- 페이징: 이전/다음 버튼 + "X / Y"

### AdminPage 통합
"LLM 사용량" 섹션 아래, "기능개선 제안" 위에 새 `<section>`.
SuggestionsBoard·AdminUsageBoard 와 동일 카드 스타일.

## 단위 테스트 계획
- ADMIN 로그인 → /admin → "사용자 채팅" 섹션 표시
- 키워드 입력 → debounce 후 1회 호출, 결과 갱신
- 모드/기간 토글 → 즉시 호출
- 행 클릭 → /messages 호출 → 펼침
- 빈 응답/에러/로딩 분기 UI
- 페이지 이동 시 펼침 상태 초기화

dev :3009 transform 통과.

## 회귀 테스트 계획
- 기존 AdminPage 섹션(통계/대화/문서/LLM 사용량/제안) 정상
- 일반 사용자 가드 유지
- 채팅·사이드바 무관
