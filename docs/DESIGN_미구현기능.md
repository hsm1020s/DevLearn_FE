# 미구현 기능 설계 문서

> 백엔드(`DevLearn_BE`)에 구현되어 있으나 프론트엔드(`DevLearn_FE`)에서 연결되지 않은 기능과, 프론트 내에서 누락된 UI 흐름에 대한 설계 모음.
> 작성일: 2026-04-20

---

## 목차 / 미구현 항목 요약

| # | 항목 | 핵심 변경 범위 |
|---|------|---------------|
| 1 | 채팅 대화 목록 서버 동기화 | `useChatStore` + Sidebar + chatApi |
| 2 | RAG 문서 목록 서버 연동 + 업무학습 질의 흐름 | `useRagStore` + WorkStudyMode + DocumentList |
| 3 | 자격증 학습 통계 화면 | 신규 CertStatsPanel + certApi.getCertStats |
| 4 | 마인드맵 서버 동기화 | `useMindmapStore` 전면 리팩토링 + mindmapApi |
| 5 | 관리자 대시보드 서버 연동 | AdminPage 재작성 + adminApi 신규 |
| 6 | 업무학습 RAG 질의 흐름 연동 | useRagChat 훅 + SourceChunkModal |

### 조사 결과 대조표 (백엔드 ↔ 프론트)

| 백엔드 엔드포인트 | 프론트 호출처 | 상태 |
|------------------|--------------|------|
| `GET /chat/conversations` | 없음 | ❌ 미연결 |
| `PATCH /chat/conversations/{id}` | 없음 | ❌ 미연결 (프론트는 로컬 state만) |
| `DELETE /chat/conversations` | 없음 | ❌ 미연결 |
| `GET /rag/docs` | 없음 | ❌ 미연결 |
| `DELETE /rag/docs/{id}` | `ragApi.js` 선언만 | ❌ UI 미연결 |
| `POST /rag/query` | 없음 | ❌ UI 미연결 (WorkStudyMode는 /chat/stream만 사용 중) |
| `GET /rag/source/{chunkId}` | 없음 | ❌ 미연결 |
| `GET /cert/stats` | 없음 | ❌ 미연결 |
| `POST /mindmap/save` | `mindmapApi.js` 선언만 | ❌ 호출 없음 |
| `GET /mindmap/list` | `mindmapApi.js` 선언만 | ❌ 호출 없음 |
| `GET /mindmap/{id}` | `mindmapApi.js` 선언만 | ❌ 호출 없음 |
| `DELETE /mindmap/{id}` | 없음 | ❌ 클라이언트 함수 미존재 |
| `GET /admin/dashboard` | 없음 | ❌ 미연결 (로컬 스토어 집계) |

---

## 1. 채팅 대화 목록 서버 동기화

### 목적
현재 `useChatStore`는 `zustand/persist`를 통해 대화 목록과 메시지를 모두 localStorage에만 저장한다. 다음 문제를 해결한다.

- 기기/브라우저 간 대화 목록 동기화 불가
- 프론트 `generateId()` UUID와 서버 UUID 불일치 가능성으로 `/chat/stream` 응답의 `conversationId`가 로컬 대화와 매칭되지 않을 위험
- 로그인 이전의 익명 대화가 서버에 남지 않음
- `PATCH`, `DELETE` 엔드포인트가 있음에도 단순 로컬 상태 변경만 수행 중

본 설계는 **"대화 목록(메타데이터)은 서버 SoT, 메시지 본문은 로컬 캐시"** 이원화 전략.

### 변경 대상 파일
- `src/services/chatApi.js` — API 함수 3종 추가
- `src/services/mock/chatMock.js` — Mock 함수 3종 추가
- `src/stores/useChatStore.js` — 서버 동기화 액션 추가, persist partialize 변경
- `src/components/layout/Sidebar.jsx` — rename/toggleFavorite/delete를 async 대응, 초기 pull 트리거
- `src/hooks/useStreamingChat.js` — 스트리밍 응답 `conversationId` 치환 방어
- (선택) `src/hooks/useConversationSync.js` — `fetchConversations`를 effect로 발화시키는 훅

### API 함수 추가 (services)
`src/services/chatApi.js`에 다음을 추가. `useMock` 분기, `data.data` 언래핑 유지.

```js
// 반환: Promise<ConversationSummary[]>
export async function listConversations() { /* GET /chat/conversations */ }

// patch: { title?: string, isFavorite?: boolean }
// 반환: Promise<ConversationSummary>
export async function updateConversation(id, patch) { /* PATCH /chat/conversations/{id} */ }

// 반환: Promise<{ deletedIds: string[] }>
export async function deleteConversations(ids) {
  // api.delete('/chat/conversations', { data: { ids } })  ← body 전달 방식 주의
}
```

주의: `DELETE` body는 `api.delete(url, { data: body })` 형태. `updateConversation`이 204만 반환할 경우 호출부에서 낙관적 값 유지.

Mock: 모듈 스코프 `mockConversations = []`에 대해 목록/수정/삭제 3종 구현. 기존 `MOCK_DELAY` 재사용.

### 스토어 변경 (useChatStore)

**상태 스키마 확장**
```js
{
  conversations: [],               // 서버 기준 메타
  messagesByConvId: {},            // 대화별 메시지 캐시 (분리)
  currentConversationId: null,
  isStreaming: false,
  isConversationsLoading: false,
  conversationsError: null,
  lastSyncedAt: null,
}
```

핵심: 기존 `c.messages` 배열을 대화 객체 밖으로 빼 `messagesByConvId`로 분리 → 서버 메타로 `conversations`를 교체해도 메시지 캐시가 유지됨.

**신규 액션**
- `fetchConversations()` — 서버 목록 pull, loading/error 상태 관리
- `reconcileConversationId(tempId, serverId)` — 스트리밍 응답과 로컬 id 불일치 시 치환
- `resetChat()` — 로그아웃 시 전체 초기화

**기존 액션 async화 + 낙관적 업데이트**
- `renameConversation(id, title)`: 스냅샷 저장 → 낙관적 set → `updateConversation` await → 실패 시 롤백
- `toggleFavorite(id)`: 낙관적 반전 → 실패 시 롤백
- `deleteConversations(ids)`: 낙관적 제거 → 실패 시 복구, current가 삭제 대상이면 null

**conversationId 정책 (전략 A 권장)**
프론트 `generateId()` UUID를 서버가 그대로 수용하도록 백엔드와 합의 → 별도 reconcile 불필요. 방어적으로 `onDone.conversationId !== convId`일 때만 reconcile 실행.

**persist partialize 변경**
```js
partialize: (state) => ({
  messagesByConvId: state.messagesByConvId,
  currentConversationId: state.currentConversationId,
  // conversations는 제외 — 앱 진입 시 서버 pull 강제
})
```
version 2 → 3, migrate에서 `conversations[i].messages`를 `messagesByConvId[convId]`로 이동.

### UI 변경 지점
**Sidebar.jsx**
- `useEffect(() => { if (isLoggedIn) fetchConversations(); }, [isLoggedIn])`
- `isConversationsLoading` 스켈레톤, 에러 시 재시도 CTA
- rename/delete 핸들러 `await` 처리, 실패 토스트

**useStreamingChat.js**
- `onDone(result)`에서 `result.conversationId !== convId`이면 reconcile
- 스트림 완료 후 debounce로 `fetchConversations()` 재호출(옵션)

**인증 연동**
- 로그인 성공 직후 Sidebar effect가 `fetchConversations()` 자동 호출
- 로그아웃 시 `useChatStore.resetChat()`

### 데이터 흐름 시나리오
1. **로그인 후 앱 진입** → Sidebar mount → `fetchConversations()` → 서버 목록 set, 메시지 캐시 보존.
2. **새 대화 + 첫 메시지(전략 A)** → `createConversation()`으로 convId 발급 → `/chat/stream` 호출, 서버가 동일 UUID로 생성 → `onDone.conversationId === convId` 확인 → 백그라운드 `fetchConversations()`.
3. **이름 변경** → 낙관적 set → 실패 시 스냅샷 롤백 + `showError`.
4. **일괄 삭제** → 대상 제외한 배열로 set → 실패 시 복구, current가 삭제 대상이면 null.
5. **오프라인** → `conversationsError` 설정 → 재시도 CTA, 메시지 로컬 캐시는 read-only로 접근 가능.

### 마이그레이션/호환성
- persist v2 → v3: `conversations[i].messages` → `messagesByConvId[convId]`로 이동 후 `messages` 필드 삭제
- 비로그인 상태에서 쌓아둔 로컬 대화는 업로드 엔드포인트가 없어 이관 불가 → 릴리스 노트 명시
- `generateId()`는 이미 RFC4122 v4 UUID → 백엔드 `UUID` 호환. 백엔드 UUID 수용 여부 계약 확인 필요
- `mode`/`llm` 문자열이 `MODE_LIST`/`LLM_OPTIONS.value`와 정확히 일치하는지 점검, 불일치 시 `getModeConfig` 폴백 추가
- Mock은 기존 환경 플래그 그대로 동작

### 구현 체크리스트
**Phase 1 — API 레이어**
- [ ] `chatApi.js`에 `listConversations`/`updateConversation`/`deleteConversations` 추가
- [ ] `DELETE` body 전달 방식(`api.delete(url, { data })`) 검증
- [ ] `chatMock.js` 3종 구현 (모듈 스코프 배열)

**Phase 2 — 스토어 리팩토링**
- [ ] 상태에 `messagesByConvId`, loading/error/lastSyncedAt 추가
- [ ] `addMessage`를 `messagesByConvId[currentConversationId]` 기반으로 변경
- [ ] `fetchConversations`/`reconcileConversationId`/`resetChat` 신규
- [ ] 기존 액션 async화 + 롤백 로직
- [ ] persist version 3 + migrate

**Phase 3 — UI 연동**
- [ ] Sidebar `useEffect`로 fetch, 스켈레톤/재시도 UI
- [ ] rename/toggleFavorite/delete 핸들러 await + 토스트
- [ ] `useStreamingChat.onDone` reconcile 방어

**Phase 4 — 인증 연동**
- [ ] 로그인 후 fetch 트리거 동작 확인
- [ ] 로그아웃 시 resetChat

**Phase 5 — 검증**
- [ ] Mock E2E 수기 확인
- [ ] 실 백엔드 연동 후 conversationId 규약 재확인
- [ ] persist v2→v3 마이그레이션 예외 없음
- [ ] 오프라인 상태 UI

---

## 2. RAG 문서 목록 서버 연동 + 업무학습 질의 흐름

### 목적
- 서버 `/api/rag/docs`가 있으나 프론트 호출 없음 → 다른 기기/세션 업로드 반영 불가
- 업로드 비동기 처리 상태 폴링 없음 (즉시 completed로 표시되는 버그)
- 삭제 API 있으나 UI가 `removeDoc` 로컬만 호출 → 서버 고아 문서
- 본 설계는 **서버 SoT 재정의**, **processing→completed 폴링**, **삭제 시 서버 호출 → 성공 시 로컬 반영**, **WorkStudyMode 내 RAG 질의 정합성 확인**을 묶음

### 변경 대상 파일
- `src/services/ragApi.js` — `listRagDocs` 추가
- `src/services/mock/ragMock.js` — in-memory Map + 폴링 시뮬레이션
- `src/stores/useRagStore.js` — 서버 연동 리팩토링
- `src/stores/useDocStore.js` — **deprecate, `useRagStore`로 통합** (현재 WorkStudyMode/PdfUploadModal이 사용 중)
- `src/components/work/WorkStudyMode.jsx` — 진입 시 `fetchDocs()`
- `src/components/work/DocumentList.jsx` — 삭제 팝오버 + `deleteDocument` API
- `src/components/work/RagUploader.jsx` — `useRagStore` 교체
- `src/components/common/PdfUploadModal.jsx` — 즉시 completed 처리 제거, pending + 폴링
- `src/components/work/SourcePanel.jsx` — sources 컬럼 계약 확정
- `src/utils/constants.js` — `DOC_STATUS.pending` 보강 (선택)

### API 함수 추가
```js
export async function listRagDocs() {
  if (API_CONFIG.useMock) return mock.listRagDocs();
  const { data } = await api.get('/rag/docs');
  return data.data;
}
```

Mock은 `mockDocs = new Map()` + 업로드 시 `processing/progress:0`으로 저장 후 1~2초 뒤 `completed/progress:100` 전이 타이머 추가.

### 스토어 변경 (useRagStore)
서버 연동 스토어로 승격. `(set, get)` 시그니처로 변환.

**추가 상태**
- `ragDocs: RagDoc[]`
- `isLoadingDocs: boolean`
- `fetchError: string | null`
- `pollingIds: Set<string>` (persist partialize에서 제외)

**신규 액션**
- `fetchDocs()` — 서버 목록 pull, processing 항목 자동 폴링 시작
- `addPendingDoc({ docId, fileName })` — 업로드 직후 낙관적 표시
- `replacePendingDoc(tempId, serverId, meta)` — 임시 id를 실 id로 교체
- `markDocError(docId, err)` — 업로드 실패 반영
- `pollDocStatus(docId)` — 2초 간격 재귀 setTimeout, 중복 폴러 차단, completed/error 시 종료
- `stopPolling(docId)` — 외부 취소
- `removeDoc(docId)` async — `deleteDocument` 성공 후 로컬 제거

### UI 변경 지점
**WorkStudyMode.jsx**
- 마운트 시 `useEffect(fetchDocs, [])`
- `useDocStore` → `useRagStore`로 치환, `hasDocuments = ragDocs.length > 0`
- SSE `done` 이벤트의 `sources`를 `SourcePanel`에 그대로 전달 (현재 RAG 검색은 `/chat/stream`의 `mode=work`가 내부적으로 수행하는 구조를 유지)

**DocumentList.jsx**
- `useRagStore` 교체
- 상태 배지 3종(processing/completed/error) 분기, `progress`% 진행 바
- 삭제 버튼 → `Sidebar.jsx`의 `deleteConfirm` 팝오버 패턴 이식, `await removeDoc`

**PdfUploadModal.jsx / RagUploader.jsx**
- 업로드 흐름: `addPendingDoc('temp-...')` → `uploadDocument(file)` → `replacePendingDoc` → `pollDocStatus`
- 실패 시 `markDocError` + 토스트
- 즉시 completed 처리 코드 삭제

**SourcePanel.jsx**
- 현재 카드 렌더 유지, 계약만 확정 (`{docId, docName, page, chunk, similarity: 0~1}`)
- 옵션(후속): 카드 클릭 → `getSource(chunkId)` 모달 (→ 섹션 6과 연계)

### 폴링 전략
- 폴링 단위: 문서 id별 독립 `setTimeout` 체인
- 엔드포인트: `listRagDocs()` 재호출(단건 엔드포인트 없음)
- 간격 2000ms 고정, `setInterval` 미사용(겹침 방지)
- 종료 조건: `completed | error` / 목록에서 사라짐 / 수동 stopPolling
- 에러 내성: 1회 실패 → 중단 + 토스트
- 라이프사이클: 스토어 레벨이므로 모드 이탈해도 백그라운드 계속
- `fetchDocs()` 응답에 processing 있으면 자동 폴링 시작

### 데이터 흐름 시나리오
- **A. 진입**: `fetchDocs` → 스켈레톤 → 목록 set → processing 자동 폴링
- **B. 신규 업로드**: `addPendingDoc(temp)` → upload → `replacePendingDoc(real)` → 2초 간격 상태 갱신 → completed
- **C. 업로드 에러**: `markDocError` → 빨간 배지 + 삭제 버튼만 노출
- **D. 삭제**: 팝오버 확정 → `await removeDoc` → 실패 시 목록 유지, 토스트만
- **E. RAG 질의**: completed ≥ 1 → `ChatInput` 전송 → `/chat/stream` (mode=work) → `done` 이벤트의 sources → `SourcePanel` 렌더

### 구현 체크리스트
**서비스**
- [ ] `listRagDocs()` 추가, mock 대응
- [ ] mock 업로드 지연 처리

**스토어**
- [ ] `(set, get)` 변환, 상태 필드 추가
- [ ] `fetchDocs/addPendingDoc/replacePendingDoc/markDocError/pollDocStatus/stopPolling/removeDoc(async)`
- [ ] `persist.partialize`에서 pollingIds 제외
- [ ] `useDocStore` → `useRagStore` 마이그레이션 (참조 제거)

**UI**
- [ ] WorkStudyMode 진입 effect
- [ ] DocumentList 팝오버 + 진행 바
- [ ] PdfUploadModal 흐름 교체
- [ ] RagUploader 스토어 교체

**에러**
- [ ] 업로드/조회/삭제/폴링 실패 각각 토스트 경로

**회귀 테스트**
- [ ] 신규 업로드 processing → completed 전이
- [ ] 새로고침 후 processing 자동 폴링 재개
- [ ] 동시 업로드 2건 폴러 독립
- [ ] 삭제 팝오버 취소/확정
- [ ] 네트워크 끊김 시 삭제 실패 UX

---

## 3. 자격증 학습 통계 화면

### 목적
현재 `CertMode`는 일회성 세션(업로드→퀴즈→결과)만 제공. `StudyStats.jsx`는 현재 세션 요약만 표시하며 `setQuiz()` 호출 시 `answers` 초기화. 누적 학습 이력(난이도별/유형별 정답률) 조회 수단 없음.

백엔드 `GET /api/cert/stats`를 소비하는 **누적 학습 통계 화면**을 추가.

### 변경 대상 파일
| 구분 | 경로 | 변경 |
|---|---|---|
| API | `src/services/certApi.js` | `getCertStats()` 추가 |
| Mock | `src/services/mock/certMock.js` | `getCertStats()` Mock |
| 패널 | `src/components/cert/CertStatsPanel.jsx` | 신규 |
| 차트 | `src/components/cert/StatsBreakdownChart.jsx` | 신규 |
| 카드 | `src/components/cert/StatsSummaryCards.jsx` | 신규 |
| 모달 등록 | `src/components/layout/MainContent.jsx` | `MODAL_CONFIG.certStats` 추가 |
| 트리거 | `src/components/cert/CertMode.jsx` | 통계 버튼 |
| 상수 | `src/utils/constants.js` | `STATS_DIFFICULTY_LABELS`, `STATS_TYPE_LABELS` |

기존 `StudyStats.jsx`(현재 세션)는 유지. 두 화면은 목적이 다름.

### API 함수 추가
```js
export async function getCertStats() {
  if (API_CONFIG.useMock) return mock.getCertStats();
  const { data } = await api.get('/cert/stats');
  return data.data;
}
```

반환 스키마는 백엔드 그대로: `{ totalSolved, correctCount, correctRate, byDifficulty:[{difficulty,total,correct,rate}], byType:[{type,total,correct,rate}] }`.
Mock: 정상 응답 + `VITE_MOCK_STATS_EMPTY=true` 시 빈 응답.

### UI 구조 (Wireframe)
```
┌─────────────────────────────────────────────────────────────┐
│  학습 통계                                              [ X ] │
├─────────────────────────────────────────────────────────────┤
│  ┌────────────┐ ┌────────────┐ ┌─────────────────────────┐  │
│  │ 총 풀이     │ │ 정답        │ │ 정답률                    │  │
│  │ 128문제    │ │ 92개       │ │  72%                    │  │
│  │ [BookOpen] │ │[CheckCircle]│ │ ███████████░░░ 72%      │  │
│  └────────────┘ └────────────┘ └─────────────────────────┘  │
│                                                             │
│  ── 난이도별 성적 ───────────────────────────────────────── │
│   쉬움       ██████████████████░░░░  86.6%   (52/60)       │
│   혼합       ██████████████░░░░░░░░  70.0%   (28/40)       │
│   어려움     ████████░░░░░░░░░░░░░░  42.8%   (12/28)       │
│                                                             │
│  ── 유형별 성적 ─────────────────────────────────────────── │
│   4지선다    ███████████████░░░░░░░  75.0%   (60/80)       │
│   OX         ████████████████░░░░░░  80.0%   (24/30)       │
│   단답형     ████████░░░░░░░░░░░░░░  44.4%   (8/18)        │
│                                                             │
│  마지막 업데이트: 방금 전                   [ 새로고침 ] [ 닫기 ]│
└─────────────────────────────────────────────────────────────┘
```

빈 상태: `BarChart3` 아이콘 + "아직 풀이한 문제가 없습니다" + "퀴즈 설정 바로가기" 버튼.

### 컴포넌트 분해
- **CertStatsPanel (컨테이너)** — API 호출, loading/error/empty/data 4-state 분기, 어댑터로 `items` 정규화
- **StatsSummaryCards** — `{totalSolved, correctCount, correctRate}` 3카드, 정답률 프로그레스 내장
- **StatsBreakdownChart** — `{title, items, labelMap}` props, 순수 CSS 막대 재사용

### 차트 라이브러리 결정
**결정: 순수 CSS 막대 사용 (recharts 미도입)**
- 데이터 규모 작음(행 3×2)
- 번들 비용: recharts는 미사용 중이라 첫 소비처에서 d3 의존성 증가
- 디자인 토큰 일관성: SVG에 CSS 변수 주입이 번거로움
- 기존 `StudyStats.jsx:51-56`, `QuizPlayer.jsx:113-118`과 동일 패턴 재사용 가능

```jsx
<div className="h-2.5 rounded bg-bg-secondary overflow-hidden">
  <div className="h-full rounded bg-primary transition-all"
       style={{ width: `${Math.round(rate * 100)}%` }} />
</div>
```

### 디자인 토큰/스타일
- 배경: `bg-bg-primary` / `bg-bg-secondary` / `bg-bg-tertiary`
- 텍스트: `text-text-primary|secondary|tertiary`
- 강조: `bg-primary` (막대), `text-primary` (수치)
- 상태 색: 정답률 **값 텍스트**만 `text-success`(≥80) / `text-warning` / `text-danger`. 막대 색은 `bg-primary` 고정
- 아이콘: `BarChart3`, `Target`, `CheckCircle`, `TrendingUp` (기존 StudyStats와 동일)
- 커스텀 CSS 금지

### 진입 지점
**결정: 옵션 B — 모달 + 헤더 트리거**
- `MODAL_CONFIG.certStats = { title: '학습 통계', Component: CertStatsPanel }` 등록
- `CertMode.jsx` 상단 우측에 `BarChart3` 아이콘 버튼 (ModeHeader 수정보다 영향 범위 작음)
- `onClick → setActiveModal('certStats')`
- QuizPlayer 결과 화면에도 "누적 통계 보기" 보조 진입점

근거: 기존 모달 슬롯 확장으로 변경 범위 최소, 세션 어느 단계에서도 열 수 있음.

### 빈 상태 / 로딩 / 에러
| 상황 | 판별 | 렌더 |
|---|---|---|
| 최초 로딩 | `loading && !data` | 스피너 `w-6 h-6 border-2 border-primary border-t-transparent`, 최소 높이 240px |
| 리프레시 | `loading && data` | 기존 유지 + 새로고침 버튼 옆 `w-4 h-4` 스피너 |
| 에러 | `error` | 인라인 `border border-danger/40 bg-danger/10` 블록 + 다시 시도, `showError` 토스트 |
| 빈 상태 | `totalSolved === 0` | 아이콘 + 안내 + "퀴즈 설정 바로가기" → `setCertStep('upload')` + `setMainMode('cert')` |
| 부분 빈 | `byDifficulty=[]` 또는 `byType=[]` | 해당 섹션만 `text-xs text-text-tertiary` 플레이스홀더 |

### 구현 체크리스트
1. 상수 추가 (`STATS_DIFFICULTY_LABELS`, `STATS_TYPE_LABELS`)
2. `certApi.getCertStats()` + mock
3. `StatsSummaryCards.jsx` (grid-cols-1 md:grid-cols-3, 프로그레스 내장)
4. `StatsBreakdownChart.jsx` (순수 CSS 막대, tabular-nums)
5. `CertStatsPanel.jsx` (4-state, 어댑터, 하단 액션 바)
6. `MainContent.MODAL_CONFIG.certStats` 등록 (lazy import)
7. `CertMode` 상단 `BarChart3` 버튼 (또는 결과 화면 버튼 추가)
8. QuizPlayer 결과에 "누적 통계 보기" 버튼
9. QA: 모달 ESC/바깥 클릭/다크 테마/모바일 1열/리프레시 연타/키보드 포커스

---

## 4. 마인드맵 서버 동기화

### 목적
`useMindmapStore`는 persist(localStorage)만 사용 → 기기 간 동기화 불가, 용량 제한, 브라우저 캐시 삭제 시 소실. `mindmapApi.js`는 존재하나 미호출.
**"로컬=편집용 캐시, 서버=SoT"** 모델로 전환. 기존 편집 UX(즉각 반응, 오프라인 허용) 유지하며 모드별 마인드맵이 계정에 묶여 동기화.

### 변경 대상 파일
**주 변경**
- `src/services/mindmapApi.js` — `deleteMindmap` 추가
- `src/services/mock/mindmapMock.js` — `deleteMindmap` + id 보존 saveMindmap
- `src/stores/useMindmapStore.js` — 동기 액션, syncStatus, pendingSaveMapIds, debounce 저장, id 교체
- `src/stores/useAppStore.js` — `setMainMode` 흐름에 pull 트리거
- `src/components/mindmap/MindmapPanel.jsx` — 저장 상태 인디케이터, pull/삭제 연동

**보조**
- `src/components/mindmap/MindmapCanvas.jsx` — 스토어 내부 처리 위주, 거의 변경 없음
- `src/components/mindmap/MindmapControls.jsx` — `markSaved()` 호출 이름 혼동 방지 (`markPdfExported` 로 rename 권장)

### API 함수 추가/보강
- `deleteMindmap(id)` — `DELETE /api/mindmap/{id}`, mock 분기
- `saveMindmap` — 기존 시그니처 유지, 응답 id 치환 가능성 JSDoc 명시
- `getMindmapList()`, `getMindmap(id)` — mode 포함, 메모리 기반 mock 보강
- 저장/삭제 호출은 `skipGlobalErrorHandler` 옵션으로 500 에러 페이지 라우팅 회피(필요 시 `api.js` 인터셉터 분기 추가)

### 저장 전략 결정 (debounce vs 명시 vs 즉시)
**권장: (B) debounce 저장 + (C) 보조 명시 저장 하이브리드**

근거:
- (A) 즉시: 드래그마다 네트워크 왕복 → 부담
- (B) debounce: 편집 중엔 저장 미발생, 멈춘 뒤 자동 저장. UI 인디케이터 필수
- (C) 단독: 모바일/실수 종료 시 손실 위험

파라미터:
- wait = 1500ms, trailing, 동일 맵 타이머는 취소 후 재설정
- 저장 중 변경 시 `dirty` 플래그 → 저장 완료 후 재예약
- 실패 재시도: 2s → 5s → 15s (3회), 이후 `error` 상태
- `visibilitychange`/`beforeunload`에서 강제 flush (`fetch(..., { keepalive: true })`)
- 헤더에 "지금 저장" 보조 버튼(error/isLocal/30초 이상 idle 조건 노출)

### 스토어 변경 (useMindmapStore)
**신규 상태 필드**
- `syncStatus: { [mapId]: 'idle'|'saving'|'saved'|'error' }`
- `pendingSaveMapIds: Set<string>` (persist 제외)
- `lastServerSyncAt: { [mapId]: number }`
- `isListLoading: boolean`
- `serverIdByLocalId: { [localId]: serverId }`
- 기존 `lastSavedAt` → `lastLocalEditAt`으로 의미 재정의 권장

**신규 액션**
- `fetchMapList()` — 목록 pull, 요약만 있는 맵은 `nodes: null` placeholder
- `loadMapFromServer(id)` — 상세 pull, `maps[id]` 덮어쓰기
- `loadMap(mapId)` 리팩토링 — summary면 server pull await
- `restoreForMode(mode)` 리팩토링 — 로컬 복원 + 백그라운드 list pull
- `scheduleSave(mapId)` (private)
- `flushSave(mapId)` / `saveActiveNow()`
- `deleteMapOnServer(mapId)` — 서버 호출 후 로컬 제거, 임시 id는 로컬만

**Private 모듈 상태**
- `const timers = new Map<string, number>()`, `const dirty = new Set<string>()`
- `performSave`는 저장 중 변경을 dirty에 추적하고 완료 후 재예약

### 데이터 흐름 시나리오
**신규 생성**
1. (+) 클릭 → 임시 UUID(`local-<uuid>`) 발급, `isLocal=true`
2. 첫 실효 변경 시 `scheduleSave` 태움
3. 1.5초 후 `saveMindmap({ id: undefined, title, mode, nodes })`
4. 응답의 `data.id`로 `maps` 키 교체, `activeMapId`도 치환, `serverIdByLocalId[tempId]=serverId`

**편집 (기존 맵)**
1. `addNode/updateNode/...` → 로컬 즉시 반영 + `scheduleSave(activeMapId)`
2. 1.5초 후 `performSave` → `syncStatus='saving'` → `saveMindmap({ id, ... })` → `syncStatus='saved'`
3. 저장 중 추가 편집은 `dirty.add(id)` → 저장 완료 후 재예약

**모드 전환**
1. `setMainMode(mode)` → `restoreForMode(mode)`
2. `lastActiveByMode[mode]` 있으면 즉시 활성화, summary면 상세 pull await
3. 동시에 백그라운드 `fetchMapList()`

**삭제**
1. 휴지통 → 확인
2. 임시 맵: 로컬만 제거
3. 서버 맵: `deleteMindmap(id)` 성공 후 로컬 제거, `activeMapId`/`lastActiveByMode` 정리

### 노드 ID 정책 (로컬 임시 ↔ 서버 UUID)
- **맵 ID**: 로컬 신규는 `local-` 접두사 + `isLocal=true`. 서버 저장 후 키 교체, 같은 트랜잭션에서 `activeMapId`/`lastActiveByMode` 일괄 치환
- **노드 ID**: 프론트 `crypto.randomUUID` 그대로 서버 수용 (백엔드 `NodeDto.id: string` 전제). 서버가 id 재부여할 경우 응답 `nodes`로 replace하는 방어 코드 + dirty 플래그로 동시 편집 흡수

### UI 변경 지점 (MindmapPanel, 인디케이터)
**상태 인디케이터** (제목 오른쪽):
- `saving`: `Loader2` 회전 + "저장 중…"
- `saved`: `Check` + `N초 전 저장됨` (2분 초과는 시각)
- `error`: `AlertTriangle` + "저장 실패 · 재시도" (클릭 시 `saveActiveNow`)
- `idle`(로컬 편집 후 debounce 대기): 옅은 점 + "수정됨"
- `isLocal=true`: "아직 저장 안 됨" (경고색)

**보조**
- "지금 저장" 버튼 (조건부 노출)
- 목록 드롭다운 항목별 syncStatus 점 아이콘
- 빈 목록 구분: `isListLoading` vs "이 모드에 저장된 마인드맵이 없습니다"
- mount effect: `fetchMapList()` + `visibilitychange` flush
- activeMapId 변경 effect: summary면 `loadMapFromServer`
- `MindmapControls.markSaved()` → `markPdfExported()` rename

### 충돌/경쟁 조건 처리
1. **저장 중 재편집**: `dirty` Set 추적 → 저장 완료 후 재예약. nodes replace 시 스냅샷 diff로 dirty 변경분 재적용
2. **저장 중 모드 전환**: 이전 맵 `flushSave`는 비동기로 끝까지 수행
3. **저장 중 삭제**: 타이머 cancel → saving 완료 대기 → 새 id로 `deleteMindmap` 재호출
4. **pull vs 편집 경쟁**: pull 시작 시점의 `lastLocalEditAt`과 완료 시점 비교, 달라졌으면 discard
5. **list 응답의 최신성**: nodes를 덮지 않음, `updatedAt`만 `isStale` 플래그로 표시

### 마이그레이션/호환성
- persist v1 → v2: 기존 `maps`에 `isLocal=false` 주입, 앱 부팅 시 `fetchMapList`와 교차검증. 서버에 없는 로컬 id는 `isLocal=true`로 승격 후 자동 업로드
- Mock 메모리 초기화 대비 fixture 3개 모드별 1~2개씩 심음
- `api.js` 인터셉터에 `skipGlobalErrorHandler` 분기 고려

### 구현 체크리스트
1. `mindmapApi.js` — `deleteMindmap`, JSDoc 보강, `skipGlobalErrorHandler` 전달
2. `mindmapMock.js` — 메모리 Map, id 보존 save, mode 포함 list, deleteMindmap
3. `api.js` — `skipGlobalErrorHandler` 분기 (선택)
4. `useMindmapStore.js`
   - [ ] 신규 상태 필드
   - [ ] 모듈 `timers`/`dirty` + `scheduleSave/performSave/flushSave/flushAllDirty`
   - [ ] `createMap`: `isLocal=true`
   - [ ] 변경 액션 끝에 `scheduleSave` 호출
   - [ ] `deleteMap`: 서버 vs 로컬 분기
   - [ ] `loadMap` summary 처리
   - [ ] `restoreForMode` + 백그라운드 list pull
   - [ ] `fetchMapList/loadMapFromServer/saveActiveNow` public
   - [ ] `partialize` 새 필드 제외
   - [ ] migrate v1 → v2
5. `useAppStore.setMainMode` 유지(스토어가 책임)
6. `MindmapPanel.jsx` — mount/active effect, 인디케이터, `handleDelete` await, "지금 저장" 버튼
7. `MindmapControls.markSaved` 분리
8. QA: 오프라인, 3G throttle, 탭 닫기 flush, 401 재시도, 모드 전환 flush, 삭제 후 캔버스 빈 상태, 새로고침 복원

---

## 5. 관리자 대시보드 서버 연동

### 현재 상태 요약
- `src/pages/AdminPage.jsx`(123줄)는 서버 호출 전혀 없음 → 전부 `useChatStore`/`useDocStore`/`useMindmapStore`/`useCertStore` persist에서 집계
- `src/services/adminApi.js` / `src/services/mock/adminMock.js` 부재
- `useAuthStore.user`는 `{email, name}`만 가짐, `role` 미지원. `partialize`는 `{name}`만 보존 → role 쓰려면 수정 필요
- `App.jsx`의 `/admin/*`은 lazy는 되지만 **가드 없음** → 비로그인 사용자도 URL 접근 가능 (데이터만 비어 보임)
- `Badge` 공통 컴포넌트(blue/green/yellow/red/gray) 존재하나 현재는 `text-success`/`text-warning`으로만 표시
- 스켈레톤 컴포넌트 없음 → 신규 필요. 토스트는 `useToastStore`로 일원화

### 목적
1. 대시보드 수치를 persist 스냅샷이 아닌 **서버 집계**로 교체
2. 비동기 로딩 UX(loading/error/empty/refresh) 일관화
3. 운영자 전용 화면 확장 대비 접근 제어 훅 도입(소프트 가드)
4. `VITE_MOCK_API` 스위치 하나로 프론트 단독 개발

### 변경 대상 파일
**신규**
- `src/services/adminApi.js`
- `src/services/mock/adminMock.js`
- `src/hooks/useAdminDashboard.js`
- `src/components/admin/StatCard.jsx`
- `src/components/admin/RecentConversations.jsx`
- `src/components/admin/DocumentTable.jsx`
- `src/components/admin/DashboardSkeleton.jsx`
- `src/components/admin/DashboardError.jsx`

**수정**
- `src/pages/AdminPage.jsx` — 서버 기반 재작성, 4개 스토어 import 삭제
- (Phase B) `src/stores/useAuthStore.js` — role + partialize 확장
- (선택) `src/App.jsx` — `AdminRoute` guard

### API 함수 추가
```js
/** @returns {Promise<{counts:{totalConversations,totalDocuments,totalMindmapNodes,totalQuizSolved},
 *   recentConversations:[{id,title,mode,updatedAt}],
 *   documents:[{id,fileName,status}]}>} */
export async function getAdminDashboard() {
  if (API_CONFIG.useMock) return mock.getAdminDashboard();
  const { data } = await api.get('/admin/dashboard');
  return data.data;
}
```

Mock: `MOCK_DELAY=400`, recentConversations 8건, documents status 3종 모두 포함.

### UI 구조 (Wireframe)
```
┌──────────────────────────────────────────────────────────────┐
│ [← 메인으로]  관리자 대시보드                  [새로고침 ⟳]  │
├──────────────────────────────────────────────────────────────┤
│  사용 현황                                                   │
│  ┌──────────┬──────────┬──────────┬──────────┐              │
│  │ 💬  128  │ 📄  17   │ 🧠  342  │ 📈  89   │  2col→4col  │
│  │ 총 대화  │ 문서     │ 노드     │ 풀이     │              │
│  └──────────┴──────────┴──────────┴──────────┘              │
│                                                              │
│  최근 대화 (최대 8)                                          │
│  ... flex list: mode 라벨(한글) + formatDate ...             │
│                                                              │
│  문서 현황 (Badge)                                           │
│  완료(green) · 처리중(yellow) · 실패(red)                    │
└──────────────────────────────────────────────────────────────┘
```
- 그리드: `grid-cols-2 md:grid-cols-4 gap-3` (현재 `lg:grid-cols-5`는 4개에 맞춰 `md:grid-cols-4`로)
- 새로고침: `RefreshCw` + `animate-spin` + `disabled`
- 최근 대화 클릭 이동은 MVP에서 TODO 로 남김

### 컴포넌트 분해
1. `StatCard` — `value ?? '-'` 방어
2. `RecentConversations` — `formatDate`, mode 한글 맵
3. `DocumentTable` — STATUS_MAP → `<Badge color=...>`
4. `DashboardSkeleton` — Tailwind `animate-pulse` + `bg-bg-secondary`
5. `DashboardError` — `AlertCircle` + retry Button
6. `useAdminDashboard` — `{data, loading, error, refresh}`, 마운트 1회 호출, `error.userMessage` 우선
7. `AdminPage` — 스토어 import 전부 제거, `if (!isLoggedIn) navigate('/', { replace:true })` effect

### 권한/접근 제어
**3-Phase 점진 도입**
- **Phase A (이번 범위)**: 진입 시 `isLoggedIn` 가드만. role 미도입.
- **Phase B (다음 PR)**: 백엔드 로그인 응답에 `role: 'USER'|'ADMIN'` 포함 → `useAuthStore.user.role` + `partialize` 확장 → `user.role === 'ADMIN'` 조건 강화, 거부 시 토스트 + `/` 리다이렉트
- **Phase C (선택)**: `AdminRoute` wrapper 추상화 (라우트 1개뿐이라 현 시점 불필요)

### 로딩/에러/빈 상태
| 상황 | 트리거 | 렌더 |
|---|---|---|
| 최초 로딩 | `loading && !data` | 전체 `<DashboardSkeleton />` |
| 리프레시 | `loading && data` | 기존 유지 + 버튼 아이콘 회전 |
| 네트워크/5xx | `error !== null` | `<DashboardError onRetry={refresh} />` + Toast 1회 (`useEffect([error])`) |
| 401 | 인터셉터 → refresh 실패 시 `/` | AdminPage 별도 처리 불필요 |
| counts 0 / 빈 배열 | 정상 응답 | `0`/플레이스홀더 |
| 필드 누락 | 방어 | `value ?? '-'` |
| recent > 8 | 방어 | 기존 `.slice(0,8)` 유지 |

### 구현 체크리스트
- [ ] `adminApi.js` + `adminMock.js` 신규
- [ ] `useAdminDashboard` 훅 (연속 refresh race 방지)
- [ ] `StatCard`/`RecentConversations`/`DocumentTable`/`DashboardSkeleton`/`DashboardError`
- [ ] `AdminPage` 리팩토링: 4개 스토어 import 제거, 훅 사용, 새로고침 버튼, 로딩/에러 분기, `grid-cols-4`, 로그인 가드
- [ ] `error` set 시 Toast 1회 발사
- [ ] Phase B TODO: `useAuthStore` role 확장
- [ ] 최근 대화 클릭 이동 TODO (MainPage `useSearchParams('c')` 읽기)
- [ ] QA: mock 스켈레톤→데이터, 새로고침 연타, 401 리다이렉트, 다크 테마 대비, 부분 필드 누락, lazy chunk 유지

---

## 6. 업무학습 RAG 질의 흐름 연동

### 현재 상태 요약
- `WorkStudyMode.jsx`는 형태만 RAG 응답 UI, 실제는 `useStreamingChat('work')` → `streamMessage /chat/stream`
- `queryRag`, `getSource`는 `ragApi.js`에 정의만, 어디서도 import 안됨
- `useRagStore`도 정의만 있고 사용 안됨 (문서 상태는 `useDocStore`)
- `useStreamingChat`은 `useChatStore` 사용 → **3개 모드 대화 공간 공유** (업무학습 대화가 일반 채팅과 섞임)
- `SourcePanel`과 `SourceCard` 중복 존재 → `ChatMessage` 내 `SourceCard`와 `WorkStudyMode` 바깥 `SourcePanel`이 **동시 렌더 가능**
- `EmptyChatView`, `ChatInput`의 IME 처리는 이미 완료
- `getSource` 원문 모달 UI 부재

### 목적
1. WorkStudyMode를 **RAG 질의응답 전용**으로 분리
2. `POST /api/rag/query` → `{answer, sources}` 단일 응답 렌더
3. 문서 0건/processing/completed UX 명확 분기
4. 출처 카드 클릭 → `GET /api/rag/source/{chunkId}` 원문 모달
5. "찾을 수 없음"(sources=[]) 시각 구분
6. 일반 채팅과 **RAG 대화 저장 공간 분리**

### 변경 대상 파일
**변경**
- `src/components/work/WorkStudyMode.jsx` — useStreamingChat 제거, useRagChat 교체, 상태 분기
- `src/components/work/SourcePanel.jsx` — 클릭 이벤트, 0건/찾을 수 없음 문구
- `src/components/chat/ChatMessage.jsx` — `hideSources?:boolean` prop 추가
- `src/stores/useRagStore.js` — ragConversations/ragMessages 필드
- `src/services/mock/ragMock.js` — 빈 sources 시나리오

**신규**
- `src/hooks/useRagChat.js`
- `src/components/work/SourceChunkModal.jsx`
- `src/components/work/DocProcessingBadge.jsx`

### 화면 흐름 (상태 다이어그램)
```
[진입] → docs 확인
 ├─ 0건       → [A] EmptyChatView + 입력 disabled(placeholder="먼저 PDF 업로드")
 ├─ processing → [B] DocProcessingBadge("N건 처리 중") + completed≥1이면 입력 활성
 └─ completed ≥1
      ├─ messages=0 → EmptyChatView (예시 질문)
      └─ messages>0
           - 좌: 메시지 리스트 + 하단 ChatInput
           - 우: DocumentList (md 이상)
           - 로딩 placeholder (id='__loading')
           - 응답: answer + SourcePanel
           - sources=[] → "관련 문서 없음" 박스
```

첫 질의 후 하단 고정은 기존 패턴 재사용: `messages.length === 0` 조건부 렌더 교체.

### 컴포넌트 분해
```
WorkStudyMode
├── DocProcessingBadge [B]
├── (messages=0) EmptyChatView + ChatInput + 예시 질문
└── (messages>0)
    ├── MessageList
    │   └── ChatMessage (assistant, hideSources)
    │        └── SourcePanel
    │             └── SourceCardItem (onClick → SourceChunkModal)
    ├── ChatInput (하단 고정)
    ├── SourceChunkModal
    └── DocumentList (우측)
```

책임 분담: WorkStudyMode=레이아웃/분기, `useRagChat`=API/상태, `useRagStore`=persist, `SourcePanel`=렌더/클릭, `SourceChunkModal`=getSource.

### 대화/메시지 저장 위치 결정
**결론: `useRagStore`를 확장해 별도 대화 스토어로 분리**

| 옵션 | 장단점 | 채택 |
|---|---|---|
| A. `useChatStore`에 mode='work' 필터 | 통합 ✓ / 필드 오염, 스트리밍 전제 충돌 ✗ | ❌ |
| B. `useRagStore` 확장 | RAG 전용 모델 ✓ / 사이드바 병합 셀렉터 필요 | ✅ |
| C. 로컬 state | 최단 / persist 불가 | ❌ |

**스키마 추가**
```
ragConversations: [{
  id, title, docIds, messages:[{
    id, role, content,
    sources?:[{docId,docName,page,chunk,similarity,chunkId}],
    notFound?:boolean, error?:{code,message}, timestamp
  }], createdAt, updatedAt
}],
currentRagConversationId,
isQuerying,

// actions
createRagConversation(firstQuery?)
addRagMessage(convId, message)
setQuerying(bool)
deleteRagConversation(id)
```

persist `partialize`: `ragConversations`, `currentRagConversationId` 포함. `isQuerying`은 제외.

### Sources 표시 UI
**카드** — `SourcePanel` 재사용, 항목을 `<button>`으로 전환:
- 문서명 / 페이지 뱃지 / 유사도 뱃지(우측) / 청크 line-clamp-2
- 유사도 퍼센트 `Math.round(similarity * 100) + '%'`
- 색상 계층:
  - ≥0.9: `bg-success/10 text-success`
  - 0.8~0.9: `bg-primary/10 text-primary`
  - 0.7~0.8: `bg-warning/10 text-warning`
- `onClick → onSelectSource({chunkId, docName, page})`

**SourceChunkModal**
- Props: `isOpen, onClose, chunkId, docName, page`
- `useEffect` → `getSource(chunkId)` → `{fullText, highlightRange}`
- 로딩 스피너, 에러 시 `showError` + 자동 닫기
- `highlightRange` 있으면 `substring` 3분할 + `bg-primary/10`

**ChatMessage 중복 제거** — `hideSources?:boolean` prop 추가, 조건 `{!isUser && message.sources && !hideSources && <SourceCard/>}`. WorkStudyMode는 `hideSources=true`.

### API 연동 지점
**`useRagChat()` 훅**
```js
handleSend = async (query) => {
  let convId = currentConvId ?? createConv();
  addMessage(convId, { role: 'user', content: query });
  setQuerying(true);
  try {
    const res = await queryRag({ query, topK: 5 }, { signal });
    addMessage(convId, {
      role: 'assistant',
      content: res.answer,
      sources: res.sources ?? [],
      notFound: !res.sources || res.sources.length === 0,
    });
  } catch (err) {
    if (err.name === 'AbortError') return;
    addMessage(convId, { role: 'assistant', content: '오류가 발생했습니다',
      error: { code: err.response?.status, message: err.message } });
    showError(err, '문서 질의에 실패했습니다');
  } finally {
    setQuerying(false);
  }
}
```
- `ChatInput.isStreaming = isQuerying` → 입력 비활성 + 중지 버튼
- 중지는 AbortController로 fetch 취소 (대화 상태 유지)
- `ragApi.queryRag(params, { signal })` 시그니처 확장 필요

**getSource 호출** — `SourceChunkModal`에서 `isOpen`일 때만 단발. 캐싱 불필요.

**chunkId 이슈** — mock 응답에 `chunkId` 미존재 → 백엔드에 포함 요청 필요(TODO). 대체 키 `${docId}-${page}`는 경로 파라미터 불일치로 비권장.

### 빈 상태/로딩/에러 처리
| 케이스 | 감지 | UI |
|---|---|---|
| 문서 0건 | `docs.length===0` | EmptyChatView, 입력 disabled, placeholder |
| 문서 processing | `docs.some(d.status==='processing')` | `DocProcessingBadge` + completed≥1이면 입력 활성 |
| 문서 error | `docs.every(d.status==='error')` | "업로드 실패" 문구 + 입력 비활성 |
| 대화 0건 | `messages.length===0` | EmptyChatView 예시 질문 노출 |
| 질의 로딩 | `isQuerying` | 리스트 끝에 `__loading` placeholder, 입력 비활성 |
| 정상 응답 | `sources.length>0` | answer + SourcePanel |
| 찾을 수 없음 | `sources.length===0` | 회색 정보 박스 + 재질문 안내, sources 미표시 |
| 네트워크 에러 | catch | `showError` + 메시지에 error 표시 + 재시도 |
| AbortError | `err.name==='AbortError'` | 메시지 미삽입, `isQuerying=false`만 |

### 구현 체크리스트
**1단계 — 스토어/서비스**
- [ ] `useRagStore` 필드/액션 추가
- [ ] `persist.partialize` 조정
- [ ] `ragApi.queryRag(params, { signal })` 시그니처 확장
- [ ] `ragMock`에 chunkId 포함, 빈 sources 토글

**2단계 — 훅**
- [ ] `useRagChat.js` 신규
- [ ] AbortController + unmount cleanup

**3단계 — UI**
- [ ] `DocProcessingBadge` (useDocStore 구독, 평균 progress)
- [ ] `SourceChunkModal` (Modal 기반, highlightRange)
- [ ] `SourcePanel` 버튼 전환, `onSelectSource`, similarity 색상 계층

**4단계 — 통합**
- [ ] `WorkStudyMode` useRagChat 교체
- [ ] 3상태 분기, `ChatInput.disabled` 경로
- [ ] `selectedChunk` state + `SourceChunkModal` 오픈
- [ ] `__loading` placeholder

**5단계 — ChatMessage**
- [ ] `hideSources` prop 추가
- [ ] WorkStudyMode에서 `<ChatMessage hideSources />`

**6단계 — ChatInput disabled** (선택)
- [ ] `disabled` prop, textarea/button 전파

**7단계 — 사이드바 통합** (선택, 범위 외)
- [ ] `useChatStore.conversations` + `useRagStore.ragConversations` 병합 셀렉터

**8단계 — 검증**
- [ ] IME: "안녕하세요" 조합 중 Enter 무시
- [ ] 상태 전이: 0건 → processing → completed
- [ ] sources=[] → "찾을 수 없음" 박스
- [ ] SourceChunkModal 로딩/표시
- [ ] 중지 → abort, placeholder 제거
- [ ] persist: 새로고침 후 ragConversations 복원
- [ ] 다크모드: Tailwind 변수만 사용

---

## 전체 의존성 / 진행 순서 제안

설계를 구현할 때 권장 순서:

1. **API 서비스 레이어 (Phase 1 일괄)** — 섹션 1,2,3,4,5,6 각각의 service 함수/Mock 신규 추가를 병렬로
2. **섹션 2 (RAG 문서 목록)** → 섹션 6 (RAG 질의 흐름)의 선행. 2 완료 후 6 진행
3. **섹션 1 (대화 동기화)** 와 **섹션 4 (마인드맵 동기화)** 는 독립적이므로 병렬 가능
4. **섹션 3 (학습 통계)** 는 독립적, 언제든 병렬
5. **섹션 5 (관리자 대시보드)** 는 기타 섹션의 스토어 변경 영향 없음 (import 제거만 해서) — 병렬 가능하나 섹션 1/2/4 merge 후 충돌 제로 확인

### 공통 주의사항
- **응답 언랩**: 모든 신규 API에서 `data.data` 일관
- **useMock 분기**: 기존 패턴 준수
- **토스트**: `useToastStore` + `showError(err, fallback)`
- **인터셉터 우회**: 저장 등 사용자 액션에서 5xx를 에러 페이지로 보내지 않으려면 `skipGlobalErrorHandler` 옵션 추가
- **CSS 변수**: 색상은 Tailwind 유틸만, 하드코드 HEX 금지
- **IME**: 한국어 조합 중 Enter는 `e.nativeEvent.isComposing` 체크로 차단 (이미 ChatInput에 구현됨, 신규 입력창에도 동일 적용)
- **Date 포맷**: `utils/formatters.formatDate` 재사용
